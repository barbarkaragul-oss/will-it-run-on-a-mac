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
    'arr=(a b c)', 'echo "${arr[1]}" "${arr[@]}"', 'x=ABC; echo "${x,,}"', '[[ $x == A* ]] && (( 1 > 0 ))',
    'cat <(ls) <<< here', 'echo {1..3}', 'function f { :; }', 'mapfile -t l < f', 'set -o pipefail', 'echo -e "a\\tb"',
  ].join('\n');
  const got = probesOf(src);
  for (const p of ['array_length', 'array_index', 'array_all', 'lowercase_bash4', 'double_bracket', 'paren_arith', 'process_subst', 'here_string', 'brace_expand', 'function_keyword', 'mapfile', 'pipefail', 'echo_dash_e']) {
    assert.ok(got.includes(p), `${p} not found in ${got.join(',')}`);
  }
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
