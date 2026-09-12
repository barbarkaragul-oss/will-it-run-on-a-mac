/**
 * Verdicts are checked against the committed database, which was recorded on real platforms: the cases below
 * are the classic "works on my Linux, breaks on my Mac" traps and their recorded answers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { judge, flagsInWord } from '../src/engine/verdict.js';
import type { Database } from '../scripts/extract.js';

const db = JSON.parse(readFileSync(path.resolve('data/flags.json'), 'utf8')) as Database;

test('sed -i: GNU takes an optional suffix, macOS requires one, BusyBox is optional; the probes back it', () => {
  const u = judge(db, 'sed', '-i', 'ubuntu');
  const m = judge(db, 'sed', '-i', 'macos');
  const a = judge(db, 'sed', '-i', 'alpine');
  assert.equal(u.status, 'ok'); assert.match(u.headline, /argument optional/);
  assert.equal(m.status, 'ok'); assert.match(m.headline, /required argument/);
  assert.ok(m.evidence.some((e) => e.source === 'mdoc' && /Fl i Ar extension/.test(e.line)));
  assert.equal(a.status, 'ok'); assert.match(a.headline, /argument optional/);
  assert.equal(db.probes['sed-i-nosuffix']!.results.macos!.code, 1);
  assert.equal(db.probes['sed-i-nosuffix']!.results.ubuntu!.code, 0);
});

test('sed -z and grep -P exist on GNU only; the verdict names the platform documentation that lacks them', () => {
  assert.equal(judge(db, 'sed', '-z', 'ubuntu').status, 'ok');
  const mz = judge(db, 'sed', '-z', 'macos');
  assert.equal(mz.status, 'rejected', 'a recorded run rejected it: probe beats docs');
  assert.match(mz.probe!.stderr1, /illegal option -- z/);
  assert.equal(judge(db, 'sed', '-z', 'alpine').status, 'rejected');
  assert.equal(judge(db, 'grep', '-P', 'macos').status, 'rejected');
  // a flag with no probe: documentation decides
  const ms = judge(db, 'sed', '-s', 'macos');
  assert.equal(ms.status, 'missing');
  assert.match(ms.headline, /not among the options/);
});

test('uniq -D: fine on macOS 26, rejected by BusyBox; readlink -f works on all three today', () => {
  assert.equal(judge(db, 'uniq', '-D', 'macos').status, 'ok');
  assert.equal(judge(db, 'uniq', '-D', 'alpine').status, 'rejected');
  for (const p of ['ubuntu', 'macos', 'alpine'] as const) assert.equal(judge(db, 'readlink', '-f', p).status, 'ok', p);
});

test('missing tools, builtins, and documentation contradicted by a run', () => {
  assert.equal(judge(db, 'timeout', '-k', 'macos').status, 'missing-tool');
  assert.equal(judge(db, 'tac', '-r', 'macos').status, 'missing-tool');
  assert.equal(judge(db, 'echo', '-e', 'macos').status, 'builtin');
  const d = judge(db, 'date', '-d', 'macos');
  assert.equal(d.status, 'rejected');
  assert.match(d.headline, /documented on macOS .* but the recorded run rejected it/);
  const c = judge(db, 'grep', '--color', 'alpine');
  assert.equal(c.status, 'ok-probed');
});

test('combined short flags and attached arguments split correctly', () => {
  assert.deepEqual(flagsInWord('-rf', new Set()), ['-r', '-f']);
  assert.deepEqual(flagsInWord('-n5', new Set(['-n'])), ['-n']);
  assert.deepEqual(flagsInWord('-i.bak', new Set(['-i'])), ['-i']);
  assert.deepEqual(flagsInWord('--in-place=.bak', new Set()), ['--in-place']);
  assert.deepEqual(flagsInWord('--', new Set()), []);
  assert.deepEqual(flagsInWord('file', new Set()), []);
});
