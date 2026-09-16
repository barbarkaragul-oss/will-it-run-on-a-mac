/**
 * How much of the gap between zsh and bash does each compatibility knob actually close?
 *
 *   npx tsx scripts/zsh-knobs.ts [data/shells.json]
 *
 * The collector records every probe under a plain zsh and again under `-o shwordsplit`,
 * `-o ksharrays`, `-o nonomatch`, `-o octalzeroes`, `-o bashrematch`, all five at once, and
 * `--emulate sh` / `--emulate ksh` (collector/shells/probe-shells.sh). This reads those rows and
 * counts, per knob: how many of the constructs that a plain zsh gets wrong it puts right, how many
 * it leaves, and how many it breaks that were fine before -- the last column is the one nobody
 * mentions when they recommend `emulate sh`.
 *
 * "Wrong" means the recorded run differs from bash 5.2 on Ubuntu: either the construct errors
 * where bash succeeds, or both succeed and the first line of stdout differs.
 */
import { readFileSync } from 'node:fs';
import type { ShellsDatabase, ProbeResult } from './extract-shells.js';

const REFERENCE = 'ubuntu|/bin/bash';
/** the control probe only prints which shell it is, so it can never agree with bash */
const NOT_A_CONSTRUCT = new Set(['identity']);

type Verdict = 'same' | 'differs' | 'breaks' | 'unknown';

function verdict(ref: ProbeResult | undefined, got: ProbeResult | undefined): Verdict {
  if (!ref || !got) return 'unknown';
  if (ref.exit === 0 && got.exit !== 0) return 'breaks';
  if (ref.exit !== 0 && got.exit !== 0) return 'same';
  if (ref.exit !== 0 && got.exit === 0) return 'differs';
  return got.stdout1 === ref.stdout1 ? 'same' : 'differs';
}

export interface KnobReport {
  platform: string;
  knob: string;
  /** probes a plain zsh does not get right */
  gap: number;
  closed: string[];
  stillWrong: string[];
  /** probes that were right under a plain zsh and are wrong under the knob */
  broke: string[];
  unusable?: string;
}

export function knobReports(db: ShellsDatabase): KnobReport[] {
  const out: KnobReport[] = [];
  const ids = Object.keys(db.probes).filter((id) => !NOT_A_CONSTRUCT.has(id));
  for (const [platform, shells] of Object.entries(db.shells)) {
    const base = `${platform}|/bin/zsh`;
    if (!shells['/bin/zsh']) continue;
    const knobs = Object.keys(shells).filter((s) => s.startsWith('/bin/zsh+'));
    for (const shell of knobs) {
      const key = `${platform}|${shell}`;
      const r: KnobReport = { platform, knob: shell.slice('/bin/zsh+'.length), gap: 0, closed: [], stillWrong: [], broke: [] };
      let recorded = 0;
      for (const id of ids) {
        const p = db.probes[id]!;
        const before = verdict(p.results[REFERENCE], p.results[base]);
        const after = verdict(p.results[REFERENCE], p.results[key]);
        if (after !== 'unknown') recorded++;
        if (before === 'unknown' || after === 'unknown') continue;
        if (before !== 'same') {
          r.gap++;
          (after === 'same' ? r.closed : r.stillWrong).push(id);
        } else if (after !== 'same') r.broke.push(id);
      }
      if (recorded === 0) r.unusable = 'the shell rejected these options';
      out.push(r);
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('zsh-knobs.ts')) {
  const db = JSON.parse(readFileSync(process.argv[2] ?? 'data/shells.json', 'utf8')) as ShellsDatabase;
  const reports = knobReports(db);
  if (!reports.length) { console.log('no zsh knob rows in this database yet (run the collector)'); process.exit(0); }
  for (const platform of [...new Set(reports.map((r) => r.platform))]) {
    console.log(`\n${platform} (against bash ${db.shells['ubuntu']?.['/bin/bash']?.version ?? '?'})`);
    for (const r of reports.filter((x) => x.platform === platform)) {
      if (r.unusable) { console.log(`  ${r.knob.padEnd(14)} ${r.unusable}`); continue; }
      console.log(`  ${r.knob.padEnd(14)} closes ${String(r.closed.length).padStart(2)} of ${r.gap}${r.broke.length ? `, breaks ${r.broke.length} that were fine` : ''}`);
      if (r.closed.length) console.log(`      closed: ${r.closed.join(' ')}`);
      if (r.broke.length) console.log(`      broke:  ${r.broke.join(' ')}`);
    }
  }
}
