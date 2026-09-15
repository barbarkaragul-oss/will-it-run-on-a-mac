import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildShellsDatabase, parseProbesFile, parseShellsTsv } from '../scripts/extract-shells.js';

const PROBES = [
  '# comment',
  'array_index\tarrays start at 0\tarr=(a b c) || exit 9; printf \'%s\\n\' "${arr[1]}"',
  'glob_nomatch\ta glob with no match stays literal\tprintf \'%s\\n\' /definitely/not/here/*.xyz',
  '',
].join('\n');

// rows shaped exactly like collector/shells/probe-shells.sh writes them; values are from the 2026-09-15 recording
const TSV = [
  'platform\tshell\tkind\tversion\tprobe\texit\tstdout1\tstderr1',
  'macos\t/bin/bash\tbash\t3.2.57(1)-release\tarray_index\t0\tb\t',
  'macos\t/bin/zsh\tzsh\t5.9\tarray_index\t0\ta\t',
  'macos\t/bin/zsh\tzsh\t5.9\tglob_nomatch\t1\t\tzsh:1: no matches found: /definitely/not/here/*.xyz',
  'macos\t/bin/bash\tbash\t3.2.57(1)-release\tglob_nomatch\t0\t/definitely/not/here/*.xyz\t',
  'macos\t/bin/ksh\tmissing\t\t-\t-\t\tshell not present',
  '',
].join('\n');

test('parseProbesFile keeps id, label and the whole snippet (tabs inside the snippet included)', () => {
  const p = parseProbesFile(PROBES);
  assert.deepEqual(Object.keys(p), ['array_index', 'glob_nomatch']);
  assert.equal(p.array_index!.label, 'arrays start at 0');
  assert.ok(p.array_index!.snippet.startsWith('arr=(a b c)'));
});

test('parseShellsTsv returns one object per row with the header as keys', () => {
  const rows = parseShellsTsv(TSV);
  assert.equal(rows.length, 5);
  assert.equal(rows[1]!.shell, '/bin/zsh');
  assert.equal(rows[2]!.stderr1, 'zsh:1: no matches found: /definitely/not/here/*.xyz');
});

test('buildShellsDatabase records every shell and every result, and a missing shell as missing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wiroam-shells-'));
  mkdirSync(path.join(dir, 'out', 'macos'), { recursive: true });
  writeFileSync(path.join(dir, 'out', 'macos', '_shells.tsv'), TSV);
  writeFileSync(path.join(dir, 'probes.txt'), PROBES);
  const db = buildShellsDatabase(path.join(dir, 'out'), path.join(dir, 'probes.txt'));

  assert.deepEqual(db.shells.macos!['/bin/zsh'], { kind: 'zsh', version: '5.9' });
  assert.equal(db.shells.macos!['/bin/ksh']!.kind, 'missing');
  // zsh starts arrays at 1: the same snippet prints a, bash prints b
  assert.equal(db.probes.array_index!.results['macos|/bin/zsh']!.stdout1, 'a');
  assert.equal(db.probes.array_index!.results['macos|/bin/bash']!.stdout1, 'b');
  // zsh treats an unmatched glob as an error: exit 1 and the message is kept as evidence
  const g = db.probes.glob_nomatch!.results['macos|/bin/zsh']!;
  assert.equal(g.exit, 1);
  assert.match(g.stderr1, /no matches found/);
  // the "-" row for a missing shell never becomes a probe result
  assert.equal(Object.keys(db.probes.array_index!.results).length, 2);
});
