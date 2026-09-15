/**
 * Counts, over a corpus of real shell scripts, which bash constructs scripts actually use and which of
 * them the shell probes (collector/shells/probes.txt) already measure.
 *
 *   npx tsx scripts/corpus-scan.ts <corpus dir> [report.json]
 *
 * <corpus dir> holds one checkout per repository in collector/shells/corpus.txt (see README, "Run it
 * locally"). Every *.sh / *.bash file and every extensionless file with a sh/bash shebang is parsed with
 * tree-sitter-bash; zsh files and files the parser cannot make sense of are skipped and counted.
 *
 * The unit is "files that use the construct at least once", not raw occurrences: a 5,000-line script
 * that uses `[[ ]]` 400 times counts once, the same as a 20-line installer that uses it once.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Parser, Language, type Node as TSNode } from 'web-tree-sitter';
import { findConstructs } from '../src/engine/shells.js';

interface Feature { id: string; files: Set<string>; count: number; example?: string; probe: string | null }

const corpusDir = process.argv[2];
if (!corpusDir) { console.error('usage: corpus-scan.ts <corpus dir> [report.json]'); process.exit(2); }
const reportPath = process.argv[3] ?? path.join(corpusDir, 'corpus-report.json');

const MAX_BYTES = 400_000;
const features = new Map<string, Feature>();
const repos = new Set<string>();
let skippedZsh = 0, skippedBinary = 0, skippedParse = 0, skippedBig = 0;

function hit(id: string, file: string, node?: TSNode, probe: string | null = null): void {
  let f = features.get(id);
  if (!f) { f = { id, files: new Set(), count: 0, probe }; features.set(id, f); }
  f.files.add(file); f.count++;
  if (probe) f.probe = probe;
  if (!f.example && node) f.example = `${file}:${node.startPosition.row + 1}: ${node.text.split('\n')[0]!.trim().slice(0, 100)}`;
}

/** Which files are shell scripts: by extension, or by shebang for extensionless files. */
function collect(dir: string, repo: string, out: { file: string; repo: string }[]): void {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'vendor' || name === 'third_party' || name === 'testdata') continue;
    const p = path.join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { collect(p, repo, out); continue; }
    if (!st.isFile()) continue;
    const ext = path.extname(name);
    if (ext === '.zsh') { skippedZsh++; continue; }
    if (ext === '.sh' || ext === '.bash') { out.push({ file: p, repo }); continue; }
    if (ext !== '' || st.size > MAX_BYTES) continue;
    let head: string; try { head = readFileSync(p, { encoding: 'utf8', flag: 'r' }).slice(0, 200); } catch { continue; }
    if (/^#!.*\b(bash|sh|dash)\b/.test(head.split('\n')[0] ?? '')) out.push({ file: p, repo });
    else if (/^#!.*\bzsh\b/.test(head)) skippedZsh++;
  }
}

// short flags of a builtin, one entry per letter (`-rp` -> r, p); long options whole
function flagsOf(args: TSNode[]): string[] {
  const out: string[] = [];
  for (const a of args) {
    const t = a.text;
    if (t === '--') break;
    if (/^--[a-z]/.test(t)) out.push(t.split('=')[0]!);
    else if (/^-[A-Za-z]+$/.test(t)) for (const ch of t.slice(1)) out.push('-' + ch);
    else if (/^[-+]o$/.test(t)) { /* handled by the caller (set -o name) */ }
  }
  return out;
}

const FLAG_BUILTINS = new Set(['read', 'declare', 'typeset', 'local', 'export', 'printf', 'echo', 'set', 'shopt', 'trap', 'type', 'command', 'unset', 'wait', 'kill', 'exec', 'cd', 'pwd', 'hash', 'ulimit', 'umask', 'getopts', 'mapfile', 'readarray', 'compgen', 'complete', 'source', 'test', 'let', 'caller', 'enable', 'builtin', 'jobs', 'disown', 'history', 'bind', 'pushd', 'popd', 'dirs', 'shift', 'return', 'exit', 'eval', 'alias', 'unalias', 'readonly', 'help', 'times']);
const BASH_BUILTINS_NOT_POSIX = new Set(['mapfile', 'readarray', 'declare', 'typeset', 'local', 'shopt', 'let', 'compgen', 'complete', 'compopt', 'caller', 'enable', 'builtin', 'disown', 'bind', 'pushd', 'popd', 'dirs', 'help', 'source', 'coproc', 'select', 'time', 'suspend', 'logout', 'printf']);
const SPECIAL_VARS = new Set(['RANDOM', 'SRANDOM', 'EPOCHSECONDS', 'EPOCHREALTIME', 'SECONDS', 'LINENO', 'BASH_SOURCE', 'FUNCNAME', 'PIPESTATUS', 'BASHPID', 'BASH_VERSION', 'BASH_VERSINFO', 'BASH_REMATCH', 'BASH_LINENO', 'BASH_COMMAND', 'BASH_SUBSHELL', 'BASH_ALIASES', 'BASH_CMDS', 'BASH_ARGV', 'BASH_ARGC', 'BASH_ENV', 'BASH_XTRACEFD', 'BASH_ARGV0', 'BASH_LOADABLES_PATH', 'OSTYPE', 'MACHTYPE', 'HOSTTYPE', 'HOSTNAME', 'UID', 'EUID', 'PPID', 'SHLVL', 'COLUMNS', 'LINES', 'OLDPWD', 'REPLY', 'OPTIND', 'OPTARG', 'OPTERR', 'IFS', 'PS4', 'PROMPT_COMMAND', 'COMP_WORDS', 'COMP_CWORD', 'COMPREPLY', 'COMP_LINE', 'COMP_POINT', 'GROUPS', 'DIRSTACK', 'HISTFILE', 'TMOUT', 'SHELLOPTS', 'BASHOPTS', 'ZSH_VERSION', 'KSH_VERSION']);

function scanFile(tree: { rootNode: TSNode }, file: string): void {
  const root = tree.rootNode;
  // 1. what the existing probes already see
  for (const h of findConstructs(tree as never)) hit(`probe:${h.probe}`, file, h.node as never, h.probe);

  // 2. the wider catalogue
  const walk = (n: TSNode): void => {
    switch (n.type) {
      case 'expansion': {
        const t = n.text;
        if (/^\$\{#[A-Za-z_][A-Za-z0-9_]*\}$/.test(t)) hit('exp:length ${#x}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?:-/.test(t)) hit('exp:default ${x:-d}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?:=/.test(t)) hit('exp:assign-default ${x:=d}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?:\?/.test(t)) hit('exp:error-if-unset ${x:?}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?:\+/.test(t)) hit('exp:alternate ${x:+y}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?##?[^}]/.test(t)) hit('exp:strip-prefix ${x#p}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?%%?[^}]/.test(t)) hit('exp:strip-suffix ${x%p}', file, n);
        if (/^\$\{!?[A-Za-z_][A-Za-z0-9_]*\[[@*]\]\}$/.test(t) && t.startsWith('${!')) hit('exp:array-keys ${!arr[@]}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\[[@*]\]:/.test(t)) hit('exp:array-slice ${arr[@]:n}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\[-\d+\]\}$/.test(t)) hit('exp:negative-index ${arr[-1]}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\[\*\]\}$/.test(t)) hit('exp:array-star ${arr[*]}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\[[^@*\]]+\]\}$/.test(t) && !/^\$\{[A-Za-z_][A-Za-z0-9_]*\[\d+\]\}$/.test(t)) hit('exp:array-expr-index ${arr[$i]}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*@[a-zA-Z]\}$/.test(t)) hit(`exp:at-operator ${t.replace(/^\$\{[A-Za-z_][A-Za-z0-9_]*/, '${x')}`, file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\^\}$/.test(t)) hit('exp:capitalize ${x^}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*,\}$/.test(t)) hit('exp:lower-first ${x,}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*~~?\}$/.test(t)) hit('exp:toggle-case ${x~}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\/#/.test(t)) hit('exp:replace-prefix ${x/#p/r}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\/%/.test(t)) hit('exp:replace-suffix ${x/%p/r}', file, n);
        if (/^\$\{[A-Za-z_][A-Za-z0-9_]*:\s*-\d/.test(t) || /^\$\{[A-Za-z_][A-Za-z0-9_]*:\d+:-\d/.test(t)) hit('exp:negative-substring ${x: -n}', file, n);
        const name = n.descendantsOfType('variable_name')[0]?.text ?? n.descendantsOfType('special_variable_name')[0]?.text;
        if (name && SPECIAL_VARS.has(name)) hit(`var:$${name}`, file, n);
        break;
      }
      case 'simple_expansion': {
        const name = n.text.slice(1);
        if (SPECIAL_VARS.has(name)) hit(`var:$${name}`, file, n);
        if (name === '-') hit('var:$-', file, n);
        if (name === '_') hit('var:$_', file, n);
        break;
      }
      case 'translated_string': hit('quote:locale $"..."', file, n); break;
      case 'ansi_c_string': hit("quote:ansi-c $'..'", file, n); break;
      case 'command_substitution': if (n.text.startsWith('`')) hit('subst:backticks', file, n); break;
      case 'arithmetic_expansion': {
        const t = n.text;
        if (/\*\*/.test(t)) hit('arith:power **', file, n);
        if (/\+\+|--/.test(t)) hit('arith:increment ++/--', file, n);
        if (/\?.*:/.test(t)) hit('arith:ternary ?:', file, n);
        if (/\b0x[0-9a-fA-F]/.test(t)) hit('arith:hex 0x', file, n);
        if (/\b\d+#[0-9a-zA-Z]/.test(t)) hit('arith:base n#', file, n);
        if (/[-+*/%&|^]=[^=]/.test(t)) hit('arith:compound-assign +=', file, n);
        if (/<<|>>/.test(t)) hit('arith:shift <<', file, n);
        if (t.startsWith('$[')) hit('arith:old $[ ]', file, n);
        hit('arith:$(( ))', file, n);
        break;
      }
      case 'compound_statement': if (n.text.startsWith('((')) hit('arith:(( )) command', file, n); break;
      case 'c_style_for_statement': hit('loop:for (( ; ; ))', file, n); break;
      case 'while_statement': if (n.text.startsWith('until')) hit('loop:until', file, n); break;
      case 'case_item': { const t = n.text.trimEnd(); if (t.endsWith(';;&')) hit('case:;;& fallthrough-test', file, n); else if (t.endsWith(';&')) hit('case:;& fallthrough', file, n); break; }
      case 'pipeline': if (/\|&/.test(n.text)) hit('pipe:|&', file, n); break;
      case 'negated_command': hit('pipe:! negation', file, n); break;
      case 'file_redirect': {
        const t = n.text;
        if (/^&>>/.test(t)) hit('redir:&>>', file, n); else if (/^&>/.test(t)) hit('redir:&>', file, n);
        if (/^\d*<>/.test(t)) hit('redir:<> read-write', file, n);
        if (/^>\|/.test(t)) hit('redir:>| noclobber-override', file, n);
        if (/^\{[A-Za-z_]\w*\}[<>]/.test(t)) hit('redir:{fd}> auto-fd', file, n);
        if (/^\d+[<>]&\d+-/.test(t)) hit('redir:n>&m- move-fd', file, n);
        if (/^[<>]&\d+$|^\d+>&\d+$/.test(t)) hit('redir:>&n dup', file, n);
        if (/^\d*<\/dev\/(tcp|udp)\//.test(t) || /^\d*>\/dev\/(tcp|udp)\//.test(t)) hit('redir:/dev/tcp', file, n);
        if (/^[<>]{1,2}\s*\/dev\/stderr$/.test(t)) hit('redir:/dev/stderr', file, n);
        break;
      }
      case 'heredoc_redirect': if (n.text.startsWith('<<-')) hit('redir:<<- heredoc-tabs', file, n); break;
      case 'process_substitution': if (n.text.startsWith('>(')) hit('subst:>( ) output', file, n); break;
      case 'extglob_pattern': if (/[@+?!*]\(/.test(n.text)) hit('glob:extglob @(..)', file, n); break;
      case 'brace_expression': { const t = n.text; if (/\.\./.test(t)) hit(/\d\.\.\d/.test(t) && /\{0\d/.test(t) ? 'glob:brace-seq-zeropad {01..10}' : 'glob:brace-seq {1..5}', file, n); break; }
      case 'word': {
        const t = n.text;
        if (/(^|\/)\*\*(\/|$)/.test(t)) hit('glob:globstar **', file, n);
        if (/\[\[:[a-z]+:\]\]/.test(t)) hit('glob:char-class [[:alpha:]]', file, n);
        if (/^~[A-Za-z]/.test(t)) hit('glob:tilde-user ~name', file, n);
        break;
      }
      case 'variable_assignment': {
        const t = n.text;
        if (/^[A-Za-z_]\w*\+=\(/.test(t)) hit('array:append +=( )', file, n);
        else if (/^[A-Za-z_]\w*\+=/.test(t)) hit('assign:string-append +=', file, n);
        if (/^[A-Za-z_]\w*=\(\s*\[/.test(t)) hit('array:assoc-literal ([k]=v)', file, n);
        if (/^[A-Za-z_]\w*\[[^\]]+\]=/.test(t)) hit('array:element-assign arr[i]=', file, n);
        break;
      }
      case 'test_command': {
        const t = n.text;
        const dbl = t.startsWith('[[');
        for (const op of ['-nt', '-ot', '-ef', '-N', '-k', '-G', '-O', '-S', '-p', '-b', '-c', '-g', '-u', '-t', '-o', '-R', '-a', '-h', '-L']) if (new RegExp(`\\s${op}\\s`).test(t)) hit(`test:${dbl ? '[[' : '['} ${op}`, file, n);
        if (dbl && /\s[<>]\s/.test(t)) hit('test:[[ < string-compare', file, n);
        if (dbl && /&&|\|\|/.test(t)) hit('test:[[ && ||', file, n);
        if (!dbl && /\s-a\s|\s-o\s/.test(t) && /\s-[a-zA-Z]\s.*\s-[ao]\s/.test(t)) hit('test:[ -a/-o combined', file, n);
        if (dbl && /\s!=\s/.test(t)) hit('test:[[ != pattern', file, n);
        if (!dbl && /\s=~\s/.test(t)) hit('test:[ =~ (invalid)', file, n);
        break;
      }
      case 'function_definition': if (!/^function\s/.test(n.text)) hit('func:name()', file, n); break;
      case 'unset_command': { const f = flagsOf(n.namedChildren.filter((c): c is TSNode => !!c && c.type === 'word')); for (const x of f) hit(`builtin:unset ${x}`, file, n); if (/\[/.test(n.text)) hit('builtin:unset arr[i]', file, n); break; }
      case 'declaration_command': {
        const name = n.text.split(/\s+/, 1)[0]!;
        const f = flagsOf(n.namedChildren.filter((c): c is TSNode => !!c && c.type === 'word'));
        hit(`builtin:${name}`, file, n);
        for (const x of f) hit(`builtin:${name} ${x}`, file, n);
        if (name === 'local' && /=\$\(/.test(n.text)) hit('builtin:local x=$(cmd) masks-status', file, n);
        break;
      }
      case 'command': {
        const name = n.childForFieldName('name')?.text ?? '';
        const args = n.childrenForFieldName('argument').filter((a): a is TSNode => !!a);
        const argText = args.map((a) => a.text);
        if (BASH_BUILTINS_NOT_POSIX.has(name) || name === 'select' || name === 'time' || name === 'coproc') hit(`builtin:${name}`, file, n);
        if (FLAG_BUILTINS.has(name)) {
          for (const x of flagsOf(args)) hit(`builtin:${name} ${x}`, file, n);
          if (name === 'set' || name === 'shopt') {
            for (let i = 0; i < argText.length; i++) {
              const a = argText[i]!;
              if ((a === '-o' || a === '+o') && argText[i + 1]) hit(`builtin:set -o ${argText[i + 1]}`, file, n);
              else if (name === 'shopt' && /^[a-z_]+$/.test(a)) hit(`builtin:shopt ${a}`, file, n);
            }
            if (name === 'set' && argText.includes('--')) hit('builtin:set -- positional', file, n);
          }
          if (name === 'trap') for (const a of argText.slice(1)) if (/^(SIG)?[A-Z]+\d?$|^\d+$/.test(a.replace(/['"]/g, ''))) hit(`builtin:trap ${a.replace(/['"]/g, '')}`, file, n);
          if (name === 'printf') { const fmt = argText.find((a) => /%/.test(a)); if (fmt) { if (/%q/.test(fmt)) hit('builtin:printf %q', file, n); if (/%\(/.test(fmt)) hit('builtin:printf %(fmt)T', file, n); if (/%b/.test(fmt)) hit('builtin:printf %b', file, n); if (/%\d*\$/.test(fmt)) hit('builtin:printf %1$s positional', file, n); } }
          if (name === 'command' && argText[0] === '-v') hit('builtin:command -v', file, n);
          if (name === 'exec' && argText.length === 0) hit('builtin:exec redirect-only', file, n);
          if (name === 'cd' && argText[0] === '-') hit('builtin:cd -', file, n);
          if (name === 'kill' && argText.some((a) => /^-(s|n|l)$|^-[A-Z]+$|^-\d+$/.test(a))) hit('builtin:kill -SIG', file, n);
          if (name === 'wait' && argText.some((a) => /^\$!$/.test(a))) hit('builtin:wait $!', file, n);
          if (name === 'echo' && argText.some((a) => /\\[ntre]/.test(a))) hit('builtin:echo with-backslashes', file, n);
          if (name === 'shift' && argText.length) hit('builtin:shift n', file, n);
          if (name === 'exit' && argText.some((a) => /^\$\?$/.test(a))) hit('builtin:exit $?', file, n);
          if (name === 'eval') hit('builtin:eval', file, n);
        }
        if (name === 'sudo' || name === 'env') hit(`wrapper:${name}`, file, n);
        break;
      }
      case 'subshell': hit('compound:( ) subshell', file, n); break;
      case 'ERROR': break;
    }
    for (const c of n.namedChildren) if (c) walk(c);
  };
  walk(root);
}

await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm')));

// one directory per repository: a `git clone` (with .git) or an unpacked archive, either will do
const files: { file: string; repo: string }[] = [];
for (const repo of readdirSync(corpusDir).sort()) {
  const d = path.join(corpusDir, repo);
  if (!statSync(d).isDirectory()) continue;
  collect(d, repo, files);
}
let parsed = 0;
for (const { file, repo } of files) {
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { skippedBinary++; continue; }
  if (src.length > MAX_BYTES) { skippedBig++; continue; }
  if (/\u0000/.test(src)) { skippedBinary++; continue; }
  const tree = parser.parse(src);
  if (!tree) { skippedParse++; continue; }
  const root = tree.rootNode;
  const errors = root.descendantsOfType('ERROR').length;
  const nodes = root.descendantCount;
  if (nodes < 5 || errors > 3 + nodes / 40) { skippedParse++; continue; }
  const rel = `${repo}/${path.relative(path.join(corpusDir, repo), file).replace(/\\/g, '/')}`;
  scanFile(tree, rel);
  repos.add(repo);
  parsed++;
}

const rows = [...features.values()].map((f) => ({ id: f.id, files: f.files.size, share: +(100 * f.files.size / parsed).toFixed(1), count: f.count, probe: f.probe, example: f.example })).sort((a, b) => b.files - a.files || a.id.localeCompare(b.id));
const report = { generated_at: new Date().toISOString(), repos: repos.size, files_scanned: parsed, skipped: { zsh: skippedZsh, binary: skippedBinary, parse: skippedParse, big: skippedBig }, features: rows };
writeFileSync(reportPath, JSON.stringify(report, null, 1) + '\n');
console.log(`${parsed} scripts from ${repos.size} repos (skipped: ${skippedZsh} zsh, ${skippedParse} unparseable, ${skippedBinary} binary, ${skippedBig} too big) -> ${reportPath}`);
console.log(`${rows.length} features seen; ${rows.filter((r) => r.probe).length} map to an existing probe`);
