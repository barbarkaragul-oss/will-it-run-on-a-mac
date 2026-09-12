/**
 * End to end: a script goes through tree-sitter-bash, the resolver, the wrapper table and the verdict engine,
 * against the committed database. The expectations are the recorded platform answers.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { analyzeScript, type Analysis } from '../src/engine/analyze.js';
import type { Database } from '../scripts/extract.js';

const db = JSON.parse(readFileSync(path.resolve('data/flags.json'), 'utf8')) as Database;
let parser: Parser;
before(async () => {
  await Parser.init();
  const lang = await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm'));
  parser = new Parser();
  parser.setLanguage(lang);
});

const find = (a: Analysis, name: string) => a.commands.filter((c) => c.name === name);
const flag = (a: Analysis, name: string, f: string) => find(a, name).flatMap((c) => c.flags).find((x) => x.flag === f);

test('the classic script: sed -i, grep -P, readlink -f, date -d get the recorded verdicts per platform', () => {
  const a = analyzeScript(parser, `#!/bin/bash
set -euo pipefail
sed -i 's/foo/bar/' file.txt
grep -P 'x+' file.txt | sort -V
readlink -f "$0"
date -d yesterday
`, db);
  assert.deepEqual(a.parseErrors, []);
  const sedI = flag(a, 'sed', '-i')!;
  assert.equal(sedI.verdicts.ubuntu.status, 'ok');
  assert.equal(sedI.verdicts.macos.status, 'ok');
  assert.match(sedI.verdicts.macos.headline, /required argument/);
  assert.equal(flag(a, 'grep', '-P')!.verdicts.macos.status, 'rejected');
  assert.equal(flag(a, 'grep', '-P')!.verdicts.ubuntu.status, 'ok');
  assert.equal(flag(a, 'sort', '-V')!.verdicts.macos.status, 'ok');
  assert.equal(flag(a, 'readlink', '-f')!.verdicts.macos.status, 'ok');
  assert.equal(flag(a, 'date', '-d')!.verdicts.macos.status, 'rejected');
  // BusyBox date has -d, but not the 'yesterday' format: the flag exists and the scenario still failed
  const dAlpine = flag(a, 'date', '-d')!.verdicts.alpine;
  assert.equal(dAlpine.status, 'ok');
  assert.match(dAlpine.headline, /still failed there: "date: invalid date/);
  // set is a builtin: listed, flags judged as builtin
  assert.equal(flag(a, 'set', '-e')!.verdicts.macos.status, 'builtin');
});

test('wrappers are unwrapped: sudo -u, env VAR=, xargs CMD, find -exec, sh -c with a static string', () => {
  const a = analyzeScript(parser, `sudo -u deploy sed -z 's/a/b/' f
LC_ALL=C env -i sort -h f
printf 'a\\0' | xargs -0 -I{} cp --reflink=auto {} /tmp
find . -name '*.log' -exec rm -rf {} +
sh -c 'stat -c %s f'
`, db);
  const sed = find(a, 'sed')[0]!;
  assert.deepEqual(sed.via, ['sudo']);
  assert.equal(flag(a, 'sed', '-z')!.verdicts.macos.status, 'rejected');
  assert.ok(flag(a, 'sudo', '-u'), 'the wrapper\'s own flag is checked too');
  assert.deepEqual(find(a, 'sort')[0]!.via, ['env']);
  assert.equal(flag(a, 'xargs', '-0')!.verdicts.macos.status, 'ok');
  assert.equal(flag(a, 'cp', '--reflink')!.verdicts.macos.status, 'rejected');
  assert.deepEqual(find(a, 'cp')[0]!.via, ['xargs']);
  assert.deepEqual(find(a, 'rm')[0]!.via, ['find -exec']);
  assert.ok(flag(a, 'rm', '-r') && flag(a, 'rm', '-f'), 'combined -rf is split');
  assert.equal(flag(a, 'stat', '-c')!.verdicts.macos.status, 'rejected');
  assert.deepEqual(find(a, 'stat')[0]!.via, ['sh -c']);
});

test('dynamic names and arguments are reported, never guessed; -- ends options; old-style tar is noted', () => {
  const a = analyzeScript(parser, `$CMD -x
ls $OPTS -- -not-a-flag
tar czf a.tgz --wildcards '*.txt'
head -5 f
`, db);
  const dyn = a.commands.find((c) => c.name === '$CMD')!;
  assert.equal(dyn.checked, false);
  const ls = find(a, 'ls')[0]!;
  assert.ok(ls.notes.some((n) => /dynamic/.test(n)));
  assert.equal(ls.flags.length, 0, 'nothing after -- is a flag');
  const tar = find(a, 'tar')[0]!;
  assert.ok(tar.notes.some((n) => /old-style/.test(n)));
  assert.equal(flag(a, 'tar', '--wildcards')!.verdicts.macos.status, 'rejected');
  assert.ok(find(a, 'head')[0]!.notes.some((n) => /legacy numeric/.test(n)));
});

test('quoted heredoc bodies are inert, unquoted ones are scanned; missing tools are named', () => {
  const a = analyzeScript(parser, `cat <<'EOF'
sed -z inert
EOF
cat <<EOF
$(timeout 5 true)
EOF
tac f
`, db);
  assert.equal(find(a, 'sed').length, 0);
  assert.equal(flag(a, 'timeout', '-')?.verdicts, undefined);
  assert.equal(find(a, 'timeout').length, 1);
  assert.equal(find(a, 'tac').length, 1);
  assert.equal(a.commands.find((c) => c.name === 'tac')!.flags.length, 0);
});
