/**
 * The core the GitHub Action and the command line tool share: its counts must be the page's counts (src/ui/main.ts),
 * its findings must land on the right lines, and each must carry the evidence the page would show.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { analyzeScript, PLATFORMS } from '../src/engine/analyze.js';
import { checkSource, checkFiles, parsePlatforms, platformLine, type Engine } from '../src/action/core.js';
import type { Database } from '../scripts/extract.js';
import type { ShellsDatabase } from '../scripts/extract-shells.js';

const db = JSON.parse(readFileSync(path.resolve('data/flags.json'), 'utf8')) as Database;
const shellsDb = JSON.parse(readFileSync(path.resolve('data/shells.json'), 'utf8')) as ShellsDatabase;
const sample = readFileSync(path.resolve('tests/fixtures/ci-sample.sh'), 'utf8');
let engine: Engine;
let noShells: Engine;
before(async () => {
  await Parser.init();
  const lang = await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm'));
  const parser = new Parser();
  parser.setLanguage(lang);
  engine = { parser, db, shellsDb };
  noShells = { parser, db, shellsDb: undefined };
});

const both = { platforms: parsePlatforms('macos,alpine'), verbose: false };
const lineOf = (needle: string): number => sample.split('\n').findIndex((l) => l.includes(needle)) + 1;

test('the per-platform "will break" count is the page\'s count: rejected flags plus missing tools', () => {
  const r = checkSource(sample, 'ci-sample.sh', engine, both);
  const a = analyzeScript(engine.parser, sample, db);
  for (const p of both.platforms) {
    const flags = a.commands.flatMap((c) => c.flags);
    const page = flags.filter((f) => f.verdicts[p].status === 'rejected').length + a.commands.filter((c) => c.tool?.[p] === 'missing').length;
    const undocumented = flags.filter((f) => f.verdicts[p].status === 'missing').length;
    assert.equal(r.perPlatform[p]!.breaks, page, `${p}: breaks`);
    assert.equal(r.perPlatform[p]!.undocumented, undocumented, `${p}: not documented`);
  }
  assert.ok(r.perPlatform.macos!.breaks >= 3, 'date -d, timeout and find -printf at least');
});

test('the classic breaks are errors on the line they are on, with the binary\'s own answer as the message', () => {
  const r = checkSource(sample, 'ci-sample.sh', engine, both);
  const at = (kind: string, subject: string, platform: string) => r.findings.find((f) => f.kind === kind && f.subject === subject && f.platform === platform);

  const date = at('rejected', 'date', 'macos');
  assert.ok(date, 'date -d on macOS');
  assert.equal(date.severity, 'error');
  assert.equal(date.line, lineOf('date -d'));
  assert.ok(date.column >= 1);
  assert.match(date.message, /illegal option -- d/);

  const timeout = at('missing-tool', 'timeout', 'macos');
  assert.ok(timeout, 'timeout is missing on macOS');
  assert.equal(timeout.line, lineOf('timeout 5'));

  for (const p of ['macos', 'alpine']) {
    const find = at('rejected', 'find', p);
    assert.ok(find, `find -printf on ${p}`);
    assert.equal(find.line, lineOf('find . -printf'));
    assert.ok(find.message.length > 20);
  }
  assert.ok(at('rejected', 'uniq', 'alpine'), 'uniq -D is rejected by BusyBox');
  assert.equal(at('rejected', 'uniq', 'macos'), undefined, 'but macOS 26 runs it');
});

test('a flag that exists but whose recorded use failed is a warning, not a break, as on the page', () => {
  const r = checkSource(sample, 'ci-sample.sh', engine, both);
  const sed = r.findings.find((f) => f.subject === 'sed' && f.platform === 'macos');
  assert.ok(sed, 'sed -i on macOS');
  assert.equal(sed.kind, 'caveat');
  assert.equal(sed.severity, 'warning');
  assert.ok(r.perPlatform.macos!.caveats >= 1);
});

test('shell constructs are judged under the shell the shebang reaches: mapfile breaks under macOS bash 3.2', () => {
  const r = checkSource(sample, 'ci-sample.sh', engine, both);
  assert.equal(r.interp, 'bash');
  const m = r.findings.find((f) => f.kind === 'shell-breaks' && f.platform === 'macos' && f.line === lineOf('mapfile'));
  assert.ok(m, 'mapfile under macOS bash 3.2');
  assert.equal(m.severity, 'error');
  assert.ok(r.perPlatform.macos!.shellBreaks >= 1);
});

test('only the platforms asked for are reported', () => {
  const r = checkSource(sample, 'ci-sample.sh', engine, { platforms: parsePlatforms('macos'), verbose: false });
  assert.deepEqual(Object.keys(r.perPlatform), ['macos']);
  assert.ok(r.findings.every((f) => f.platform === undefined || f.platform === 'macos'));
});

test('a clean script has no findings and nothing breaks', () => {
  const r = checkSource('#!/bin/sh\nls -la\nmkdir -p out\n', 'clean.sh', engine, both);
  assert.deepEqual(r.findings, []);
  for (const p of both.platforms) assert.equal(r.perPlatform[p]!.breaks, 0);
  assert.equal(platformLine('macos', r.perPlatform.macos!), 'macOS: nothing breaks');
});

test('what cannot be checked is reported only with verbose', () => {
  const quiet = checkSource(sample, 'ci-sample.sh', engine, both);
  assert.equal(quiet.findings.filter((f) => f.severity === 'notice').length, 0);
  assert.ok(quiet.unchecked >= 1, '$OPTS is counted as not checked');
  const loud = checkSource(sample, 'ci-sample.sh', engine, { ...both, verbose: true });
  assert.ok(loud.findings.some((f) => f.kind === 'unchecked'));
});

test('a script that does not parse gives a warning and whatever could be read, not an exception', () => {
  const r = checkSource('date -d yesterday\nif [ x = y; then\n', 'broken.sh', engine, both);
  assert.ok(r.findings.some((f) => f.kind === 'parse-error' && f.severity === 'warning'));
  assert.ok(r.findings.some((f) => f.subject === 'date' && f.kind === 'rejected'));
});

test('without the shell database the flag analysis still runs', () => {
  const r = checkSource(sample, 'ci-sample.sh', noShells, both);
  assert.ok(r.findings.some((f) => f.kind === 'rejected'));
  assert.ok(!r.findings.some((f) => f.kind.startsWith('shell-')));
});

test('totals add up over files, and unknown platforms are refused', () => {
  const r = checkFiles([{ path: 'a.sh', src: sample }, { path: 'b.sh', src: '#!/bin/sh\nls\n' }], engine, both);
  assert.equal(r.totals.filesChecked, 2);
  assert.equal(r.totals.errors, r.files.flatMap((f) => f.findings).filter((f) => f.severity === 'error').length);
  assert.equal(r.totals.perPlatform.macos!.breaks, r.files[0]!.perPlatform.macos!.breaks);
  assert.throws(() => parsePlatforms('macos,windows'), /unknown platform "windows"/);
  assert.deepEqual(parsePlatforms(''), ['macos', 'alpine']);
  assert.deepEqual(parsePlatforms('alpine, ubuntu'), ['ubuntu', 'alpine'].filter((p) => PLATFORMS.includes(p as never)));
});
