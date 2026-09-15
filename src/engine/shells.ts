/**
 * Shell semantics: which interpreter a script will actually run under on each platform, which
 * bash constructs it uses, and what the recorded runs of those constructs say each interpreter
 * does with them. The flags engine answers "does this tool have this flag there?"; this one
 * answers "does `${x,,}` or `arr=(a b)` or `echo x | read v` even mean the same thing there?".
 *
 * The reference is Ubuntu's /bin/bash: a construct that runs there and fails on the target
 * "breaks"; one that runs on both but prints something else "differs" (zsh's arrays start at 1,
 * it does not split unquoted variables, an unmatched glob is an error there). Nothing is judged
 * from a table of folklore: every verdict carries the exit code and output the target printed.
 */
import type { Node as TSNode, Tree as TSTree } from 'web-tree-sitter';
import type { ShellsDatabase, ProbeResult } from '../../scripts/extract-shells.js';
import type { Platform } from '../../scripts/extract.js';
import type { Pos } from './analyze.js';

export type Interp = 'bash' | 'sh' | 'zsh';
export const REFERENCE = 'ubuntu|/bin/bash';

export interface ShellTarget {
  /** "<platform>|<shell path>", the key used in the database */
  key: string;
  platform: Platform;
  shell: string;
  kind: string;
  version: string;
  /** "macOS bash 3.2.57" */
  label: string;
}

export type ShellStatus = 'same' | 'differs' | 'breaks' | 'unknown';
export interface ShellVerdict {
  target: ShellTarget;
  status: ShellStatus;
  headline: string;
  ref?: ProbeResult;
  got?: ProbeResult;
}
export interface ConstructFinding {
  probe: string;
  label: string;
  snippet: string;
  /** the text of the construct as written in the script */
  text: string;
  start: Pos;
  end: Pos;
  verdicts: ShellVerdict[];
}

const PLATFORM_NAME: Record<Platform, string> = { ubuntu: 'Ubuntu', macos: 'macOS', alpine: 'Alpine' };

/** "5.2.21(1)-release" -> "5.2.21", "v1.36.1 (2025-11-23 ...)" -> "v1.36.1", "Version AJM 93u+m/1.0.8 2024-01-01" -> "93u+m/1.0.8" */
function shortVersion(v: string): string {
  const m = /(\d[\w.+/-]*)/.exec(v.replace(/\(.*$/, ''));
  return (m?.[1] ?? v.split(' ')[0] ?? v).replace(/[-)]$/, '');
}

/** The interpreter named by the shebang line, if any. `#!/usr/bin/env bash` counts as bash. */
export function detectShebang(src: string): { interp: Interp | null; line: string | null } {
  const first = src.split('\n', 1)[0] ?? '';
  if (!first.startsWith('#!')) return { interp: null, line: null };
  const m = /(?:^|\/|\s)(bash|zsh|sh|dash|ash|ksh)(?:\s|$)/.exec(first.slice(2).trim());
  const name = m?.[1];
  if (name === 'bash') return { interp: 'bash', line: first };
  if (name === 'zsh') return { interp: 'zsh', line: first };
  if (name === 'sh' || name === 'dash' || name === 'ash') return { interp: 'sh', line: first };
  return { interp: null, line: first };
}

/** Which recorded interpreter a shebang reaches on each platform; with no shebang, the shell a pasted script lands in. */
export function targetsFor(interp: Interp | null, db: ShellsDatabase): ShellTarget[] {
  const path = (p: Platform): string => {
    if (interp === 'bash') return '/bin/bash';
    if (interp === 'zsh') return '/bin/zsh';
    if (interp === 'sh') return '/bin/sh';
    // no shebang: the interactive default -- bash on Ubuntu, zsh on macOS (since Catalina), ash on Alpine
    return p === 'macos' ? '/bin/zsh' : p === 'ubuntu' ? '/bin/bash' : '/bin/sh';
  };
  const out: ShellTarget[] = [];
  for (const platform of ['ubuntu', 'macos', 'alpine'] as Platform[]) {
    const shell = path(platform);
    const info = db.shells[platform]?.[shell];
    if (!info || info.kind === 'missing') continue;
    out.push({ key: `${platform}|${shell}`, platform, shell, kind: info.kind, version: info.version, label: `${PLATFORM_NAME[platform]} ${info.kind} ${shortVersion(info.version)}` });
  }
  return out;
}

export function judgeConstruct(db: ShellsDatabase, probe: string, target: ShellTarget): ShellVerdict {
  const rec = db.probes[probe];
  const ref = rec?.results[REFERENCE];
  const got = rec?.results[target.key];
  if (!rec || !ref || !got) return { target, status: 'unknown', headline: 'not recorded' };
  if (ref.exit === 0 && got.exit !== 0) {
    const why = got.stderr1 || got.stdout1 || `exit ${got.exit}`;
    return { target, status: 'breaks', headline: `fails: ${why}`, ref, got };
  }
  if (ref.exit !== 0 && got.exit !== 0) {
    return { target, status: 'same', headline: `an error here as in bash (${got.stderr1 || `exit ${got.exit}`})`, ref, got };
  }
  if (ref.exit !== 0 && got.exit === 0) {
    return { target, status: 'differs', headline: `an error in bash, accepted here (prints "${got.stdout1}")`, ref, got };
  }
  if (got.stdout1 === ref.stdout1) return { target, status: 'same', headline: got.stdout1 ? `prints "${got.stdout1}", as bash does` : 'exit 0, as in bash', ref, got };
  return { target, status: 'differs', headline: `prints "${got.stdout1}" where bash prints "${ref.stdout1}"`, ref, got };
}

interface Hit { probe: string; node: TSNode }

function firstWordOf(node: TSNode): string {
  return node.text.replace(/^\s+/, '').split(/\s+/, 1)[0] ?? '';
}

/**
 * Every use of a construct the probes cover, with the node it came from. One node can carry
 * several probes (`[[ $x =~ re ]]` is both `[[ ]]` and a regex match).
 */
function insideFunction(n: TSNode): boolean {
  for (let p = n.parent; p; p = p.parent) if (p.type === 'function_definition') return true;
  return false;
}

export function findConstructs(tree: TSTree): Hit[] {
  const hits: Hit[] = [];
  const add = (probe: string, node: TSNode) => hits.push({ probe, node });
  const root = tree.rootNode;

  for (const n of root.descendantsOfType('array')) add('array_length', n);
  for (const n of root.descendantsOfType('subscript')) {
    const idx = n.childForFieldName('index')?.text ?? '';
    if (/^\d+$/.test(idx)) add('array_index', n);
    else if (idx === '@' || idx === '*') add('array_all', n);
  }
  for (const n of root.descendantsOfType('expansion')) {
    const t = n.text;
    if (/^\$\{!/.test(t)) add('indirect_bash', n);
    else if (/,,?\}$/.test(t)) add('lowercase_bash4', n);
    else if (/\^\^?\}$/.test(t)) add('uppercase_bash4', n);
    else if (/@[QEPAa]\}$/.test(t)) add('at_Q', n);
    else if (/^\$\{[A-Za-z_][A-Za-z0-9_]*:\d+(:\d+)?\}$/.test(t)) add('substring', n);
    else if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\/\//.test(t) || /^\$\{[A-Za-z_][A-Za-z0-9_]*\/[^}]*\/[^}]*\}$/.test(t)) add('pattern_replace', n);
    const name = n.descendantsOfType('variable_name')[0]?.text;
    if (name === 'PIPESTATUS') add('pipestatus_upper', n);
    else if (name === 'BASH_SOURCE') add('bash_source', n);
    else if (name === 'FUNCNAME') add('funcname', n);
    else if (name === 'RANDOM') add('random', n);
    else if (name === 'EPOCHSECONDS') add('epochseconds', n);
  }
  for (const n of root.descendantsOfType('simple_expansion')) {
    const name = n.text.slice(1);
    if (name === 'RANDOM') add('random', n);
    else if (name === 'EPOCHSECONDS') add('epochseconds', n);
  }
  for (const n of root.descendantsOfType('process_substitution')) add('process_subst', n);
  for (const n of root.descendantsOfType('herestring_redirect')) add('here_string', n);
  for (const n of root.descendantsOfType('brace_expression')) add('brace_expand', n);
  for (const n of root.descendantsOfType('ansi_c_string')) add('dollar_quote', n);
  for (const n of root.descendantsOfType('arithmetic_expansion')) {
    if (n.text.includes('**')) add('power_arith', n);
    if (/(^|[^0-9A-Za-z_.])0\d+(?![0-9A-Za-z_])/.test(n.text)) add('octal_literal', n);
  }
  // a standalone (( )) is a compound_statement in this grammar, not a test_command
  for (const n of root.descendantsOfType('compound_statement')) {
    if (n.text.startsWith('((')) add('paren_arith', n);
  }
  for (const n of root.descendantsOfType('test_command')) {
    const t = n.text;
    if (t.startsWith('[[')) {
      add('double_bracket', n);
      if (/\s=~\s/.test(t)) add('regex_match', n);
      if (/\[\[\s+-v\s/.test(t)) add('test_v', n);
    } else if (t.startsWith('[') && /\s==\s/.test(t)) add('single_bracket_eqeq', n);
  }
  for (const n of root.descendantsOfType('function_definition')) {
    if (/^function\s/.test(n.text)) add('function_keyword', n);
  }
  for (const n of root.descendantsOfType('declaration_command')) {
    const w = n.text;
    if (/^(declare|typeset)\s+(-\w*A|-A)/.test(w)) add('assoc_declare', n);
    else if (/^(declare|typeset)\s+-\w*n/.test(w)) add('declare_n', n);
    else if (/^export\s+-\w*f\b/.test(w)) add('export_f', n);
  }
  for (const n of root.descendantsOfType('command')) {
    const name = n.childForFieldName('name')?.text ?? '';
    const args = n.childrenForFieldName('argument').filter((a): a is TSNode => !!a);
    const argText = args.map((a) => a.text);
    const has = (re: RegExp) => argText.some((a) => re.test(a));
    switch (name) {
      case 'mapfile': case 'readarray': add('mapfile', n); break;
      case 'shopt': add('shopt', n); break;
      case 'let': add('let_builtin', n); break;
      case 'compgen': add('compgen', n); break;
      case 'coproc': add('coproc', n); break;
      case 'source': add('source_keyword', n); break;
      case '.': add('source_dot', n); break;
      case 'alias': add('alias_in_script', n); break;
      case 'read': if (has(/^-\w*a/)) add('read_a', n); if (has(/^-\w*p/)) add('read_p', n); break;
      case 'printf': if (has(/^-v$/)) add('printf_v', n); break;
      case 'echo': if (has(/^-\w*e/)) add('echo_dash_e', n); if (has(/^-\w*n/)) add('echo_dash_n', n); break;
      case 'set': if (argText.join(' ').includes('pipefail')) add('pipefail', n); break;
      case 'type': if (has(/^-\w*t/)) add('type_t', n); break;
      case 'local': if (!insideFunction(n)) add('local_outside', n); break;
    }
    // an unquoted $var as a whole argument is split into words by bash and not by zsh
    for (const a of args) if (a.type === 'simple_expansion') add('word_split', a);
    // an unquoted glob that matches nothing stays literal in bash and is an error in zsh
    for (const a of args) if (a.type === 'word' && /[*?]/.test(a.text) && !/^-/.test(a.text)) add('glob_nomatch', a);
  }
  for (const n of root.descendantsOfType('pipeline')) {
    const last = n.namedChildren[n.namedChildren.length - 1];
    if (last?.type === 'command' && last.childForFieldName('name')?.text === 'read') add('pipe_read', last);
  }
  for (const n of root.descendantsOfType('for_statement')) {
    const words = n.text;
    if (/\bin\s+[^\n;]*[*?]/.test(words)) add('glob_nomatch_for', n);
  }
  // `local` appears as a declaration_command, not a command, in this grammar
  for (const n of root.descendantsOfType('declaration_command')) {
    if (/^local\s/.test(n.text) && !insideFunction(n)) add('local_outside', n);
  }
  // one finding per probe per position
  const seen = new Set<string>();
  return hits.filter((h) => { const k = `${h.probe}@${h.node.startIndex}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function analyzeShells(tree: TSTree, db: ShellsDatabase, targets: ShellTarget[], offset?: Pos): ConstructFinding[] {
  const pos = (p: { row: number; column: number }): Pos => (offset ? { row: p.row + offset.row, column: p.row === 0 ? p.column + offset.column : p.column } : { row: p.row, column: p.column });
  const out: ConstructFinding[] = [];
  for (const h of findConstructs(tree)) {
    const rec = db.probes[h.probe];
    if (!rec) continue;
    out.push({
      probe: h.probe, label: rec.label, snippet: rec.snippet, text: h.node.text.length > 80 ? h.node.text.slice(0, 77) + '…' : h.node.text,
      start: pos(h.node.startPosition), end: pos(h.node.endPosition),
      verdicts: targets.map((t) => judgeConstruct(db, h.probe, t)),
    });
  }
  out.sort((a, b) => a.start.row - b.start.row || a.start.column - b.start.column);
  return out;
}
