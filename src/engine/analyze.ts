/**
 * Script analysis: tree-sitter-bash finds every simple command (in pipelines, subshells, functions, loops,
 * command substitutions, unquoted heredocs); this module resolves the static words, unwraps sudo/env/xargs
 * and friends, splits option words into flags using the platform database for arity, and asks the verdict
 * engine what each platform's recorded evidence says. Anything dynamic is reported as not checked, never guessed.
 */
import type { Parser as TSParser, Node as TSNode, Tree as TSTree } from 'web-tree-sitter';
import type { Database, Platform } from '../../scripts/extract.js';
import { judge, flagsInWord, BUILTINS, type Verdict } from './verdict.js';

export interface Pos { row: number; column: number }
export interface FlagFinding {
  flag: string;
  /** The word it came from and its position in the script. */
  word: string;
  start: Pos;
  end: Pos;
  verdicts: Record<Platform, Verdict>;
}
export interface CommandFinding {
  name: string;
  start: Pos;
  end: Pos;
  /** e.g. ["sudo", "env"] when the command was unwrapped from those. */
  via: string[];
  flags: FlagFinding[];
  /** Words that could not be checked and why. */
  notes: string[];
  /** Whether the command name was static; dynamic names are listed with no flags. */
  checked: boolean;
}
export interface Analysis {
  commands: CommandFinding[];
  parseErrors: Pos[];
  /** Commands whose name is not a recorded tool and not a builtin. */
  unknownTools: string[];
}

export const PLATFORMS: Platform[] = ['ubuntu', 'macos', 'alpine'];

/** Wrappers: their own value-taking options, after which the inner command begins at the first non-option word. */
const WRAPPERS: Record<string, { valueFlags: string[]; skipFirstPositional?: number; envPrefix?: boolean }> = {
  sudo: { valueFlags: ['-u', '-g', '-p', '-C', '-D', '-h', '-r', '-t', '-T', '-U'] },
  doas: { valueFlags: ['-u', '-C'] },
  env: { valueFlags: ['-u', '-C', '-S'], envPrefix: true },
  command: { valueFlags: [] },
  builtin: { valueFlags: [] },
  exec: { valueFlags: [] },
  nohup: { valueFlags: [] },
  time: { valueFlags: [] },
  nice: { valueFlags: ['-n'] },
  ionice: { valueFlags: ['-c', '-n', '-p'] },
  stdbuf: { valueFlags: ['-i', '-o', '-e'] },
  timeout: { valueFlags: ['-k', '-s'], skipFirstPositional: 1 },
  setsid: { valueFlags: [] },
  chroot: { valueFlags: [], skipFirstPositional: 1 },
  watch: { valueFlags: ['-n', '-d'] },
  xargs: { valueFlags: ['-I', '-n', '-L', '-P', '-a', '-d', '-s', '-E', '-l', '-i', '-J', '-R', '-S'] },
};

/** Tools whose first operand is a bundle of old-style letters (tar xvf, ps aux): not dash options, not checked as flags. */
const OLD_STYLE = new Set(['tar', 'ps']);
/** Tools whose dash-words are an expression language, not getopt flags. */
const EXPRESSION_TOOLS = new Set(['find', 'test', '[', 'expr']);

export interface StaticValue { value: string; isStatic: boolean }

/** Resolve a tree-sitter word node to its static text, or report it as dynamic. */
export function resolveWord(node: TSNode): StaticValue {
  switch (node.type) {
    case 'word': case 'number': return { value: node.text, isStatic: true };
    case 'raw_string': return { value: node.text.slice(1, -1), isStatic: true };
    case 'ansi_c_string': return { value: decodeAnsiC(node.text.slice(2, -1)), isStatic: true };
    case 'string': {
      let out = '';
      for (const c of node.children) {
        if (!c) continue;
        if (c.type === '"') continue;
        if (c.type === 'string_content') out += c.text.replace(/\\([\\"$`\n])/g, '$1');
        else return { value: node.text, isStatic: false };
      }
      return { value: out, isStatic: true };
    }
    case 'concatenation': {
      let out = '';
      for (const c of node.children) { if (!c) continue; const r = resolveWord(c); if (!r.isStatic) return { value: node.text, isStatic: false }; out += r.value; }
      return { value: out, isStatic: true };
    }
    default: return { value: node.text, isStatic: false };
  }
}

function decodeAnsiC(s: string): string {
  return s.replace(/\\(n|t|r|\\|'|"|a|b|f|v|0|x[0-9A-Fa-f]{1,2})/g, (_, e: string) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v', '0': '\0' } as Record<string, string>)[e] ?? (e.startsWith('x') ? String.fromCharCode(parseInt(e.slice(1), 16)) : e));
}

interface Word { value: string; isStatic: boolean; start: Pos; end: Pos; type: string }

/** Whether a flag takes an argument on any recorded platform (arity is decided per platform in the verdict; here it only guides splitting). */
function takesArg(db: Database, tool: string, flag: string): 'required' | 'optional' | 'none' {
  let best: 'required' | 'optional' | 'none' = 'none';
  for (const p of PLATFORMS) {
    const a = db.tools[tool]?.[p]?.flags[flag]?.arg;
    if (a === 'required') return 'required';
    if (a === 'optional') best = 'optional';
  }
  return best;
}

/** Turn the resolved words of one simple command into flag findings, unwrapping wrappers. */
function analyzeWords(db: Database, name: string, words: Word[], via: string[], start: Pos, end: Pos, out: CommandFinding[], parser: TSParser | undefined): void {
  const finding: CommandFinding = { name, start, end, via, flags: [], notes: [], checked: true };
  const w = WRAPPERS[name];
  if (w && name !== 'xargs') {
    // Check the wrapper's own flags too (sudo -E, env -S, timeout -k are real portability questions), then recurse into the inner command.
    let i = 0;
    let skip = w.skipFirstPositional ?? 0;
    for (; i < words.length; i++) {
      const wd = words[i]!;
      if (!wd.isStatic) break;
      if (w.envPrefix && /^[A-Za-z_][A-Za-z0-9_]*=/.test(wd.value)) continue;
      if (wd.value === '--') { i++; break; }
      if (wd.value.startsWith('-') && wd.value.length > 1) {
        addFlags(db, name, wd, finding, words, i, (f) => (w.valueFlags.includes(f) ? 'required' : 'none'));
        if (w.valueFlags.includes(wd.value)) i++;
        continue;
      }
      if (skip > 0) { skip--; continue; }
      break;
    }
    if (name === 'command' && words.some((x) => x.isStatic && (x.value === '-v' || x.value === '-V'))) {
      finding.notes.push('command -v only asks whether the name exists; the named tool is not executed here');
      out.push(finding); return;
    }
    out.push(finding);
    const inner = words[i];
    if (inner && inner.isStatic) analyzeWords(db, inner.value.replace(/^\\/, ''), words.slice(i + 1), [...via, name], inner.start, end, out, parser);
    else if (inner) out.push({ name: inner.value, start: inner.start, end: inner.end, via: [...via, name], flags: [], notes: ['command name is not static: not checked'], checked: false });
    return;
  }
  if ((name === 'sh' || name === 'bash' || name === 'dash' || name === 'zsh') && parser) {
    const ci = words.findIndex((x) => x.isStatic && x.value === '-c');
    const script = words[ci + 1];
    if (ci >= 0 && script) {
      if (script.isStatic) {
        const sub = analyzeTree(parser.parse(script.value)!, db, parser, [...via, `${name} -c`], script.start);
        out.push(finding, ...sub.commands);
      } else { finding.notes.push(`${name} -c with a dynamic string: not checked`); out.push(finding); }
      return;
    }
  }
  if (!db.tools[name] && !BUILTINS.has(name)) {
    // Not a recorded tool: its flags cannot be judged, and pretending otherwise would be noise.
    finding.notes.push(`${name} is not recorded on any platform: not checked`);
    out.push(finding);
    return;
  }
  let afterDashDash = false;
  let positional = 0;
  for (let i = 0; i < words.length; i++) {
    const wd = words[i]!;
    if (!wd.isStatic) { finding.notes.push(`"${wd.value}" is dynamic: not checked`); continue; }
    const v = wd.value;
    if (afterDashDash) continue;
    if (v === '--') { afterDashDash = true; continue; }
    if (name === 'find' && (v === '-exec' || v === '-execdir' || v === '-ok' || v === '-okdir')) {
      // The command after -exec runs for real: analyze it up to ; or +
      let j = i + 1; const innerWords: Word[] = [];
      while (j < words.length && !(words[j]!.isStatic && (words[j]!.value === ';' || words[j]!.value === '+'))) { innerWords.push(words[j]!); j++; }
      const innerName = innerWords[0];
      if (innerName?.isStatic) analyzeWords(db, innerName.value, innerWords.slice(1), [...via, 'find -exec'], innerName.start, end, out, parser);
      i = j; continue;
    }
    if (EXPRESSION_TOOLS.has(name) && v.startsWith('-') && v.length > 2 && !v.startsWith('--')) {
      // find -name, -printf; test -f: single-dash words are primaries, judged only when some platform recorded an answer
      if (PLATFORMS.some((p) => db.tools[name]?.[p]?.flags[v] || db.tools[name]?.[p]?.runs?.[v])) addFlags(db, name, wd, finding, words, i, () => 'none', v);
      else finding.notes.push(`${v}: ${name} primary, not recorded on any platform`);
      continue;
    }
    if (v.startsWith('-') && v.length > 1) {
      // "-0", "-5": a real option when some platform documents it (xargs -0), otherwise a legacy count (head -5)
      if (wd.type === 'number' && !/^-[A-Za-z]/.test(v) && !PLATFORMS.some((p) => db.tools[name]?.[p]?.flags[v.slice(0, 2)])) { finding.notes.push(`${v}: legacy numeric option (head -5 style), not checked`); continue; }
      const consumed = addFlags(db, name, wd, finding, words, i, (f) => takesArg(db, name, f));
      i += consumed;
      continue;
    }
    if (OLD_STYLE.has(name) && positional === 0 && /^[A-Za-z]+$/.test(v)) { finding.notes.push(`${v}: old-style bundled options (${name} ${v}), not checked as flags`); positional++; continue; }
    positional++;
    if (name === 'xargs' && !v.startsWith('-')) {
      // xargs CMD ARGS: the inner command runs on every platform too
      analyzeWords(db, v, words.slice(i + 1), [...via, 'xargs'], wd.start, end, out, parser);
      out.unshift(finding); return;
    }
  }
  out.push(finding);
}

/** Add the flags carried by one word; returns how many following words were consumed as values. */
function addFlags(db: Database, tool: string, wd: Word, finding: CommandFinding, words: Word[], i: number, arity: (flag: string) => 'required' | 'optional' | 'none', wholeFlag?: string): number {
  const v = wd.value;
  let consumed = 0;
  let flags: string[];
  if (wholeFlag) flags = [wholeFlag];
  else if (v.startsWith('--')) { flags = [v.replace(/=.*$/, '')]; if (!v.includes('=') && arity(flags[0]!) === 'required') consumed = 1; }
  else {
    flags = [];
    for (let k = 1; k < v.length; k++) {
      const f = '-' + v[k]!;
      flags.push(f);
      const a = arity(f);
      if (a === 'required' || a === 'optional') { if (k === v.length - 1 && a === 'required') consumed = 1; break; }
    }
  }
  for (const flag of flags) {
    const verdicts = Object.fromEntries(PLATFORMS.map((p) => [p, judge(db, tool, flag, p)])) as Record<Platform, Verdict>;
    finding.flags.push({ flag, word: v, start: wd.start, end: wd.end, verdicts });
  }
  void words; void i; void flagsInWord;
  return consumed;
}

function pos(p: { row: number; column: number }, offset?: Pos): Pos {
  return offset ? { row: p.row + offset.row, column: p.row === 0 ? p.column + offset.column : p.column } : { row: p.row, column: p.column };
}

export function analyzeTree(tree: TSTree, db: Database, parser?: TSParser, via: string[] = [], offset?: Pos): Analysis {
  const commands: CommandFinding[] = [];
  const parseErrors: Pos[] = [];
  for (const n of tree.rootNode.descendantsOfType(['ERROR', 'MISSING'])) parseErrors.push(pos(n.startPosition, offset));
  if (tree.rootNode.hasError && parseErrors.length === 0) parseErrors.push({ row: 0, column: 0 });
  for (const c of tree.rootNode.descendantsOfType('command')) {
    const nameNode = c.childForFieldName('name');
    if (!nameNode) continue;
    const nameVal = resolveWord(nameNode.firstChild && nameNode.type === 'command_name' ? nameNode.firstChild : nameNode);
    const start = pos(c.startPosition, offset), end = pos(c.endPosition, offset);
    if (!nameVal.isStatic) { commands.push({ name: nameNode.text, start, end, via, flags: [], notes: ['command name is not static: not checked'], checked: false }); continue; }
    const name = nameVal.value.replace(/^\\/, '').replace(/^.*\//, '');
    const words: Word[] = c.childrenForFieldName('argument').filter((a): a is TSNode => !!a).map((a) => { const r = resolveWord(a); return { ...r, start: pos(a.startPosition, offset), end: pos(a.endPosition, offset), type: a.type }; });
    analyzeWords(db, name, words, via, start, end, commands, parser);
  }
  const known = new Set(Object.keys(db.tools));
  const SHELLS = new Set(['sh', 'bash', 'dash', 'zsh', 'ksh']);
  const unknownTools = [...new Set(commands.filter((c) => c.checked && !known.has(c.name) && !BUILTINS.has(c.name) && !WRAPPERS[c.name] && !SHELLS.has(c.name)).map((c) => c.name))];
  return { commands, parseErrors, unknownTools };
}

export function analyzeScript(parser: TSParser, src: string, db: Database): Analysis {
  return analyzeTree(parser.parse(src)!, db, parser);
}
