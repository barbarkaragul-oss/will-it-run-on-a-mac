/**
 * find primaries: after the path, a single-dash word is a primary, not an option, and every platform rejects an
 * unknown one with its own wording. The collector learns that wording from a canary and executes each primary
 * (collector/find-primaries.txt); the extractor merges those rows with the option rows of the same word; the
 * verdict engine and the analyzer treat them as whole flags with their own arguments.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { parseFlagProbes, type Database } from '../scripts/extract.js';
import { judge } from '../src/engine/verdict.js';
import { analyzeScript } from '../src/engine/analyze.js';

const row = (...cells: string[]) => cells.join('\t');

test('extractor: primary rows are classified by the primary canary and merged with option rows of the same word', () => {
  const tsv = [
    row('tool', 'flag', 'form', 'code', 'class', 'stderr1'),
    row('find', '-~', 'canary', '', 'canary', 'find: illegal option -- ~'),
    row('find', '--wiroam-no-such-option', 'canary', '', 'canary', 'find: illegal option -- -'),
    row('find', '-wiroamnosuch', 'canary', '', 'canary', 'find: -wiroamnosuch: unknown primary or operator'),
    // -a is an illegal option before the path and the "and" operator after it: the merged answer is "recognized".
    row('find', '-a', 'with', '1', 'rejected', 'find: illegal option -- a'),
    row('find', '-a', 'without', '1', 'rejected', 'find: illegal option -- a'),
    row('find', '-a', 'primary', '0', 'accepted', ''),
    row('find', '-printf', 'primary', '1', 'rejected', 'find: -printf: unknown primary or operator'),
    row('find', '-name', 'primary', '0', 'accepted', ''),
    row('find', '-delete', 'primary', '1', 'other', 'find: -delete: . : relative path potentially not safe'),
    // A tool whose primary canary printed nothing cannot classify primary rows, but its option rows still count.
    row('grep', '-~', 'canary', '', 'canary', 'grep: invalid option -- ~'),
    row('grep', '--wiroam-no-such-option', 'canary', '', 'canary', 'grep: unrecognized option'),
    row('grep', '-P', 'with', '2', 'rejected', 'grep: invalid option -- P'),
    row('grep', '-P', 'without', '2', 'rejected', 'grep: invalid option -- P'),
    row('grep', '-zzz', 'primary', '1', 'rejected', 'whatever'),
  ].join('\n');
  const m = parseFlagProbes(tsv);
  const f = m.get('find')!;
  assert.equal(f.rejects.primary, 'find: -wiroamnosuch: unknown primary or operator');
  assert.deepEqual(f.runs['-a'], { result: 'recognized', code: 0, stderr1: '', form: 'primary' });
  assert.deepEqual(f.runs['-printf'], { result: 'rejected', code: 1, stderr1: 'find: -printf: unknown primary or operator', form: 'primary' });
  assert.equal(f.runs['-name']!.result, 'recognized');
  assert.equal(f.runs['-delete']!.result, 'recognized', 'a failure that is not the unknown-primary wording means the primary exists');
  const g = m.get('grep')!;
  assert.equal(g.rejects.primary, undefined);
  assert.equal(g.runs['-P']!.result, 'rejected');
  assert.equal(g.runs['-zzz'], undefined, 'no primary canary, no classification');
});

/** A minimal database: one platform, find with a few recorded primaries, one scenario probe. */
const synthetic = {
  generated_at: '2026-09-14T00:00:00.000Z',
  platforms: { macos: { platform: 'macos', os: 'macOS 26.6', recorded_at: '2026-09-14T05:20:00Z', userland: 'BSD userland (macOS)' } },
  tools: {
    find: {
      macos: {
        present: true, sources: ['mdoc'], flags: { '-E': { flag: '-E', arg: 'none', evidence: [{ source: 'mdoc', line: '.It Fl E' }] } },
        rejects: { short: 'find: illegal option -- ~', long: 'find: illegal option -- -', primary: 'find: -wiroamnosuch: unknown primary or operator' },
        runs: {
          '-E': { result: 'recognized', code: 0, stderr1: '', form: 'with' },
          '-name': { result: 'recognized', code: 0, stderr1: '', form: 'primary' },
          '-printf': { result: 'rejected', code: 1, stderr1: 'find: -printf: unknown primary or operator', form: 'primary' },
        },
      },
    },
  },
  probes: {
    'find-regextype': { id: 'find-regextype', command: "find . -regextype posix-extended -regex '.*'", results: { macos: { code: 1, stderr1: 'find: -regextype: unknown primary or operator', stdout1: '' } } },
    'gnu-wording': { id: 'gnu-wording', command: 'find . -xautofs', results: { macos: { code: 1, stderr1: "find: unknown predicate `-xautofs'", stdout1: '' } } },
  },
} as unknown as Database;

test('verdict: an executed primary is judged by its run; the headline never claims it is undocumented', () => {
  const printf = judge(synthetic, 'find', '-printf', 'macos');
  assert.equal(printf.status, 'rejected');
  assert.match(printf.headline, /does not exist on macOS \(BSD\): the binary answered "find: -printf: unknown primary or operator"/);
  const name = judge(synthetic, 'find', '-name', 'macos');
  assert.equal(name.status, 'ok-probed');
  assert.match(name.headline, /exists on macOS \(BSD\): executed there as `find \. -name \.\.\.`, exit 0/);
  assert.doesNotMatch(name.headline, /documentation/);
  const E = judge(synthetic, 'find', '-E', 'macos');
  assert.equal(E.status, 'ok', 'an option with a documentation line keeps the documented verdict');
});

test('verdict: scenario probes with the BSD and the GNU unknown-primary wording both name the primary', () => {
  const r = judge(synthetic, 'find', '-regextype', 'macos');
  assert.equal(r.status, 'rejected');
  assert.equal(r.probe!.id, 'find-regextype');
  const g = judge(synthetic, 'find', '-xautofs', 'macos');
  assert.equal(g.status, 'rejected', "GNU says unknown predicate `-x'; that names the primary too");
});

const db = JSON.parse(readFileSync(path.resolve('data/flags.json'), 'utf8')) as Database;
let parser: Parser;
before(async () => {
  await Parser.init();
  const lang = await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm'));
  parser = new Parser();
  parser.setLanguage(lang);
});

test('analyzer: the value of a primary is not read as another primary (-mtime -1, -perm -644, -fprintf FILE FORMAT)', () => {
  const a = analyzeScript(parser, `find . -mtime -1 -perm -644 -newermt 2020-01-01 -fprintf out.txt '%p' -name '*.log' -print0`, db);
  const cmd = a.commands.find((c) => c.name === 'find')!;
  const mentioned = [...cmd.flags.map((f) => f.flag), ...cmd.notes];
  for (const value of ['-1', '-644', 'out.txt', '%p']) assert.ok(!mentioned.some((m) => m.startsWith(value) || m.startsWith(`${value}:`)), `${value} is a value, not a primary: ${mentioned.join(' | ')}`);
  for (const primary of ['-mtime', '-perm', '-newermt', '-fprintf', '-name', '-print0']) assert.ok(mentioned.some((m) => m === primary || m.startsWith(`${primary}:`)), `${primary} should be judged or noted: ${mentioned.join(' | ')}`);
});
