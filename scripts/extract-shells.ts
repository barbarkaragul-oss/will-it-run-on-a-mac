/**
 * Turns the shell-semantics recordings (out/<platform>/_shells.tsv) into data/shells.json.
 *
 *   npx tsx scripts/extract-shells.ts            # reads out/, writes data/shells.json
 *
 * The database says, for every probe and every shell on every platform, what actually happened:
 * exit code, first line of stdout, first line of stderr. It says nothing about what *should*
 * happen; the engine decides that against a reference (Ubuntu's bash), and the site shows both.
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type ShellKind = 'bash' | 'zsh' | 'ksh' | 'dash' | 'busybox' | 'missing' | string;

export interface ShellInfo { kind: ShellKind; version: string }
export interface ProbeResult { exit: number; stdout1: string; stderr1: string }
export interface ProbeRecord {
  label: string;
  snippet: string;
  /** keyed "<platform>|<shell path>", e.g. "macos|/bin/bash" */
  results: Record<string, ProbeResult>;
}
export interface ShellsDatabase {
  generated_at: string;
  /** platform -> shell path -> what the binary said it is */
  shells: Record<string, Record<string, ShellInfo>>;
  probes: Record<string, ProbeRecord>;
}

const OUT = path.resolve('out');
const DATA = path.resolve('data');

export function parseProbesFile(text: string): Record<string, { label: string; snippet: string }> {
  const out: Record<string, { label: string; snippet: string }> = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.startsWith('#')) continue;
    const fields = line.split('\t');
    // a probe with a missing TAB would otherwise vanish here and run as `sh -c ''` on every shell
    if (fields.length !== 3 || fields.some((f) => !f)) throw new Error(`probes.txt line ${i + 1}: expected id<TAB>label<TAB>snippet, got ${fields.length} fields: ${line.slice(0, 60)}`);
    const [id, label, snippet] = fields as [string, string, string];
    if (out[id]) throw new Error(`probes.txt line ${i + 1}: duplicate probe id ${id}`);
    out[id] = { label, snippet };
  }
  return out;
}

export function parseShellsTsv(text: string): { platform: string; shell: string; kind: string; version: string; probe: string; exit: string; stdout1: string; stderr1: string }[] {
  const lines = text.split('\n').filter((l) => l.length);
  const head = lines.shift()?.split('\t') ?? [];
  return lines.map((l) => {
    const cells = l.split('\t');
    const row: Record<string, string> = {};
    head.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row as ReturnType<typeof parseShellsTsv>[number];
  });
}

export function buildShellsDatabase(outDir = OUT, probesFile = path.resolve('collector/shells/probes.txt')): ShellsDatabase {
  const meta = parseProbesFile(readFileSync(probesFile, 'utf8'));
  const db: ShellsDatabase = { generated_at: new Date().toISOString(), shells: {}, probes: {} };
  for (const id of Object.keys(meta)) db.probes[id] = { ...meta[id]!, results: {} };

  for (const platform of readdirSync(outDir).sort()) {
    const f = path.join(outDir, platform, '_shells.tsv');
    if (!existsSync(f)) continue;
    for (const r of parseShellsTsv(readFileSync(f, 'utf8'))) {
      const shellsOnPlatform = (db.shells[r.platform] ??= {});
      shellsOnPlatform[r.shell] = { kind: r.kind, version: r.version };
      if (r.probe === '-') continue;
      const record = db.probes[r.probe];
      if (!record) continue; // a probe that was removed from probes.txt after the recording
      record.results[`${r.platform}|${r.shell}`] = { exit: Number(r.exit), stdout1: r.stdout1, stderr1: r.stderr1 };
    }
  }
  return db;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'extract-shells.ts'))) {
  const db = buildShellsDatabase();
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path.join(DATA, 'shells.json'), JSON.stringify(db, null, 1) + '\n');
  const shells = Object.entries(db.shells).map(([p, s]) => `${p}: ${Object.entries(s).map(([k, v]) => `${k} (${v.kind} ${v.version})`).join(', ')}`);
  const recorded = Object.values(db.probes).reduce((n, p) => n + Object.keys(p.results).length, 0);
  console.log(`data/shells.json: ${Object.keys(db.probes).length} probes, ${recorded} recorded results\n  ${shells.join('\n  ')}`);
}
