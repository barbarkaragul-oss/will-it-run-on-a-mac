import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import type { ShellsDatabase } from '../scripts/extract-shells.js';
import { detectShebang, targetsFor, findConstructs, analyzeShells, judgeConstruct, REFERENCE } from '../src/engine/shells.js';

let parser: Parser;
before(async () => {
  await Parser.init();
  const lang = await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm'));
  parser = new Parser();
  parser.setLanguage(lang);
});

// A slice of the 2026-09-15 recording (run 34965717823): what each interpreter printed for the same snippet.
const R = (exit: number, stdout1: string, stderr1 = '') => ({ exit, stdout1, stderr1 });
const DB: ShellsDatabase = {
  generated_at: '2026-09-15T13:00:00.000Z',
  shells: {
    ubuntu: { '/bin/bash': { kind: 'bash', version: '5.2.21(1)-release' }, '/bin/sh': { kind: 'dash', version: '0.5.12-6ubuntu5' }, '/bin/zsh': { kind: 'zsh', version: '5.9' } },
    macos: { '/bin/bash': { kind: 'bash', version: '3.2.57(1)-release' }, '/bin/sh': { kind: 'bash', version: '3.2.57(1)-release' }, '/bin/zsh': { kind: 'zsh', version: '5.9' } },
    alpine: { '/bin/sh': { kind: 'busybox', version: 'v1.36.1' }, '/bin/bash': { kind: 'bash', version: '5.2.26(1)-release' }, '/bin/zsh': { kind: 'zsh', version: '5.9' } },
  },
  probes: {
    array_index: { label: 'arrays start at 0', snippet: 'arr=(a b c) || exit 9; printf "%s\\n" "${arr[1]}"', results: {
      'ubuntu|/bin/bash': R(0, 'b'), 'macos|/bin/bash': R(0, 'b'), 'macos|/bin/zsh': R(0, 'a'), 'ubuntu|/bin/zsh': R(0, 'a'),
      'ubuntu|/bin/sh': R(2, '', '/bin/sh: 1: Syntax error: "(" unexpected'), 'alpine|/bin/sh': R(2, '', '/bin/sh: syntax error: unexpected "("') } },
    array_length: { label: '${#arr[@]} counts elements', snippet: '', results: {
      'ubuntu|/bin/bash': R(0, '3'), 'macos|/bin/bash': R(0, '3'), 'macos|/bin/zsh': R(0, '3'), 'ubuntu|/bin/sh': R(2, '', '/bin/sh: 1: Syntax error: "(" unexpected'), 'alpine|/bin/sh': R(2, '', 'syntax error') } },
    lowercase_bash4: { label: '${var,,} lowercase (bash 4)', snippet: '', results: {
      'ubuntu|/bin/bash': R(0, 'abc'), 'macos|/bin/bash': R(1, '', '/bin/bash: ${x,,}: bad substitution'), 'macos|/bin/zsh': R(1, '', 'zsh:1: bad substitution'), 'ubuntu|/bin/sh': R(2, '', '/bin/sh: 1: Bad substitution') } },
    pipefail: { label: 'set -o pipefail', snippet: '', results: {
      'ubuntu|/bin/bash': R(0, 'ok'), 'macos|/bin/bash': R(0, 'ok'), 'macos|/bin/zsh': R(0, 'ok'), 'ubuntu|/bin/sh': R(2, '', '/bin/sh: 1: set: Illegal option -o pipefail'), 'alpine|/bin/sh': R(0, 'ok') } },
    word_split: { label: 'unquoted $var splits on whitespace', snippet: '', results: {
      'ubuntu|/bin/bash': R(0, '3'), 'macos|/bin/bash': R(0, '3'), 'macos|/bin/zsh': R(0, '1'), 'ubuntu|/bin/sh': R(0, '3'), 'alpine|/bin/sh': R(0, '3') } },
    glob_nomatch: { label: 'a glob with no match stays literal', snippet: '', results: {
      'ubuntu|/bin/bash': R(0, '/definitely/not/here/*.xyz'), 'macos|/bin/zsh': R(1, '', 'zsh:1: no matches found: /definitely/not/here/*.xyz'), 'ubuntu|/bin/sh': R(0, '/definitely/not/here/*.xyz') } },
    leading_zero_08: { label: '$((08)) is an error in octal', snippet: '', results: {
      'ubuntu|/bin/bash': R(1, '', '/bin/bash: line 1: 08: value too great for base'), 'macos|/bin/zsh': R(0, '8'), 'ubuntu|/bin/sh': R(2, '', 'arithmetic expression: expecting EOF') } },
    process_subst: { label: '<( ) process substitution', snippet: '', results: { 'ubuntu|/bin/bash': R(0, 'sub'), 'macos|/bin/zsh': R(0, 'sub'), 'ubuntu|/bin/sh': R(2, '', 'Syntax error: "(" unexpected') } },
    here_string: { label: '<<< here-strings', snippet: '', results: { 'ubuntu|/bin/bash': R(0, 'here'), 'ubuntu|/bin/sh': R(2, '', 'Syntax error: redirection unexpected') } },
    brace_expand: { label: '{1..3} brace expansion', snippet: '', results: { 'ubuntu|/bin/bash': R(0, '3'), 'ubuntu|/bin/sh': R(0, '1') } },
    double_bracket: { label: '[[ ]] with pattern match', snippet: '', results: { 'ubuntu|/bin/bash': R(0, 'yes'), 'ubuntu|/bin/sh': R(127, '', '[[: not found') } },
    paren_arith: { label: '(( )) arithmetic command', snippet: '', results: { 'ubuntu|/bin/bash': R(0, 'big') } },
    function_keyword: { label: 'function name { } syntax', snippet: '', results: { 'ubuntu|/bin/bash': R(0, 'hi'), 'ubuntu|/bin/sh': R(2, '', 'Syntax error') } },
    pipe_read: { label: 'read at the end of a pipeline runs in a subshell', snippet: '', results: { 'ubuntu|/bin/bash': R(0, '[]'), 'macos|/bin/zsh': R(0, '[hi]') } },
    mapfile: { label: 'mapfile / readarray', snippet: '', results: { 'ubuntu|/bin/bash': R(0, 'x'), 'macos|/bin/bash': R(127, '', 'mapfile: command not found') } },
    echo_dash_e: { label: 'echo -e interprets escapes', snippet: '', results: { 'ubuntu|/bin/bash': R(0, '3'), 'ubuntu|/bin/sh': R(0, '6') } },
    glob_nomatch_for: { label: 'for over a glob with no match runs once with the pattern', snippet: '', results: { 'ubuntu|/bin/bash': R(0, '1'), 'macos|/bin/zsh': R(1, '', 'no matches found') } },
  },
};

const probesOf = (src: string) => findConstructs(parser.parse(src)!).map((h) => h.probe);

test('detectShebang reads bash, sh (and dash/ash), zsh, env forms, and nothing else', () => {
  assert.equal(detectShebang('#!/bin/bash\necho').interp, 'bash');
  assert.equal(detectShebang('#!/usr/bin/env bash\n').interp, 'bash');
  assert.equal(detectShebang('#!/bin/sh\n').interp, 'sh');
  assert.equal(detectShebang('#!/bin/dash\n').interp, 'sh');
  assert.equal(detectShebang('#!/usr/bin/env zsh\n').interp, 'zsh');
  assert.equal(detectShebang('#!/usr/bin/python3\n').interp, null);
  assert.equal(detectShebang('echo no shebang\n').line, null);
});

test('targetsFor follows the shebang to the interpreter each platform actually has', () => {
  assert.deepEqual(targetsFor('bash', DB).map((t) => t.key), ['ubuntu|/bin/bash', 'macos|/bin/bash', 'alpine|/bin/bash']);
  assert.deepEqual(targetsFor('sh', DB).map((t) => t.kind), ['dash', 'bash', 'busybox']);
  assert.deepEqual(targetsFor('zsh', DB).map((t) => t.key), ['ubuntu|/bin/zsh', 'macos|/bin/zsh', 'alpine|/bin/zsh']);
  // no shebang: bash on Ubuntu, zsh on macOS, ash on Alpine
  assert.deepEqual(targetsFor(null, DB).map((t) => t.key), ['ubuntu|/bin/bash', 'macos|/bin/zsh', 'alpine|/bin/sh']);
  const mac = targetsFor('bash', DB)[1]!;
  assert.match(mac.label, /^macOS bash 3\.2\.57$/);
});

test('findConstructs sees arrays, subscripts, bash-4 expansions, [[ ]], (( )), <( ), <<<, braces, function keyword', () => {
  const src = [
    'arr=(a b c)', 'echo "${arr[1]}" "${arr[@]}" "${#arr[@]}"', 'x=ABC; echo "${x,,}"', '[[ $x == A* ]] && (( 1 > 0 ))',
    'cat <(ls) <<< here', 'echo {1..3}', 'function f { :; }', 'mapfile -t l < f', 'set -o pipefail', 'echo -e "a\\tb"',
  ].join('\n');
  const got = probesOf(src);
  for (const p of ['array_literal', 'array_length', 'array_index', 'array_all', 'lowercase_bash4', 'double_bracket', 'paren_arith', 'process_subst', 'here_string', 'brace_expand', 'function_keyword', 'mapfile', 'pipefail', 'echo_dash_e']) {
    assert.ok(got.includes(p), `${p} not found in ${got.join(',')}`);
  }
  // the literal is the array_literal probe, the `${#arr[@]}` count is array_length, and the count is not an all-elements use
  const hits = findConstructs(parser.parse(src)!);
  assert.equal(hits.find((h) => h.probe === 'array_literal')?.node.text, '(a b c)');
  assert.equal(hits.find((h) => h.probe === 'array_length')?.node.text, '${#arr[@]}');
  assert.equal(hits.filter((h) => h.probe === 'array_all').length, 1);
});

test('the 2nd+ expansion inside one double-quoted string is read without its leading whitespace', () => {
  const got = probesOf('echo "${name:0:1} ${#name} $RANDOM"\n');
  for (const p of ['substring', 'string_length', 'random']) assert.ok(got.includes(p), `${p} not in ${got.join(',')}`);
});

test('case transforms need the exact ${x,,} / ${x^^} shape; a pattern ending in , or ^ is a strip', () => {
  const got = probesOf('echo "${x,,}" "${y[0]^^}" "${z^}" "${a,}"\necho "${x#*,}" "${x%,}" "${x##*^}" "${x%%^}"\n');
  assert.equal(got.filter((p) => p === 'lowercase_bash4').length, 2);
  assert.equal(got.filter((p) => p === 'uppercase_bash4').length, 2);
  assert.equal(got.filter((p) => p === 'strip_prefix').length, 2);
  assert.equal(got.filter((p) => p === 'strip_suffix').length, 2);
});

test('echo_backslash counts only the backslashes echo receives', () => {
  for (const src of ['echo "a\\tb"', "echo 'a\\tb'", 'echo a\\\\b', 'echo "path: $HOME\\bin"']) assert.ok(probesOf(src + '\n').includes('echo_backslash'), `should fire: ${src}`);
  for (const src of ['echo "say \\"hi\\""', 'echo "cost \\$5"', 'echo a\\ b', 'echo "run \\`date\\`"', 'echo -e "a\\tb"']) assert.ok(!probesOf(src + '\n').includes('echo_backslash'), `should not fire: ${src}`);
});

test('base#n arithmetic literals are their own probe, not an octal or leading-zero one', () => {
  for (const src of ['x=$(( 10#08 ))', 'x=$(( 10#0755 ))', 'day=$(( 10#${d:-09} ))', 'n=$(( 10#$month + 1 ))', '(( 10#08 > 1 ))']) {
    const got = probesOf(src + '\n');
    assert.ok(got.includes('base_n_literal'), `base_n_literal not in ${got.join(',')} for ${src}`);
    assert.ok(!got.includes('leading_zero_08') && !got.includes('octal_literal') && !got.includes('arith_basic'), `wrong extra probe in ${got.join(',')} for ${src}`);
  }
  assert.ok(probesOf('x=$(( 08 + 1 ))\n').includes('leading_zero_08'));
  assert.ok(probesOf('x=$(( 010 ))\n').includes('octal_literal'));
  assert.ok(probesOf('x=$(( 0x10 + a / 2 ))\n').includes('arith_basic'));
});

test('set_u_empty_array fires on a bare "${arr[@]}" under set -u and not on the bash-3.2-safe idioms', () => {
  assert.ok(probesOf('set -u\narr=()\nprintf "%s\\n" "${arr[@]}"\n').includes('set_u_empty_array'));
  assert.ok(probesOf('set -euo pipefail\nfor x in "${arr[*]}"; do :; done\n').includes('set_u_empty_array'));
  for (const src of ['set -u\nprintf "%s\\n" "${arr[@]:-}"\n', 'set -u\nset -- ${arr[@]+"${arr[@]}"}\n', 'set -u\nset -- ${arr[@]:+"${arr[@]}"}\n', 'set -u\necho "${#arr[@]}"\n', 'arr=()\necho "${arr[@]}"\n']) {
    const got = probesOf(src);
    assert.ok(!got.includes('set_u_empty_array'), `should not fire on ${JSON.stringify(src)}: ${got.join(',')}`);
  }
});

test('empty-array-under-nounset has a single probe', () => {
  const got = probesOf('set -u\narr=()\nprintf "%s\\n" "${arr[@]}" "${arr[*]}"\n');
  assert.deepEqual([...new Set(got.filter((p) => /empty/.test(p)))], ['set_u_empty_array']);
});

test('set_u_empty_array and set_u_empty_at stay quiet when the script fills the array or the positional list itself', () => {
  assert.ok(!probesOf('set -u\narr=(a b)\necho "${arr[@]}"\n').includes('set_u_empty_array'));
  assert.ok(!probesOf('set -u\ndeclare -a arr=(a)\necho "${arr[*]}"\n').includes('set_u_empty_array'));
  // an empty literal or an append inside a branch does not prove the array has elements
  assert.ok(probesOf('set -u\narr=()\necho "${arr[@]}"\n').includes('set_u_empty_array'));
  assert.ok(probesOf('set -u\narr=()\nif x; then arr+=(a); fi\necho "${arr[@]}"\n').includes('set_u_empty_array'));
  assert.ok(probesOf('set -u\nother=(a b)\necho "${arr[@]}"\n').includes('set_u_empty_array'));
  assert.ok(!probesOf('set -u\nset -- a b\necho "$@" "${*}"\n').includes('set_u_empty_at'));
  assert.ok(probesOf('set -u\nset --\necho "$@"\n').includes('set_u_empty_at'));
  assert.ok(probesOf('set -u\necho "$@"\n').includes('set_u_empty_at'));
});

test('set_u_empty_at: the whole positional list only, never its ${@:-} / ${@:+x} guards or the "$@" inside ${1+"$@"}', () => {
  for (const src of ['echo "$@"', 'echo "$*"', 'echo "${@}"', 'echo "${*}"', 'echo "${@:2}"', 'echo "${*:1:2}"']) assert.ok(probesOf(`set -u\n${src}\n`).includes('set_u_empty_at'), `should fire: ${src}`);
  for (const src of ['echo "${@:-}"', 'echo "${*:-}"', 'echo "${@:+x}"', 'echo ${1+"$@"}', 'echo ${@+"$@"}', 'echo ${@:+"$@"}', 'echo ${*+"$*"}', 'echo ${*:+"$*"}', 'f ${1+"$@"}']) {
    assert.ok(!probesOf(`set -u\n${src}\n`).includes('set_u_empty_at'), `should not fire: ${src}`);
  }
  assert.ok(!probesOf('echo "$@"\n').includes('set_u_empty_at'), 'no set -u, no finding');
});

test('shift with an argument maps to shift_n only', () => {
  assert.ok(!probesOf('shift\n').some((p) => p.startsWith('shift')));
  const got = probesOf('shift 2\nshift $((OPTIND-1))\n').filter((p) => p.startsWith('shift'));
  assert.deepEqual(got, ['shift_n', 'shift_n']);
});

test('readonly declarations are readonly_declare; re-assignment (readonly_assign) is never produced', () => {
  for (const src of ['readonly X=1', 'readonly FOO', 'declare -r X', 'declare -ir N=1', 'readonly -p', 'typeset -r T=1', "readonly r=1 || exit 9; printf '%s\\n' \"$r\""]) {
    const got = probesOf(src + '\n');
    assert.ok(got.includes('readonly_declare'), `readonly_declare not in ${got.join(',')} for ${src}`);
    assert.ok(!got.includes('readonly_assign'), `readonly_assign fired on ${src}`);
  }
  assert.ok(!probesOf('readonly r=1; r=2; printf "%s\\n" "$?"\n').includes('readonly_assign'));
  assert.ok(!probesOf('declare -i n=1\nx=2\n').includes('readonly_declare'));
});

test('echo_backslash ignores backslashes that belong to a nested expansion or command substitution', () => {
  for (const src of ['echo "${path//\\//_}"', 'echo "${pass//$\'\\n\'/ }"', 'echo "$(printf \'a\\tb\')"', 'echo "${x#\\#}"', 'echo "${x//\\\\/\\/}"']) assert.ok(!probesOf(src + '\n').includes('echo_backslash'), `should not fire: ${src}`);
  for (const src of ['echo "a\\tb"', "echo 'a\\tb'", 'echo "${x} a\\tb"', 'echo "$(date) b\\n"']) assert.ok(probesOf(src + '\n').includes('echo_backslash'), `should fire: ${src}`);
});

test('echo options are the leading -n/-e/-E words only', () => {
  assert.deepEqual(probesOf('echo foo -e\n').filter((p) => p.startsWith('echo')), []);
  assert.deepEqual(probesOf('echo -- -e\n').filter((p) => p.startsWith('echo')), []);
  assert.deepEqual(probesOf('echo -ne "a"\n').filter((p) => p.startsWith('echo')).sort(), ['echo_dash_e', 'echo_dash_n']);
  assert.deepEqual(probesOf('echo -e -n "a"\n').filter((p) => p.startsWith('echo')).sort(), ['echo_dash_e', 'echo_dash_n']);
  assert.deepEqual(probesOf('echo -E "a\\tb"\n').filter((p) => p.startsWith('echo')), ['echo_backslash']);
  // a backslash in a non-option word after `--` is printed literally; `-e` there is not an option
  assert.deepEqual(probesOf('echo -- "a\\tb" -e\n').filter((p) => p.startsWith('echo')), ['echo_backslash']);
  assert.deepEqual(probesOf('echo -n a -e "b\\tc"\n').filter((p) => p.startsWith('echo')).sort(), ['echo_backslash', 'echo_dash_n']);
});

test('substring takes any operands and positional subjects; subscripts, @/* and the :- := :? :+ operators are other probes', () => {
  for (const src of ['"${x:$off:$len}"', '"${x:i}"', '"${x:i:1}"', '"${x:1:$n}"', '"${1:0:1}"', '"${x:${o}:2}"', '"${x:$((i*2)):1}"', '${x:$off:$len}', '"${x:$off}"', '"pre ${x:$off:$len} post"']) {
    const got = probesOf(`echo ${src}\n`);
    assert.deepEqual(got.filter((p) => /^subst|^array_slice|_value$|^assign_default/.test(p)), ['substring'], `for ${src}: ${got.join(',')}`);
  }
  assert.deepEqual(probesOf('echo "${arr[1]:0:2}" "${@:1}" "${arr[@]:1}"\n').filter((p) => /^subst|^array_slice/.test(p)), ['array_slice', 'array_slice']);
  for (const src of ['"${x:-d}"', '"${x:=d}"', '"${x:?m}"', '"${x:+y}"']) assert.ok(!probesOf(`echo ${src}\n`).includes('substring'), `should not fire: ${src}`);
  assert.deepEqual(probesOf('echo "${x: -2}" "${x:1:-1}" "${x:(-1)}"\n').filter((p) => /^subst/.test(p)), ['substr_negative', 'substring_neg_len', 'substr_negative']);
  // the node the grammar cut short still reports the whole construct and its extent
  const hits = findConstructs(parser.parse('echo "${x:$off:$len}"\n')!).filter((h) => h.probe === 'substring');
  assert.equal(hits[0]?.text, '${x:$off:$len}');
  const [f] = analyzeShells(parser.parse('echo "${x:$off:$len}"\n')!, { ...DB, probes: { ...DB.probes, substring: { label: 's', snippet: '', results: {} } } }, []);
  assert.equal(f?.text, '${x:$off:$len}');
  assert.deepEqual([f?.start, f?.end], [{ row: 0, column: 6 }, { row: 0, column: 20 }]);
});

test("array_index and its siblings do not fire on bash's own arrays", () => {
  const src = 'echo "${BASH_SOURCE[0]}" "${FUNCNAME[1]}" "${PIPESTATUS[0]}" "${BASH_VERSINFO[0]}" "${COMP_WORDS[COMP_CWORD]}" "${BASH_REMATCH[-1]}" "${COMPREPLY[@]}"\n';
  const got = probesOf(src);
  assert.ok(!got.some((p) => p.startsWith('array_')), `array probe in ${got.join(',')}`);
  for (const p of ['bash_source', 'funcname', 'pipestatus_upper', 'bash_rematch']) assert.ok(got.includes(p), `${p} not in ${got.join(',')}`);
  assert.ok(probesOf('echo "${mine[0]}"\n').includes('array_index'));
});

test('ifs_split skips a default-IFS restore', () => {
  for (const src of ["IFS=$' \\t\\n'", "IFS=' '", 'IFS=" "']) assert.ok(!probesOf(src + '\n').includes('ifs_split'), `should not fire: ${src}`);
  for (const src of ["IFS=$'\\n'", "IFS=$'\\t'", "IFS=' :'", 'IFS=","']) assert.ok(probesOf(src + '\n').includes('ifs_split'), `should fire: ${src}`);
});

test('${!x*} and ${!x@} prefix listings map to nothing; ${!name} stays indirect_bash', () => {
  assert.deepEqual(probesOf('echo "${!BASH_@}" "${!x*}" ${!pre@}\n').filter((p) => /indirect|array_keys/.test(p)), []);
  assert.deepEqual(probesOf('echo "${!name}" "${!arr[@]}"\n').filter((p) => /indirect|array_keys/.test(p)), ['indirect_bash', 'array_keys']);
});

test('ifs_split: a literal, non-empty IFS for the rest of the script; not a read prefix, a restore or an empty IFS', () => {
  for (const src of ['IFS=,', 'IFS=":"', "IFS=$'\\n'", "IFS=$'\\n\\t'", 'IFS=";;"', 'f() { local IFS=,; }']) assert.ok(probesOf(src + '\n').includes('ifs_split'), `should fire: ${src}`);
  for (const src of ['IFS=: read -r a b', 'while IFS=, read -r a b c; do :; done < f', 'IFS=$OLD_IFS', 'IFS="$saved"', 'IFS=', "IFS=''", 'IFS=""', 'IFS=$(printf ",")']) assert.ok(!probesOf(src + '\n').includes('ifs_split'), `should not fire: ${src}`);
});

test('local / export with a command substitution mask its status, quoted or not, and local -A/-a/-i are the declare probes', () => {
  const got = probesOf('f() {\n  local here="$(cd "$(dirname "$0")" && pwd)"\n  local -r name="$(basename "$0")"\n  local -A seen=()\n  local -a items=(a b c)\n  local -i count=0\n}\nexport x="$(false)"\nexport y=$(false)\n');
  assert.equal(got.filter((p) => p === 'local_masks_status').length, 2);
  assert.equal(got.filter((p) => p === 'export_masks_status').length, 2);
  for (const p of ['assoc_declare', 'declare_a', 'declare_i', 'array_literal']) assert.ok(got.includes(p), `${p} not in ${got.join(',')}`);
  assert.ok(!probesOf('f() { local x=1; local y="$z"; }\nexport z="$HOME"\n').some((p) => p.endsWith('_masks_status')));
});

test('glob_nomatch_for looks at the loop words only: unquoted globs fire, quoted words and the body do not', () => {
  for (const src of ['for f in *.txt; do :; done', 'for f in "$d"/*.log; do :; done', 'for f in a?b; do :; done', 'for f in [ab]*; do :; done']) assert.ok(probesOf(src + '\n').includes('glob_nomatch_for'), `should fire: ${src}`);
  for (const src of ['for f in "*.txt"; do :; done', 'for f in "$@"; do ls *.txt; done', 'for f in a b c; do :; done', 'for f in $files; do :; done']) assert.ok(!probesOf(src + '\n').includes('glob_nomatch_for'), `should not fire: ${src}`);
});

test('set -u, set -euo pipefail and set -o nounset all map to set_o_nounset; set_u_unset is never produced', () => {
  const got = probesOf('set -u\nset -euo pipefail\nset -o nounset\nset -o errexit\n');
  assert.equal(got.filter((p) => p === 'set_o_nounset').length, 3);
  assert.ok(!got.includes('set_u_unset'));
});

test('renamed ids: at_upper_u, at_upper_q, read_upper_n, type_upper_p', () => {
  const got = probesOf('echo "${x@U}" "${x@Q}"\nread -N 3 v\ntype -P sh\n');
  for (const p of ['at_upper_u', 'at_upper_q', 'read_upper_n', 'type_upper_p']) assert.ok(got.includes(p), `${p} not in ${got.join(',')}`);
  for (const p of ['at_U', 'at_Q', 'read_N', 'type_P']) assert.ok(!got.includes(p));
});

test('local outside a function is local_outside, inside it is local_in_func', () => {
  assert.deepEqual(probesOf('local x=1\n').filter((p) => p.startsWith('local')), ['local_outside']);
  assert.deepEqual(probesOf('f() { local x=1; }\n').filter((p) => p.startsWith('local')), ['local_in_func']);
});

test('array_slice covers ${arr[@]:n}, ${@:n}, ${*:n} and "${@:n:m}"', () => {
  const got = probesOf('a=(x y z)\nset -- "${a[@]:1}"\nrest=("${@:2}")\nfirst="${@:1:1}"\necho "${*:1}"\necho "${x:1:2}" "${x:1:-1}" "${x: -2}"\n');
  assert.equal(got.filter((p) => p === 'array_slice').length, 4);
  for (const p of ['substring', 'substring_neg_len', 'substr_negative']) assert.ok(got.includes(p), `${p} not in ${got.join(',')}`);
});

test('word_split skips $?, $$, $!, $#, $-, $0..$9 and fires on for-loop words', () => {
  assert.ok(!probesOf('echo $! $$ $? $# $- $0 $1 $9\nexit $?\n').includes('word_split'));
  const got = findConstructs(parser.parse('for f in $staged; do echo $f; done\nfor g in "$x"; do :; done\n')!).filter((h) => h.probe === 'word_split').sort((a, b) => a.node.startIndex - b.node.startIndex);
  assert.deepEqual(got.map((h) => h.node.text.trim()), ['$staged', '$f']);
});

test('pipe_read: `cmd | while read` points at the read command', () => {
  const hits = findConstructs(parser.parse('find . -name "*.sh" | while read -r f; do echo "$f"; done\necho x | read v\nwhile read -r l; do :; done < f\n')!).filter((h) => h.probe === 'pipe_read');
  assert.deepEqual(hits.map((h) => h.node.text), ['read -r f', 'read v']);
});

test('printf_basic needs a width, precision or flag in the format', () => {
  for (const src of ["printf '%5s|%-3s|%03d\\n' ab c 7", "printf '  -> %-10s ' \"$t\"", "printf '%.2f\\n' 1", "printf '%+5d\\n' 1"]) assert.ok(probesOf(src + '\n').includes('printf_basic'), `should fire: ${src}`);
  for (const src of ["printf '%s\\n' hi", "printf '%d items\\n' 3", "printf 'plain\\n'", "printf '%q\\n' x", "printf -v out '%5s' x"]) assert.ok(!probesOf(src + '\n').includes('printf_basic'), `should not fire: ${src}`);
});

test('trap - EXIT resets the trap and is not a trap_exit finding', () => {
  assert.ok(!probesOf('trap - EXIT\nf() { trap - EXIT ERR; }\n').some((p) => p.startsWith('trap_')));
  const got = probesOf("trap cleanup EXIT\ntrap 'echo bye' EXIT INT TERM\ntrap '' ERR\nf() { trap 'x' 0; }\n");
  assert.equal(got.filter((p) => p === 'trap_exit').length, 2);
  assert.ok(got.includes('trap_err') && got.includes('trap_exit_in_function'));
});

test('last_pipe_status looks past comments to the previous statement', () => {
  assert.ok(probesOf('grep -q x f | cat\n# a comment\nrc=$?\n').includes('last_pipe_status'));
  assert.ok(!probesOf('grep -q x f | cat\ntrue\necho "$?"\n').includes('last_pipe_status'));
  assert.ok(!probesOf('if grep -q y f | cat; then :; fi\necho "$?"\n').includes('last_pipe_status'));
});

test('findConstructs sees the zsh-only differences: unquoted $var, unmatched globs, read at the end of a pipe', () => {
  const got = probesOf('v="a b"\nset -- $v\nls *.xyz\nfor f in /tmp/*.zzz; do :; done\necho hi | read v\n');
  assert.ok(got.includes('word_split'));
  assert.ok(got.includes('glob_nomatch'));
  assert.ok(got.includes('glob_nomatch_for'));
  assert.ok(got.includes('pipe_read'));
});

test('findConstructs does not flag quoted variables, quoted globs or option words', () => {
  const got = probesOf('v="a b"\nset -- "$v"\nls "*.xyz"\ngrep -r x .\n');
  assert.ok(!got.includes('word_split'), 'quoted "$v" must not be word_split');
  assert.ok(!got.includes('glob_nomatch'), 'a quoted glob and -r must not be glob_nomatch');
});

test('judgeConstruct: breaks when the target fails and bash did not, differs when both run but print differently', () => {
  const [ub, mac] = targetsFor('bash', DB);
  const zsh = targetsFor('zsh', DB)[1]!;
  const dash = targetsFor('sh', DB)[0]!;
  assert.equal(judgeConstruct(DB, 'array_index', ub!).status, 'same');
  assert.equal(judgeConstruct(DB, 'array_index', zsh).status, 'differs');
  assert.match(judgeConstruct(DB, 'array_index', zsh).headline, /prints "a" where bash prints "b"/);
  assert.equal(judgeConstruct(DB, 'array_index', dash).status, 'breaks');
  assert.equal(judgeConstruct(DB, 'lowercase_bash4', mac!).status, 'breaks');
  assert.match(judgeConstruct(DB, 'lowercase_bash4', mac!).headline, /bad substitution/);
  assert.equal(judgeConstruct(DB, 'pipefail', dash).status, 'breaks');
  assert.equal(judgeConstruct(DB, 'pipefail', zsh).status, 'same');
  // an error in bash that another shell accepts is a difference, not a break
  assert.equal(judgeConstruct(DB, 'leading_zero_08', zsh).status, 'differs');
  // an error in both is the same behaviour
  assert.equal(judgeConstruct(DB, 'leading_zero_08', dash).status, 'same');
  assert.equal(judgeConstruct(DB, 'paren_arith', zsh).status, 'unknown');
  assert.equal(REFERENCE, 'ubuntu|/bin/bash');
});

test('analyzeShells ties each construct to its position and a verdict per target', () => {
  const src = '#!/bin/bash\nx=ABC\necho "${x,,}"\n';
  const findings = analyzeShells(parser.parse(src)!, DB, targetsFor('bash', DB));
  const lower = findings.find((f) => f.probe === 'lowercase_bash4')!;
  assert.equal(lower.start.row, 2);
  assert.equal(lower.text, '${x,,}');
  assert.deepEqual(lower.verdicts.map((v) => v.status), ['same', 'breaks', 'unknown']);
});
