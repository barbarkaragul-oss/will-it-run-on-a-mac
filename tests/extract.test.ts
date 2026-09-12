/**
 * The extractor is tested on real recordings copied from the collector's artifacts (tests/fixtures) and
 * on the committed database: every flag the page will ever mention must trace back to a line a real
 * platform printed, and the documented flags must agree with what actually happened when the probes ran.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseHelpText, parseMdoc, type Database } from '../scripts/extract.js';

const fx = (p: string) => readFileSync(path.resolve('tests/fixtures', p), 'utf8');
const db = JSON.parse(readFileSync(path.resolve('data/flags.json'), 'utf8')) as Database;

test('macOS sed man page (mdoc): the SYNOPSIS cluster and the option list give the BSD flag set; -i requires an argument; no -z', () => {
  const m = parseMdoc(fx('macos/sed/man.src'));
  const shorts = [...m.keys()].filter((k) => /^-[A-Za-z]$/.test(k)).sort().join('');
  assert.equal(shorts, '-E-H-I-a-e-f-i-l-n-r-u');
  assert.equal(m.get('-i')!.arg, 'required');
  assert.match(m.get('-i')!.evidence[0]!.line, /Fl i Ar extension/);
  assert.equal(m.has('-z'), false);
});

test('macOS sed --help answers with a usage line, which is a second source for the same flags', () => {
  const m = parseHelpText(fx('macos/sed/help.txt'), 'usage');
  assert.ok(m.has('-E') && m.has('-i') && m.has('-n'));
  assert.equal(m.get('-i')!.arg, 'required');
  assert.equal(m.has('-z'), false);
});

test('GNU sed --help: short and long options, -i takes an optional suffix, -z exists', () => {
  const m = parseHelpText(fx('ubuntu/sed/help.txt'), 'help');
  assert.equal(m.get('-i')!.arg, 'optional');
  assert.ok(m.has('--in-place'));
  assert.ok(m.has('-z') && m.has('--null-data'));
  assert.ok(m.has('-E') && m.has('-r'));
});

test('BusyBox sed usage: cluster [-nrE], -i[SFX] optional, -e and -f take a value, no -z', () => {
  const m = parseHelpText(fx('alpine/sed/help.txt'), 'usage');
  assert.equal(m.get('-i')!.arg, 'optional');
  assert.ok(m.has('-n') && m.has('-r') && m.has('-E'));
  assert.equal(m.get('-e')!.arg, 'required');
  assert.equal(m.has('-z'), false);
});

test('uniq: macOS documents -D, BusyBox does not; the probes agree', () => {
  assert.ok(parseMdoc(fx('macos/uniq/man.src')).has('-D'));
  assert.equal(parseHelpText(fx('alpine/uniq/help.txt'), 'usage').has('-D'), false);
  assert.equal(db.probes['uniq-D']!.results.macos!.code, 0);
  assert.notEqual(db.probes['uniq-D']!.results.alpine!.code, 0);
});

test('every flag in the database carries verbatim evidence from that platform', () => {
  let n = 0;
  for (const [tool, byPlatform] of Object.entries(db.tools)) {
    for (const [platform, t] of Object.entries(byPlatform)) {
      if (!t.present) continue;
      for (const [flag, info] of Object.entries(t.flags)) {
        n++;
        assert.ok(info.evidence.length >= 1, `${platform} ${tool} ${flag} has no evidence`);
        const name = flag.replace(/^--?/, '');
        assert.ok(info.evidence.some((e) => e.line.includes(name) || e.source === 'mdoc' || e.line.endsWith('...')), `${platform} ${tool} ${flag}: evidence does not mention the flag`);
      }
    }
  }
  assert.ok(n > 3000, `expected thousands of flags, got ${n}`);
});

test('documented flags agree with the executed probes, except where the docs are incomplete or the command is a shell builtin', () => {
  // A probe like "tool -x ..." rejected with "illegal option" while -x is documented, or accepted while -x is
  // undocumented, is a discrepancy. The known ones are listed with their reason; a new one fails the test.
  const known: Record<string, string> = {
    'date-d@macos': 'the man page still documents -d (set DST), the binary rejects it',
    'grep-color@alpine': 'BusyBox grep accepts --color but its usage text does not list it',
    'cp-reflink@alpine': 'BusyBox cp accepts --reflink but its usage text does not list it',
    'od-A@alpine': 'BusyBox od accepts -A but its usage text does not list it',
    'echo-e@macos': 'echo is a shell builtin under sh -c; the binary\'s man page is not what ran',
    'echo-e@alpine': 'echo is a shell builtin under sh -c',
    'echo-n@alpine': 'echo is a shell builtin under sh -c',
  };
  const found: string[] = [];
  for (const [id, pr] of Object.entries(db.probes)) {
    const m = /^(?:printf [^|]*\| )?([a-z0-9]+) (-[A-Za-z0-9]|--[a-z-]+)(?=[ =]|$)/.exec(pr.command);
    if (!m) continue;
    const [, tool, flag] = m;
    for (const [platform, r] of Object.entries(pr.results)) {
      const t = db.tools[tool!]?.[platform as keyof typeof pr.results];
      if (!t?.present || r.code === null) continue;
      const documented = flag! in t.flags;
      // Only count a rejection that names the probed flag itself ("illegal option -- d", "unrecognized option: include=...").
      const named = /option(?: --|:)? ?'?-{0,2}([A-Za-z0-9][A-Za-z0-9-]*)|unrecognized: (-{1,2}[A-Za-z0-9-]+)|Option (--?[A-Za-z0-9-]+) is not supported/.exec(r.stderr1);
      const rejectedName = named ? (named[1] ?? named[2] ?? named[3] ?? '').replace(/^-+/, '').replace(/=.*$/, '') : '';
      const rejected = r.code !== 0 && rejectedName === flag!.replace(/^-+/, '');
      const key = `${id}@${platform}`;
      if ((documented && rejected) || (!documented && r.code === 0)) { if (!(key in known)) found.push(`${key}: documented=${documented} code=${r.code} ${r.stderr1}`); }
    }
  }
  assert.deepEqual(found, []);
});
