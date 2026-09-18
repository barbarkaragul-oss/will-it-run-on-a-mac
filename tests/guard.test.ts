/**
 * Guards and caveat classes: a command that only runs where its tool exists is guarded, not a break; a recorded
 * failure is only carried over to a use of the same kind. The breaks that are real must stay breaks.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { analyzeScript, type Analysis, type CommandFinding } from '../src/engine/analyze.js';
import { judge, sameArgClass, probeArgOf } from '../src/engine/verdict.js';
import { countPlatform } from '../src/engine/counts.js';
import { checkSource } from '../src/action/core.js';
import type { Database } from '../scripts/extract.js';
import type { ShellsDatabase } from '../scripts/extract-shells.js';

const db = JSON.parse(readFileSync(path.resolve('data/flags.json'), 'utf8')) as Database;
const shellsDb = JSON.parse(readFileSync(path.resolve('data/shells.json'), 'utf8')) as ShellsDatabase;
let parser: Parser;
before(async () => {
  await Parser.init();
  const lang = await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm'));
  parser = new Parser();
  parser.setLanguage(lang);
});
const run = (src: string): Analysis => analyzeScript(parser, src, db);
const cmd = (a: Analysis, name: string, nth = 0): CommandFinding => {
  const c = a.commands.filter((x) => x.name === name)[nth];
  assert.ok(c, `no command ${name} #${nth}`);
  return c;
};

test('if command -v X; then X: X is guarded, and the verdict itself is unchanged', () => {
  const a = run('if command -v timeout >/dev/null 2>&1; then timeout 8 sleep 1; fi\n');
  const t = cmd(a, 'timeout');
  assert.equal(t.guard?.kind, 'command-v');
  assert.equal(t.guard?.tool, 'timeout');
  assert.equal(t.guard?.line, 0);
  assert.equal(t.tool?.macos, 'missing', 'the engine still records that timeout is not on macOS');
  assert.equal(countPlatform(a, 'macos').breaks, 0);
  assert.equal(countPlatform(a, 'macos').guarded, 1);
});

test('elif guards its own branch; else is not guarded by the condition that sent control there', () => {
  const a = run('if command -v gdate >/dev/null; then gdate -d x\nelif command -v perl >/dev/null; then perl -e x\nelse timeout 5 true\nfi\n');
  assert.equal(cmd(a, 'perl').guard?.tool, 'perl');
  assert.equal(cmd(a, 'timeout').guard, undefined);
  assert.equal(countPlatform(a, 'macos').breaks, 1, 'timeout in the else branch still breaks');
});

test('command -v X && X, which X && X, type and hash are guards; a negated one is not', () => {
  assert.equal(cmd(run('command -v tac >/dev/null && tac f\n'), 'tac').guard?.kind, 'command-v');
  assert.equal(cmd(run('which tac && tac f\n'), 'tac').guard?.kind, 'which');
  assert.equal(cmd(run('type tac >/dev/null 2>&1 && tac f\n'), 'tac').guard?.kind, 'type');
  assert.equal(cmd(run('hash tac 2>/dev/null && tac f\n'), 'tac').guard?.kind, 'hash');
  assert.equal(cmd(run('! command -v tac >/dev/null && tac f\n'), 'tac').guard, undefined);
  assert.equal(cmd(run('if ! command -v tac >/dev/null; then tac f; fi\n'), 'tac').guard, undefined);
});

test('a guard for another tool guards nothing', () => {
  assert.equal(cmd(run('if command -v perl >/dev/null; then timeout 5 true; fi\n'), 'timeout').guard, undefined);
  assert.equal(cmd(run('command -v perl >/dev/null && tac f\n'), 'tac').guard, undefined);
});

test('the right of || is a fallback, but an error path is not, and the left side is never guarded by it', () => {
  const a = run('T=$(mktemp -d 2>/dev/null || mktemp -d -t wiroam)\n');
  assert.equal(cmd(a, 'mktemp', 0).guard, undefined);
  assert.equal(cmd(a, 'mktemp', 1).guard?.kind, 'or-fallback');
  const b = run('timeout 5 true || exit 1\n');
  assert.equal(cmd(b, 'timeout').guard, undefined, 'cmd || exit 1 must still report cmd');
  assert.equal(countPlatform(b, 'macos').breaks, 1);
});

test('a guard does not leak out of the function it is in', () => {
  const a = run('f() { if command -v timeout >/dev/null; then timeout 1 true; fi; }\ntimeout 2 true\n');
  assert.equal(cmd(a, 'timeout', 0).guard?.kind, 'command-v');
  assert.equal(cmd(a, 'timeout', 1).guard, undefined);
});

test('an unguarded use is still a break', () => {
  const a = run('timeout 5 sleep 1\ndate -d yesterday\n');
  assert.equal(cmd(a, 'timeout').guard, undefined);
  assert.equal(countPlatform(a, 'macos').breaks, 2);
});

test('sameArgClass: only a difference known to matter lets a use escape a recorded failure', () => {
  const rows: [string | undefined, string | undefined, string, boolean][] = [
    ['1', '-1', 'head', false], ['-5', '-1', 'head', true], ['0', '-1', 'head', false], ['10', '1', 'head', true],
    ['', 's/a/b/', 'sed', false], ['', '', 'sed', true], ['s/foo/bar/g', 's/a/b/', 'sed', true],
    ['wiroam', 'x', 'mktemp', true], ['tmp.XXXXXX', 'x', 'mktemp', false], ['a.XXXX', 'b.XXXXXX', 'mktemp', true],
    ['tomorrow', 'yesterday', 'date', true], ['2 days ago', 'yesterday', 'date', true], ['2020-01-01', 'yesterday', 'date', false], ['@1700000000', 'yesterday', 'date', false],
    [undefined, '-1', 'head', true],
  ];
  for (const [s, q, tool, want] of rows) assert.equal(sameArgClass(s === undefined ? undefined : { value: s, isStatic: true }, q, tool), want, `${tool}: ${s} vs ${q}`);
  assert.equal(sameArgClass({ value: '$N', isStatic: false }, '-1', 'head'), true, 'a computed value stays covered');
});

test('probeArgOf reads the value a scenario gave the flag', () => {
  assert.equal(probeArgOf('head -n -1 f', 'head', '-n'), '-1');
  assert.equal(probeArgOf("sed -i 's/a/b/' f", 'sed', '-i'), 's/a/b/');
  assert.equal(probeArgOf('mktemp -t x', 'mktemp', '-t'), 'x');
  assert.equal(probeArgOf("printf 'b\\na' | head -n -1", 'head', '-n'), '-1');
  assert.equal(probeArgOf('date --date=yesterday', 'date', '--date'), 'yesterday');
});

test('caveats: head -n 1 is not head -n -1; the recorded failures of the same kind stay', () => {
  const macos = (tool: string, flag: string, value?: string) => judge(db, tool, flag, 'macos', 'bare', value === undefined ? undefined : { value, isStatic: true });
  assert.equal(macos('head', '-n', '1').caveat, undefined);
  assert.ok(macos('head', '-n', '-1').caveat, 'head -n -1 still failed on macOS');
  assert.ok(macos('sed', '-i', 's/a/b/').caveat, 'sed -i with a script still fails on macOS');
  assert.ok(macos('sed', '-i', 's/foo/bar/g').caveat, 'and so does a different script');
  const alpine = (tool: string, flag: string, value: string) => judge(db, tool, flag, 'alpine', 'bare', { value, isStatic: true });
  assert.ok(alpine('date', '-d', 'yesterday').caveat);
  assert.equal(alpine('date', '-d', '2020-01-01').caveat, undefined);
  assert.ok(alpine('mktemp', '-t', 'x').caveat);
  assert.equal(alpine('mktemp', '-t', 'tmp.XXXXXX').caveat, undefined);
});

test('the guarded fixture: nothing breaks, the guarded tools are counted as guarded and shown only with verbose', () => {
  const src = readFileSync(path.resolve('tests/fixtures/guarded.sh'), 'utf8');
  const engine = { parser, db, shellsDb };
  const r = checkSource(src, 'guarded.sh', engine, { platforms: ['macos', 'alpine'], verbose: false });
  assert.equal(r.perPlatform.macos!.breaks, 0);
  assert.equal(r.perPlatform.alpine!.breaks, 0);
  assert.ok(r.perPlatform.macos!.guarded >= 2, 'timeout and tac');
  assert.equal(r.perPlatform.macos!.caveats, 0, 'head -n 1 carries no caveat');
  assert.equal(r.findings.filter((f) => f.kind === 'guarded').length, 0);
  const loud = checkSource(src, 'guarded.sh', engine, { platforms: ['macos', 'alpine'], verbose: true });
  const g = loud.findings.find((f) => f.kind === 'guarded' && f.subject === 'timeout');
  assert.ok(g);
  assert.equal(g.severity, 'notice');
  assert.match(g.message, /guarded by `command -v timeout[^`]*` on line 4/);
});

test('the collector scripts, which run every week on all three platforms, report nothing that breaks', () => {
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.sh')) files.push(p); } };
  walk('collector');
  assert.ok(files.length >= 4);
  for (const f of files) {
    const a = run(readFileSync(f, 'utf8'));
    for (const p of ['macos', 'alpine'] as const) assert.equal(countPlatform(a, p).breaks, 0, `${f} on ${p}`);
  }
});
