/**
 * Every probe in collector/shells/probes.txt must be reachable from a script: parsing the probe's
 * own snippet with tree-sitter-bash and running findConstructs over it has to yield that probe id.
 * Otherwise the collector measures a construct the page can never point at.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { Parser, Language } from 'web-tree-sitter';
import { parseProbesFile } from '../scripts/extract-shells.js';
import { findConstructs } from '../src/engine/shells.js';

let parser: Parser;
before(async () => {
  await Parser.init();
  const lang = await Language.load(path.resolve('node_modules/tree-sitter-bash/tree-sitter-bash.wasm'));
  parser = new Parser();
  parser.setLanguage(lang);
});

const probes = parseProbesFile(readFileSync(path.resolve('collector/shells/probes.txt'), 'utf8'));

// probes whose own snippet is deliberately mapped to a different (more specific) id, or to none
const EXCEPTIONS: Record<string, { mapsTo: string; why: string }> = {
  // the identity probe only reports which interpreter answered; no script construct corresponds to it
  identity: { mapsTo: '', why: 'a version check, never mapped' },
  // whether a variable is unset when `set -u` is on cannot be read from the parse tree; the snippet's `set -u` itself is set_o_nounset.
  // The recording is kept as data (what each shell prints for the failure) but the engine never points at it.
  set_u_unset: { mapsTo: '', why: 'an unset variable under set -u is not statically detectable; data only' },
  // the generic shopt snippet turns on nullglob, which now has its own probe; `shopt` itself is reached by any other option
  shopt: { mapsTo: 'shopt_nullglob', why: 'its snippet uses nullglob, which has a dedicated probe' },
  // whether an assignment hits a read-only variable is not visible in the parse tree; the `readonly r=1` in the snippet is the
  // declaration probe. The recording is kept as data (what each shell does with the re-assignment) but the engine never points at it.
  readonly_assign: { mapsTo: 'readonly_declare', why: 're-assigning a readonly variable is not statically detectable; its snippet declares one' },
};
// never produced by findConstructs, whatever the script
const NEVER_MAPPED = Object.entries(EXCEPTIONS).filter(([, e]) => !e.mapsTo).map(([id]) => id);

const probesOf = (src: string) => findConstructs(parser.parse(src)!).map((h) => h.probe);

test('probes.txt has the expected shape: unique ids, short labels, one-line snippets', () => {
  const ids = Object.keys(probes);
  assert.ok(ids.length >= 140, `only ${ids.length} probes parsed`);
  assert.equal(new Set(ids).size, ids.length, 'duplicate probe id');
  for (const [id, p] of Object.entries(probes)) {
    assert.match(id, /^[a-z][a-z0-9_]+$/, `bad id ${id}`);
    assert.ok(p.label.length > 0 && p.label.length <= 60, `label of ${id} is ${p.label.length} chars`);
    assert.ok(!/[\t\n]/.test(p.snippet), `snippet of ${id} spans a line or contains a tab`);
  }
});

test('the snippets themselves do not duplicate one another', () => {
  const seen = new Map<string, string>();
  for (const [id, p] of Object.entries(probes)) {
    const other = seen.get(p.snippet);
    assert.equal(other, undefined, `${id} and ${other} share a snippet`);
    seen.set(p.snippet, id);
  }
});

for (const [id, p] of Object.entries(probes)) {
  const ex = EXCEPTIONS[id];
  if (ex && !ex.mapsTo) continue;
  const want = ex?.mapsTo ?? id;
  test(`probe ${id} is found in its own snippet${ex ? ` (as ${want}: ${ex.why})` : ''}`, () => {
    const got = probesOf(p.snippet + '\n');
    assert.ok(got.includes(want), `${want} not among [${[...new Set(got)].join(', ')}] for: ${p.snippet}`);
    if (ex) assert.ok(!got.includes(id), `${id} should not fire on its own snippet any more`);
  });
}

test('identity and set_u_unset are never mapped, even over every snippet at once', () => {
  const src = Object.values(probes).map((p) => p.snippet).join('\n') + '\n';
  const got = new Set(probesOf(src));
  assert.deepEqual(NEVER_MAPPED.sort(), ['identity', 'set_u_unset']);
  for (const id of NEVER_MAPPED) assert.ok(!got.has(id), `${id} was mapped`);
  // and the engine maps `set -u` to the probe whose bash reference succeeds
  assert.ok(probesOf('set -u\nset -euo pipefail\n').filter((p) => p === 'set_o_nounset').length === 2);
});
