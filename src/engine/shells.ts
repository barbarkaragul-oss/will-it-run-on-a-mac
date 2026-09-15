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

interface Hit {
  probe: string;
  node: TSNode;
  /** the construct's full text when the grammar cut the node short ("${x:$off:$len}" parses as `${x:` + siblings) */
  text?: string;
}

function firstWordOf(node: TSNode): string {
  return node.text.replace(/^\s+/, '').split(/\s+/, 1)[0] ?? '';
}

function insideFunction(n: TSNode): boolean {
  for (let p = n.parent; p; p = p.parent) if (p.type === 'function_definition') return true;
  return false;
}

/** the single letters of the leading `-abc` option words of a builtin (`declare -Ag m` -> A, g); stops at the first operand */
function leadingOptionLetters(n: TSNode): string {
  let out = '';
  for (const c of n.namedChildren) {
    if (!c || c.type !== 'word') break;
    if (c.text === '--') break;
    if (!/^-[A-Za-z]+$/.test(c.text)) break;
    out += c.text.slice(1);
  }
  return out;
}

/** the leading `-abc` option words of a command's arguments, as a run of letters; stops at `--` or the first operand */
function optionLetters(argText: string[]): string {
  let out = '';
  for (const a of argText) {
    if (a === '--' || !/^-[A-Za-z]+$/.test(a)) break;
    out += a.slice(1);
  }
  return out;
}

/** `${x:=d}`-style parameter expansions name a variable, a positional or `@`/`*`, optionally with a subscript */
const PARAM = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*|\d+|[@*])(?:\[[^\]]*\])?`;
const DEFAULT_RE = new RegExp(String.raw`^\$\{${PARAM}:?-`);
const ALTERNATE_RE = new RegExp(String.raw`^\$\{${PARAM}:?\+`);
const ASSIGN_DEFAULT_RE = new RegExp(String.raw`^\$\{${PARAM}:?=`);
const STRIP_PREFIX_RE = new RegExp(String.raw`^\$\{${PARAM}##?`);
const STRIP_SUFFIX_RE = new RegExp(String.raw`^\$\{${PARAM}%%?`);
// a `#` before the digits is a base-N literal (`10#08`), not an octal one
const OCTAL_RE = /(^|[^0-9A-Za-z_.#])0\d+(?![0-9A-Za-z_])/;
const LEADING_08_RE = /(^|[^0-9A-Za-z_.#])0[89]\d*(?![0-9A-Za-z_])/;
const BASE_N_RE = /\d+#[0-9A-Za-z]/;
const DIV_ZERO_RE = /\/\s*0(?![0-9A-Za-z_.])/;
const GLOBSTAR_RE = /(^|\/)\*\*(\/|$)/;
const LOWER_RE = /^\$\{[A-Za-z_]\w*(\[[^\]]*\])?,,?\}$/;
const UPPER_RE = /^\$\{[A-Za-z_]\w*(\[[^\]]*\])?\^\^?\}$/;
const ARRAY_LENGTH_RE = /^\$\{#[A-Za-z_]\w*\[[@*]\]\}$/;
const WHOLE_ARRAY_RE = /^\$\{([A-Za-z_]\w*)\[[@*]\]\}$/;
// `${!x*}` / `${!x@}` list the variable names starting with x; no probe measures that
const PREFIX_LIST_RE = /^\$\{![A-Za-z_]\w*[*@]\}$/;
// "${@}", "${*}", "${@:2}": the whole positional list, which is an error when empty under set -u in bash 3.2 (`${@:-}` and `${@:+x}` are the guards)
const WHOLE_POSITIONAL_RE = /^\$\{[@*](\}|:\d)/;
// ${1+"$@"}, ${@+"$@"}, ${@:+"$@"}, ${*+"$*"}, ${*:+"$*"}: the bash-3.2-safe spellings of "$@"
const POSITIONAL_GUARD_RE = /^\$\{(?:1\+|[@*]:?\+)/;
/** bash's own arrays: the 0-vs-1 indexing verdict means nothing for them; their specific probes (or nothing) apply */
const BASH_OWN_ARRAYS = new Set(['BASH_SOURCE', 'FUNCNAME', 'BASH_REMATCH', 'PIPESTATUS', 'BASH_VERSINFO', 'BASH_LINENO', 'BASH_ARGV', 'BASH_ARGC', 'COMP_WORDS', 'COMPREPLY', 'DIRSTACK', 'GROUPS']);

/** the statement-level ancestor of a node: the child of a program, function body, loop body or branch */
function statementOf(n: TSNode): TSNode {
  let s = n;
  while (s.parent && !['program', 'compound_statement', 'do_group', 'if_statement', 'elif_clause', 'else_clause', 'case_item', 'subshell'].includes(s.parent.type)) s = s.parent;
  return s;
}

/** the statement before this node's statement, skipping comments */
function previousStatement(n: TSNode): TSNode | null {
  let prev = statementOf(n).previousNamedSibling;
  while (prev && prev.type === 'comment') prev = prev.previousNamedSibling;
  return prev;
}

const SUBST_TYPES = ['expansion', 'simple_expansion', 'command_substitution'];

/** an arithmetic expression's text with every `${...}`, `$x` and `$( )` replaced by `v`, so a default like `${d:-09}` is not read as a literal */
function arithText(n: TSNode): string {
  const subs = n.descendantsOfType(SUBST_TYPES).filter((d): d is TSNode => {
    if (!d) return false;
    for (let p = d.parent; p && p !== n; p = p.parent) if (SUBST_TYPES.includes(p.type)) return false;
    return true;
  });
  let out = '', cur = 0;
  for (const d of subs) { out += n.text.slice(cur, d.startIndex - n.startIndex) + 'v'; cur = d.endIndex - n.startIndex; }
  return out + n.text.slice(cur);
}

/** does an assignment's value run a command substitution anywhere (`x=$(f)`, `x="$(f)"`, `x=a$(f)`)? its status is then hidden by the assignment builtin */
function valueRunsCommand(assign: TSNode): boolean {
  const value = assign.childForFieldName('value');
  return !!value && (value.type === 'command_substitution' || value.descendantsOfType('command_substitution').length > 0);
}

/** a literal, non-empty value: a bare word, a quoted string with nothing to expand, or `$'...'` */
function isLiteralNonEmpty(value: TSNode): boolean {
  if (value.type === 'word' || value.type === 'number') return value.text.length > 0;
  if (value.type === 'raw_string') return value.text.length > 2;
  if (value.type === 'ansi_c_string') return value.text.length > 3;
  if (value.type === 'string') return value.text.length > 2 && value.descendantsOfType([...SUBST_TYPES, 'arithmetic_expansion']).length === 0;
  return false;
}

/** `IFS=$' \t\n'` or `IFS=' '` put the default splitting back; they do not change how the script splits */
function isDefaultIfs(value: TSNode): boolean {
  if (value.type === 'ansi_c_string') return value.text === String.raw`$' \t\n'`;
  if (value.type === 'raw_string' || value.type === 'string') return value.text.slice(1, -1) === ' ';
  return false;
}

/**
 * The text of a `${...}` expansion, closed at the matching brace. tree-sitter cuts "${x:$off:$len}" short
 * (the node is `${x:` with an empty `}` and the operands become siblings), so the rest is read from the parent.
 */
function fullExpansionText(n: TSNode): string | null {
  const close = n.children[n.children.length - 1];
  if (close?.type === '}' && close.text === '}') return n.text.replace(/^\s+/, '');
  const parent = n.parent;
  if (!parent) return null;
  const from = parent.text.slice(n.startIndex - parent.startIndex).replace(/^\s+/, '');
  let depth = 0;
  for (let i = 0; i < from.length; i++) {
    const ch = from[i];
    if (ch === '\n') return null;
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return from.slice(0, i + 1);
  }
  return null;
}

/** `${x:o}` / `${x:o:l}` with any operands: which of the three substring probes it is, by the sign of the operands */
function substringKind(full: string): 'substring' | 'substr_negative' | 'substring_neg_len' | null {
  const m = /^\$\{(?:[A-Za-z_]\w*|\d+):(?![-=?+])(.*)\}$/s.exec(full);
  if (!m) return null;
  const ops: string[] = [];
  let depth = 0, cur = '';
  for (const ch of m[1]!) {
    if (ch === '{' || ch === '(') depth++;
    else if (ch === '}' || ch === ')') depth--;
    if (ch === ':' && depth === 0) { ops.push(cur); cur = ''; } else cur += ch;
  }
  ops.push(cur);
  if (ops.length > 2 || !ops[0]!.trim()) return null;
  if (/^[-(]/.test(ops[0]!.trim())) return 'substr_negative';
  if (ops.length === 2 && ops[1]!.trim().startsWith('-')) return 'substring_neg_len';
  return 'substring';
}

/** an unquoted `$var` that can split into words: not `$?`, `$$`, `$!`, `$#`, `$-` or a positional `$0`..`$9` */
function splittable(simpleExpansion: TSNode): boolean {
  const name = simpleExpansion.text.trimStart().slice(1);
  return !/^[?$!#-]$/.test(name) && !/^\d+$/.test(name);
}

/**
 * the backslashes echo actually receives: `"a\tb"` and `'a\tb'` keep theirs, `"\"" "\$" a\ b` lose theirs to the shell,
 * and a backslash inside a nested `${x//\//_}` or `$(printf 'a\tb')` belongs to that expansion, not to the string
 */
function echoSeesBackslash(arg: TSNode): boolean {
  if (arg.type === 'string') {
    let rest = '', cur = 0;
    for (const c of arg.namedChildren) {
      if (!c || c.type === 'string_content') continue;
      rest += arg.text.slice(cur, c.startIndex - arg.startIndex);
      cur = c.endIndex - arg.startIndex;
    }
    rest += arg.text.slice(cur);
    return /\\[^$"`\\\n]/.test(rest);
  }
  if (arg.type === 'raw_string') return arg.text.includes('\\');
  if (arg.type === 'word') return arg.text.includes('\\\\');
  if (arg.type === 'concatenation') return arg.namedChildren.some((c) => !!c && echoSeesBackslash(c));
  return false;
}

/**
 * Every use of a construct the probes cover, with the node it came from. One node can carry
 * several probes (`[[ $x =~ re ]]` is both `[[ ]]` and a regex match).
 */
export function findConstructs(tree: TSTree): Hit[] {
  const hits: Hit[] = [];
  const add = (probe: string, node: TSNode, text?: string) => hits.push(text ? { probe, node, text } : { probe, node });
  const root = tree.rootNode;

  // script-wide facts the per-node checks depend on: shell options, function names, declared arrays, `set -- words`
  let nounset = false, errexit = false, positionalSet = false;
  for (const n of root.descendantsOfType('command')) {
    if (n.childForFieldName('name')?.text !== 'set') continue;
    const argText = n.childrenForFieldName('argument').filter((a): a is TSNode => !!a).map((a) => a.text);
    // `set -- a b` gives the script positional parameters of its own, so "$@" is not the empty caller list
    if (argText[0] === '--' && argText.length > 1) positionalSet = true;
    const letters = optionLetters(argText);
    if (letters.includes('u')) nounset = true;
    if (letters.includes('e')) errexit = true;
    for (let i = 0; i < argText.length; i++) {
      if (argText[i] === '--') break;
      if (argText[i] === '-o' && argText[i + 1] === 'nounset') nounset = true;
      if (argText[i] === '-o' && argText[i + 1] === 'errexit') errexit = true;
    }
  }
  const funcNames = new Set<string>();
  for (const n of root.descendantsOfType('function_definition')) {
    const name = n.childForFieldName('name')?.text;
    if (name) funcNames.add(name);
  }
  const assocNames = new Set<string>();
  for (const n of root.descendantsOfType('declaration_command')) {
    const first = firstWordOf(n);
    if ((first === 'declare' || first === 'typeset' || first === 'local') && leadingOptionLetters(n).includes('A')) {
      for (const c of n.namedChildren) {
        if (!c) continue;
        if (c.type === 'variable_name') assocNames.add(c.text);
        else if (c.type === 'variable_assignment') { const nm = c.childForFieldName('name')?.text; if (nm) assocNames.add(nm); }
      }
    }
  }
  // `arr=(a b)`: the literal itself; `${#arr[@]}` is the array_length probe
  for (const n of root.descendantsOfType('array')) add('array_literal', n);
  // arrays assigned a literal with at least one element: "${arr[@]}" is then not the empty-under-set-u case
  const literalArrays = new Set<string>();
  for (const n of root.descendantsOfType('variable_assignment')) {
    const name = n.childForFieldName('name'), value = n.childForFieldName('value');
    if (name?.type === 'variable_name' && value?.type === 'array' && value.namedChildren.length > 0) literalArrays.add(name.text); // `arr=(x)` or `arr+=(x)`: the script puts something in it
  }
  for (const n of root.descendantsOfType('subscript')) {
    const name = n.childForFieldName('name')?.text ?? '';
    if (BASH_OWN_ARRAYS.has(name)) continue;
    const ix = n.childForFieldName('index');
    const idx = ix?.text ?? '';
    if (/^\d+$/.test(idx)) add('array_index', n);
    else if (/^-\d+$/.test(idx)) add('array_negative_index', n);
    else if (idx === '@' || idx === '*') {
      // `${#arr[@]}` counts elements and is reported on the expansion, not as an all-elements use
      if (n.parent?.type === 'expansion' && /^\$\{#/.test(n.parent.text.trimStart())) continue;
      // "${arr[*]}" inside double quotes joins on IFS; everywhere else [@] and [*] expand per element
      if (idx === '*' && n.parent?.type === 'expansion' && n.parent.parent?.type === 'string') add('array_star_ifs', n);
      else add('array_all', n);
    } else if (ix && !assocNames.has(name) && (ix.type === 'simple_expansion' || ix.type === 'expansion' || ix.type === 'word')) add('array_var_index', n);
  }
  for (const n of root.descendantsOfType('expansion')) {
    // the 2nd+ expansion inside one double-quoted string carries the whitespace before it in its text
    const t = n.text.replace(/^\s+/, '');
    const operator = n.childForFieldName('operator')?.text;
    const colons = n.children.filter((c): c is TSNode => !!c && c.type === ':');
    const named = n.namedChildren.filter((c): c is TSNode => !!c);
    const sub = named[0];
    const wholePositional = sub?.type === 'special_variable_name' && /^[@*]$/.test(sub.text);
    const wholeArray = sub?.type === 'subscript' && /^[@*]$/.test(sub.childForFieldName('index')?.text ?? '');
    if (/^\$\{![A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}$/.test(t)) add('array_keys', n);
    else if (PREFIX_LIST_RE.test(t)) { /* a prefix listing, not an indirection; nothing measures it */ }
    else if (/^\$\{!/.test(t)) add('indirect_bash', n);
    else if (LOWER_RE.test(t)) add('lowercase_bash4', n);
    else if (UPPER_RE.test(t)) add('uppercase_bash4', n);
    else if (/@[QEPAa]\}$/.test(t)) add('at_upper_q', n);
    else if (/@[UuL]\}$/.test(t)) add('at_upper_u', n);
    else if (ARRAY_LENGTH_RE.test(t)) add('array_length', n);
    else if (/^\$\{#(?:[A-Za-z_][A-Za-z0-9_]*|\d+)\}$/.test(t)) add('string_length', n);
    // `${arr[@]:1}`, `${@:2}`, "${*:1:2}": a slice of an array or of the positional parameters
    else if (operator === ':' && (wholeArray || wholePositional)) add('array_slice', n);
    else if (operator === ':' && colons.length === 2 && named.some((c) => c.type === 'number' && c.text.startsWith('-') && c.startIndex > colons[1]!.startIndex)) add('substring_neg_len', n);
    else if (operator === ':' && sub?.type !== 'subscript' && named.some((c) => (c.type === 'number' && c.text.startsWith('-')) || c.type === 'parenthesized_expression')) add('substr_negative', n);
    // `${x:1:2}`, "${x:$off:$len}", ${1:0:1}: a substring of a variable or positional with any operands; `${x:-d}` and friends are other operators
    else if (operator === ':' && sub?.type === 'variable_name') {
      const full = fullExpansionText(n);
      const kind = full && substringKind(full);
      if (kind) add(kind, n, full === n.text.replace(/^\s+/, '') ? undefined : full);
    }
    else if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\/\//.test(t) || /^\$\{[A-Za-z_][A-Za-z0-9_]*\/[^}]*\/[^}]*\}$/.test(t)) add('pattern_replace', n);
    else if (DEFAULT_RE.test(t)) add('default_value', n);
    else if (ALTERNATE_RE.test(t)) add('alternate_value', n);
    else if (ASSIGN_DEFAULT_RE.test(t)) add('assign_default', n);
    else if (STRIP_PREFIX_RE.test(t)) add('strip_prefix', n);
    else if (STRIP_SUFFIX_RE.test(t)) add('strip_suffix', n);
    if (nounset) {
      if (!positionalSet && WHOLE_POSITIONAL_RE.test(t)) add('set_u_empty_at', n);
      // a bare "${arr[@]}" only; "${arr[@]:-}" and ${arr[@]+"${arr[@]}"} are the bash-3.2-safe spellings, and an array
      // assigned a literal with elements is not empty
      const whole = WHOLE_ARRAY_RE.exec(t);
      if (whole && !literalArrays.has(whole[1]!)) {
        const guard = new RegExp(String.raw`^\$\{${whole[1]}\[[@*]\]:?\+`);
        let guarded = false;
        for (let p = n.parent; p; p = p.parent) if (p.type === 'expansion' && guard.test(p.text.trimStart())) { guarded = true; break; }
        if (!guarded) add('set_u_empty_array', n);
      }
    }
    const name = n.descendantsOfType('variable_name')[0]?.text;
    if (name === 'PIPESTATUS') add('pipestatus_upper', n);
    else if (name === 'BASH_SOURCE') add('bash_source', n);
    else if (name === 'FUNCNAME') add('funcname', n);
    else if (name === 'RANDOM') add('random', n);
    else if (name === 'EPOCHSECONDS') add('epochseconds', n);
    else if (name === 'BASH_REMATCH') add('bash_rematch', n);
    else if (name === 'HOSTNAME') add('hostname_var', n);
    else if (name === 'EUID') add('euid_var', n);
    else if (name === 'SECONDS') add('seconds_var', n);
    else if (name === 'OSTYPE') add('ostype_var', n);
  }
  for (const n of root.descendantsOfType('simple_expansion')) {
    const name = n.text.trimStart().slice(1);
    if (name === 'RANDOM') add('random', n);
    else if (name === 'EPOCHSECONDS') add('epochseconds', n);
    else if (name === 'BASH_REMATCH') add('bash_rematch', n);
    else if (name === 'HOSTNAME') add('hostname_var', n);
    else if (name === 'EUID') add('euid_var', n);
    else if (name === 'SECONDS') add('seconds_var', n);
    else if (name === 'OSTYPE') add('ostype_var', n);
    else if (name === '?') {
      // `$?` in the statement right after a pipeline reports the pipeline's last command
      if (previousStatement(n)?.type === 'pipeline') add('last_pipe_status', n);
    }
    if (nounset && !positionalSet && (name === '@' || name === '*')) {
      // ${1+"$@"} and its siblings are the guards written for bash 3.2; the "$@" inside them is never the empty case
      let guarded = false;
      for (let p = n.parent; p; p = p.parent) if (p.type === 'expansion' && POSITIONAL_GUARD_RE.test(p.text.trimStart())) { guarded = true; break; }
      if (!guarded) add('set_u_empty_at', n);
    }
  }
  for (const n of root.descendantsOfType('process_substitution')) add('process_subst', n);
  for (const n of root.descendantsOfType('herestring_redirect')) add('here_string', n);
  for (const n of root.descendantsOfType('brace_expression')) add('brace_expand', n);
  for (const n of root.descendantsOfType('ansi_c_string')) add('dollar_quote', n);
  for (const n of root.descendantsOfType('command_substitution')) if (n.text.startsWith('`')) add('backticks', n);
  for (const n of root.descendantsOfType('subshell')) add('subshell_scope', n);
  for (const n of root.descendantsOfType('negated_command')) add('negation', n);
  for (const n of root.descendantsOfType('c_style_for_statement')) add('c_style_for', n);
  for (const n of root.descendantsOfType('while_statement')) if (n.text.startsWith('until')) add('until_loop', n);
  for (const n of root.descendantsOfType('case_statement')) add('case_basic', n);
  for (const n of root.descendantsOfType('case_item')) {
    const t = n.text.trimEnd();
    if (t.endsWith(';;&')) add('case_fallthrough_test', n);
    else if (t.endsWith(';&')) add('case_fallthrough_amp', n);
  }
  // `@(a|b)`, `!(x)`, `+(y)`: the grammar emits extglob_pattern for every case pattern, so keep the real extglob syntax only
  for (const n of root.descendantsOfType('extglob_pattern')) if (/[@+?!*]\(/.test(n.text)) add('shopt_extglob', n);
  for (const n of root.descendantsOfType('arithmetic_expansion')) {
    const t = arithText(n);
    const power = t.includes('**'), lz08 = LEADING_08_RE.test(t), octal = !lz08 && OCTAL_RE.test(t), div0 = DIV_ZERO_RE.test(t), baseN = BASE_N_RE.test(t);
    if (power) add('power_arith', n);
    if (octal) add('octal_literal', n);
    if (lz08) add('leading_zero_08', n);
    if (div0) add('div_zero', n);
    if (baseN) add('base_n_literal', n);
    if (!power && !octal && !lz08 && !div0 && !baseN) add('arith_basic', n);
  }
  // a standalone (( )) is a compound_statement in this grammar, not a test_command
  for (const n of root.descendantsOfType('compound_statement')) {
    if (!n.text.startsWith('((')) continue;
    add('paren_arith', n);
    const t = arithText(n);
    if (LEADING_08_RE.test(t)) add('leading_zero_08', n);
    if (DIV_ZERO_RE.test(t)) add('div_zero', n);
    if (BASE_N_RE.test(t)) add('base_n_literal', n);
  }
  for (const n of root.descendantsOfType('test_command')) {
    const t = n.text;
    if (t.startsWith('[[')) {
      add('double_bracket', n);
      if (/\s=~\s/.test(t)) add('regex_match', n);
      if (/\[\[\s+-v\s/.test(t)) add('test_v', n);
      const binaries = n.descendantsOfType('binary_expression');
      if (binaries.some((b) => { const op = b.childForFieldName('operator')?.text; return op === '&&' || op === '||'; })) add('dbl_bracket_and', n);
      // `[[ $x != h* ]]`: an unquoted glob on the right is a pattern (`==` with a pattern is the double_bracket probe itself)
      if (binaries.some((b) => { const r = b.childForFieldName('right'); return b.childForFieldName('operator')?.text === '!=' && !!r && (r.type === 'extglob_pattern' || (r.type === 'word' && /[*?[]/.test(r.text))); })) add('dbl_bracket_neq_pattern', n);
    } else if (t.startsWith('[')) {
      if (/\s==\s/.test(t)) add('single_bracket_eqeq', n);
      if (/^\[\s+-[nz]\s/.test(t)) add('test_n_z', n);
      if (/^\[\s+-t\s/.test(t)) add('test_t', n);
    }
  }
  for (const n of root.descendantsOfType('function_definition')) {
    if (/^function\s/.test(n.text)) add('function_keyword', n);
    else add('function_posix', n);
  }
  for (const n of root.descendantsOfType('variable_assignment')) {
    const t = n.text;
    const name = n.childForFieldName('name');
    const value = n.childForFieldName('value');
    if (/^[A-Za-z_]\w*\+=\(/.test(t)) add('array_append', n);
    else if (/^[A-Za-z_]\w*(\[[^\]]*\])?\+=/.test(t) && value?.type !== 'array') add('string_append', n);
    // a literal, non-empty IFS set for the rest of the script changes how unquoted expansions split;
    // `IFS=: read ...` is scoped to that one command, `IFS=$OLD_IFS` / `IFS=` restore or switch splitting off, and `IFS=$' \t\n'` is the default
    if (name?.type === 'variable_name' && name.text === 'IFS' && value && n.parent?.type !== 'command' && isLiteralNonEmpty(value) && !isDefaultIfs(value)) add('ifs_split', n);
  }
  // `local`, `declare`, `export`, `readonly` and `typeset` are declaration_commands, not commands, in this grammar
  for (const n of root.descendantsOfType('declaration_command')) {
    const first = firstWordOf(n);
    const letters = leadingOptionLetters(n);
    const assigns = n.namedChildren.filter((c): c is TSNode => !!c && c.type === 'variable_assignment');
    const masksStatus = assigns.some(valueRunsCommand);
    if (first === 'declare' || first === 'typeset') {
      if (letters.includes('A')) add('assoc_declare', n);
      if (letters.includes('n')) add('declare_n', n);
      if (letters.includes('g')) add('declare_g', n);
      if (letters.includes('a')) add('declare_a', n);
      if (letters.includes('i')) add('declare_i', n);
      if (letters.includes('x')) add('declare_x', n);
      if (letters.includes('p')) add('declare_p', n);
      if (letters.includes('F')) add('declare_upper_f', n);
      // `declare -r` declares a variable read-only; re-assigning one (readonly_assign) is not visible in the parse tree
      if (letters.includes('r')) add('readonly_declare', n);
      if (first === 'typeset') add('typeset_builtin', n);
      if (masksStatus && insideFunction(n)) add('local_masks_status', n);
    } else if (first === 'export') {
      if (letters.includes('f')) add('export_f', n);
      else if (assigns.length) add('export_assign', n);
      if (masksStatus) add('export_masks_status', n);
    } else if (first === 'local') {
      if (insideFunction(n)) add('local_in_func', n); else add('local_outside', n);
      // macOS bash 3.2 rejects `local -A` exactly as it rejects `declare -A`
      if (letters.includes('A')) add('assoc_declare', n);
      if (letters.includes('a')) add('declare_a', n);
      if (letters.includes('i')) add('declare_i', n);
      if (letters.includes('r')) add('readonly_declare', n);
      if (masksStatus) add('local_masks_status', n);
    } else if (first === 'readonly') add('readonly_declare', n);
  }
  for (const n of root.descendantsOfType('unset_command')) {
    const t = n.text;
    if (/^unset\s+-[a-z]*v\b/.test(t)) add('unset_v', n);
    if (/^unset\s+-[a-z]*f\b/.test(t)) add('unset_f', n);
    if (/^unset(?:\s+-\w+)*\s+["']?[A-Za-z_]\w*\[/.test(t)) add('unset_array_element', n);
  }
  for (const n of root.descendantsOfType('command')) {
    const name = n.childForFieldName('name')?.text ?? '';
    const args = n.childrenForFieldName('argument').filter((a): a is TSNode => !!a);
    const argText = args.map((a) => a.text);
    const has = (re: RegExp) => argText.some((a) => re.test(a));
    switch (name) {
      case 'mapfile': case 'readarray': add('mapfile', n); break;
      case 'shopt': {
        let specific = false;
        if (argText.includes('nullglob')) { add('shopt_nullglob', n); specific = true; }
        if (argText.includes('extglob')) { add('shopt_extglob', n); specific = true; }
        if (argText.includes('globstar')) { add('shopt_globstar', n); specific = true; }
        if (!specific) add('shopt', n);
        break;
      }
      case 'let': add('let_builtin', n); break;
      case 'compgen': add('compgen', n); break;
      case 'complete': add('complete_builtin', n); break;
      case 'coproc': add('coproc', n); break;
      case 'source': add('source_keyword', n); break;
      case '.': add('source_dot', n); break;
      case 'alias': add('alias_in_script', n); break;
      case 'eval': add('eval_basic', n); break;
      case 'caller': add('caller_builtin', n); break;
      case 'builtin': add('builtin_keyword', n); break;
      case 'pushd': case 'popd': case 'dirs': add('pushd_popd', n); break;
      case 'getopts': add('getopts', n); break;
      case 'hash': if (has(/^-[a-z]*r/)) add('hash_r', n); break;
      case 'wait': if (has(/^-[a-zA-Z]*n/)) add('wait_n', n); break;
      case 'command': if (argText[0] && /^-\w*v/.test(argText[0])) add('command_v', n); break;
      case 'shift': if (args.length) add('shift_n', n); break;
      case 'trap': {
        // `trap - EXIT` resets the trap; there is no handler to run
        if (argText[0] === '-') break;
        if (argText.includes('EXIT') || argText.includes('0')) add(insideFunction(n) ? 'trap_exit_in_function' : 'trap_exit', n);
        if (argText.includes('ERR')) add('trap_err', n);
        break;
      }
      case 'test': {
        if (argText[0] === '-n' || argText[0] === '-z') add('test_n_z', n);
        if (argText[0] === '-t') add('test_t', n);
        break;
      }
      case 'read': {
        if (has(/^-\w*a/)) add('read_a', n);
        if (has(/^-\w*p/)) add('read_p', n);
        if (has(/^-\w*r/)) add('read_r', n);
        if (has(/^-[a-zA-Z]*N/)) add('read_upper_n', n);
        if (has(/^-[a-zA-Z]*n\d*$/)) add('read_n', n);
        // -d: the delimiter is the rest of the word or the next argument; an empty one reads to NUL
        const di = argText.findIndex((a) => /^-[a-zA-Z]*d/.test(a));
        if (di >= 0) {
          const attached = argText[di]!.replace(/^-[a-zA-Z]*d/, '');
          const delim = attached || argText[di + 1] || '';
          if (/^(''|"")$/.test(delim)) add('read_d_null', n); else add('read_d', n);
        }
        // no NAME operand left after the options and their values: the line lands in REPLY
        const operands: string[] = [];
        for (let i = 0; i < argText.length; i++) {
          const a = argText[i]!;
          if (/^-[a-zA-Z]+$/.test(a)) { if (/[dnNtuipa]$/.test(a)) i++; continue; }
          if (/^-[a-zA-Z]*[dnNtuipa]/.test(a)) continue;
          operands.push(a);
        }
        if (!operands.length && !has(/^-\w*a/)) add('read_reply', n);
        break;
      }
      case 'printf': {
        let specific = false;
        if (has(/^-v$/)) { add('printf_v', n); specific = true; }
        if (has(/%-?\d*q/)) { add('printf_q', n); specific = true; }
        if (has(/%\([^)]*\)T/)) { add('printf_time', n); specific = true; }
        // plain `printf '%s\n'` is everywhere; the probe is about width, alignment and zero padding
        const fmt = argText.find((a) => a.includes('%'));
        if (!specific && fmt && (/%[-+ 0#]*\d/.test(fmt) || /%\.\d/.test(fmt))) add('printf_basic', n);
        break;
      }
      case 'echo': {
        // only the leading run of -n/-e/-E words are options; `echo foo -e` and `echo -- -e` print them
        let opts = '', nOpts = 0;
        for (const a of argText) { if (!/^-[neE]+$/.test(a)) break; opts += a.slice(1); nOpts++; }
        if (opts.includes('e')) add('echo_dash_e', n);
        if (opts.includes('n')) add('echo_dash_n', n);
        // escapes are interpreted when the last of -e/-E is -e; otherwise every backslash echo receives is printed
        const interprets = opts.replace(/[^eE]/g, '').endsWith('e');
        if (!interprets && args.slice(nOpts).some(echoSeesBackslash)) add('echo_backslash', n);
        break;
      }
      case 'set': {
        if (argText.join(' ').includes('pipefail')) add('pipefail', n);
        // `set -u`, `set -euo pipefail` and `set -o nounset` all turn the option on; whether a variable is unset is not decidable here
        const letters = optionLetters(argText);
        let nounsetHere = letters.includes('u');
        for (let i = 0; i < argText.length; i++) { if (argText[i] === '--') break; if (argText[i] === '-o' && argText[i + 1] === 'nounset') nounsetHere = true; }
        if (nounsetHere) add('set_o_nounset', n);
        // `set -e` / `set -o errexit`: the option itself; the function-under-|| case is judged separately
        let errexitHere = letters.includes('e');
        for (let i = 0; i < argText.length; i++) { if (argText[i] === '--') break; if (argText[i] === '-o' && argText[i + 1] === 'errexit') errexitHere = true; }
        if (errexitHere) add('set_e_basic', n);
        break;
      }
      case 'type': if (has(/^-\w*t/)) add('type_t', n); if (has(/^-[A-Za-z]*P/)) add('type_upper_p', n); break;
      case 'local': if (!insideFunction(n)) add('local_outside', n); break;
    }
    // an unquoted $var as a whole argument is split into words by bash and not by zsh; `$?`, `$$`, `$#`, `$0`... hold nothing to split
    for (const a of args) if (a.type === 'simple_expansion' && splittable(a)) add('word_split', a);
    // an unquoted glob that matches nothing stays literal in bash and is an error in zsh
    for (const a of args) if (a.type === 'word' && /[*?]/.test(a.text) && !/^-/.test(a.text)) add('glob_nomatch', a);
    // a `**` path component only recurses with globstar on
    for (const a of args) if (a.type === 'word' && GLOBSTAR_RE.test(a.text)) add('shopt_globstar', a);
  }
  for (const n of root.descendantsOfType('pipeline')) {
    const last = n.namedChildren[n.namedChildren.length - 1];
    if (last?.type === 'command' && last.childForFieldName('name')?.text === 'read') add('pipe_read', last);
    // `cmd | while read -r line; do ...; done`: the whole loop, and every variable it sets, lives in the subshell
    if (last?.type === 'while_statement') {
      const read = last.childrenForFieldName('condition').find((c) => !!c && c.type === 'command' && c.childForFieldName('name')?.text === 'read');
      if (read) add('pipe_read', read);
    }
    if (n.children.some((c) => c?.type === '|&')) add('pipe_both', n);
  }
  for (const n of root.descendantsOfType('file_redirect')) {
    const t = n.text;
    const dest = n.childForFieldName('destination');
    if (/^\d*>&\d+$/.test(t)) add('fd_dup', n);
    else if (t.startsWith('&>') || (t.startsWith('>&') && dest?.type === 'word' && dest.text !== '-')) add('amp_redirect', n);
  }
  for (const n of root.descendantsOfType('for_statement')) {
    for (const w of n.childrenForFieldName('value')) {
      if (!w) continue;
      // an unquoted glob among the words (`*.txt`, "$dir"/*.log): no match leaves the pattern in bash, errors in zsh
      const globWords = w.type === 'word' ? [w] : w.type === 'concatenation' ? w.namedChildren.filter((c): c is TSNode => !!c && c.type === 'word') : [];
      if (globWords.some((g) => /[*?[]/.test(g.text))) add('glob_nomatch_for', w);
      if (w.type === 'word' && GLOBSTAR_RE.test(w.text)) add('shopt_globstar', w);
      // `for f in $files` relies on word splitting just as an unquoted argument does
      if (w.type === 'simple_expansion' && splittable(w)) add('word_split', w);
    }
  }
  // under set -e, `f || true` runs f with errexit switched off
  if (errexit) {
    for (const n of root.descendantsOfType('list')) {
      const first = n.namedChildren[0];
      const op = n.children.find((c) => c?.type === '||' || c?.type === '&&');
      if (op && first?.type === 'command' && funcNames.has(first.childForFieldName('name')?.text ?? '')) add('set_e_function_or', n);
    }
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
    const text = h.text ?? h.node.text;
    // a node the grammar cut short carries its full text; it never spans a line, so its end is on the start row
    const end = h.text ? { row: h.node.startPosition.row, column: h.node.startPosition.column + h.text.length } : h.node.endPosition;
    out.push({
      probe: h.probe, label: rec.label, snippet: rec.snippet, text: text.length > 80 ? text.slice(0, 77) + '…' : text,
      start: pos(h.node.startPosition), end: pos(end),
      verdicts: targets.map((t) => judgeConstruct(db, h.probe, t)),
    });
  }
  out.sort((a, b) => a.start.row - b.start.row || a.start.column - b.start.column);
  return out;
}
