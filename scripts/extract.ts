/**
 * Turns the collector's raw recordings (out/<platform>/...) into the flag database (data/flags.json).
 *
 * Nothing here is written by hand: every flag comes with the verbatim line of the platform's own
 * --help output, usage message or man page that mentions it, and every probe is a command that was
 * actually executed on that platform with its exit code and first stderr line.
 *
 *   npx tsx scripts/extract.ts            # reads out/, writes data/flags.json
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type Platform = 'ubuntu' | 'macos' | 'alpine';
export const PLATFORMS: Platform[] = ['ubuntu', 'macos', 'alpine'];

export interface Evidence {
  /** help = `tool --help` output; usage = the usage line a BSD tool prints on an unknown option; mdoc = the man page source (.It Fl / .Op Fl); man = rendered man page text. */
  source: 'help' | 'usage' | 'mdoc' | 'man';
  line: string;
}
export interface FlagInfo {
  flag: string;
  /** Whether the flag takes an argument, as far as the source shows: none, optional, required, unknown. */
  arg: 'none' | 'optional' | 'required' | 'unknown';
  evidence: Evidence[];
}
/**
 * What happened when the flag was actually executed on the platform (collector/probe-all.sh): `rejected` means the
 * tool answered with its own unknown-option message (learned from a canary); `recognized` means it did not, whether
 * the command then succeeded or failed for another reason (missing operand, bad value).
 */
export interface RunResult {
  result: 'rejected' | 'recognized';
  code: number;
  stderr1: string;
  /** Which invocation the stderr line comes from: with an operand file, without, or as a find primary after the path. */
  form: 'with' | 'without' | 'primary';
}
export interface ToolOnPlatform {
  present: boolean;
  path?: string;
  version?: string;
  flags: Record<string, FlagInfo>;
  /** Execution results per flag, when the tool was safe to probe (see collector/probe-tools.txt). */
  runs?: Record<string, RunResult>;
  /** The tool's own wording for an unknown short and long option (and, for find, an unknown primary), as recorded from the canaries. */
  rejects?: { short: string; long: string; primary?: string };
  /** Which sources were available for this tool on this platform. */
  sources: Evidence['source'][];
  /** True when the tool printed something on --help that looks like GNU long-option help (so absence of a flag there means something). */
  helpParsed: boolean;
  manParsed: boolean;
}
export interface Probe {
  id: string;
  command: string;
  results: Partial<Record<Platform, { code: number | null; stderr1: string; stdout1: string }>>;
}
export interface PlatformInfo {
  platform: Platform;
  recorded_at: string;
  kernel: string;
  os: string;
  userland: string;
  sh: string;
  bash: string;
}
export interface Database {
  generated_at: string;
  platforms: Record<Platform, PlatformInfo>;
  tools: Record<string, Partial<Record<Platform, ToolOnPlatform>>>;
  probes: Record<string, Probe>;
}

const OUT = path.resolve('out');
const DATA = path.resolve('data');

const read = (p: string): string | undefined => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);

/** Parse `--help` / usage text (GNU coreutils help, BusyBox usage, BSD usage lines). */
export function parseHelpText(text: string, source: 'help' | 'usage' | 'man'): Map<string, FlagInfo> {
  const flags = new Map<string, FlagInfo>();
  const add = (flag: string, arg: FlagInfo['arg'], line: string) => {
    const f = flags.get(flag);
    if (f) { if (f.arg === 'unknown' && arg !== 'unknown') f.arg = arg; if (!f.evidence.some((e) => e.line === line)) f.evidence.push({ source, line }); return; }
    flags.set(flag, { flag, arg, evidence: [{ source, line }] });
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();
    // Usage lines: "usage: sed script [-EHalnru] [-i extension] [file ...]" (BSD) or "Usage: sed [-i[SFX]] [-nrE] ..." (BusyBox)
    if (/^(usage:|Usage:|\s*or:|\s+sed |\s*\[)/i.test(line) || /^usage/i.test(t)) {
      for (const m of t.matchAll(/\[-([A-Za-z0-9]+)(\[[^\]]*\])?\]/g)) {
        const letters = m[1]!;
        if (letters.length === 1) add('-' + letters, m[2] ? 'optional' : 'none', t);
        else for (const ch of letters) add('-' + ch, 'none', t);
      }
      for (const m of t.matchAll(/\[-([A-Za-z0-9]) ([a-z_]+(?:\[[^\]]*\])?)\]/g)) add('-' + m[1]!, 'required', t);
      for (const m of t.matchAll(/\[--([a-z][a-z0-9-]*)(=?\[?[^\]\s]*)\]/g)) add('--' + m[1]!, m[2] ? (m[2].startsWith('=') ? 'required' : 'unknown') : 'none', t);
    }
    // Option description lines: "  -n, --quiet", "  -i[SUFFIX], --in-place[=SUFFIX]", "\t-e CMD\tAdd CMD", "  -f, --canonicalize"
    const om = /^\s+(-[A-Za-z0-9#?])((?:\[[^\]]*\])?)(?:[ ,]|\t|$)/.exec(line);
    if (om) {
      // The option spec is the part before the description gap: "-E, -r, --regexp-extended", "-i[SUFFIX], --in-place[=SUFFIX]", "-e CMD".
      const spec = line.split(/\s{2,}|\t/).filter(Boolean)[0] ?? '';
      // "-d, --delimiter=CHARACTER": the short option takes the same argument as its long form; "-e CMD" / "-f FILE" say it directly.
      const longArg: FlagInfo['arg'] = /--[a-z][a-z0-9-]*\[=/.test(spec) ? 'optional' : /--[a-z][a-z0-9-]*=/.test(spec) ? 'required' : 'none';
      const specArg: FlagInfo['arg'] = /^\s*-[A-Za-z0-9#?] [A-Z][A-Z_]*(\b|$)/.test(line) || /^\s+-[A-Za-z0-9#?] [a-z]+\t/.test(line) ? 'required' : longArg;
      for (const sm of spec.matchAll(/(?:^\s*|,\s*)(-[A-Za-z0-9#?])((?:\[[^\]]*\])?)(?=[,\s]|$)/g)) add(sm[1]!, sm[2] ? 'optional' : specArg, t);
    }
    if (/^\s+(-[A-Za-z0-9#?](\[[^\]]*\])?,?\s+)*--[a-z]/.test(line) || /^\s+--[a-z]/.test(line)) {
      for (const m of line.matchAll(/--([a-z][a-z0-9-]*)(\[?=[^\s,]*)?/g)) {
        const arg: FlagInfo['arg'] = m[2] ? (m[2].startsWith('[') ? 'optional' : 'required') : 'none';
        add('--' + m[1]!, arg, t);
      }
    }
  }
  return flags;
}

/** Parse mdoc source (BSD/macOS man pages): .It Fl x [Ar y], .Op Fl abc (cluster in SYNOPSIS), .Fl Fl long. */
export function parseMdoc(src: string): Map<string, FlagInfo> {
  const flags = new Map<string, FlagInfo>();
  let section = '';
  const MACROS = new Set(['Ar', 'Ns', 'Op', 'Cm', 'Xo', 'Xc', 'Oo', 'Oc', 'Ic', 'Pa', 'Ql', 'Dq', 'Sq', 'Bq', 'Pq', 'Brq', 'Va', 'Fa', 'Dv', 'Em', 'Sy', 'Li', 'No', 'Nm', 'Fl', 'Ta', 'Bl', 'El', 'It', 'Pp', 'Xr', 'Sx', 'Ev', 'Ex', 'Rv', 'St', 'At', 'Bx', 'Fx', 'Nx', 'Ox', 'Ux', 'Ad', 'An', 'Er', 'Ft', 'Fn', 'Fo', 'Fc', 'In', 'Lb', 'Lk', 'Mt', 'Ms', 'Vt', 'Tn', 'Ap', 'Po', 'Pc', 'Qo', 'Qc', 'So', 'Sc', 'Do', 'Dc', 'Bo', 'Bc', 'Aq', 'Ao', 'Ac', 'Eo', 'Ec', 'Bf', 'Ef', 'Bd', 'Ed', 'D1', 'Dl', 'Rs', 'Re']);
  const add = (flag: string, arg: FlagInfo['arg'], line: string) => {
    const f = flags.get(flag);
    if (f) { if (f.arg === 'unknown' && arg !== 'unknown') f.arg = arg; if (!f.evidence.some((e) => e.line === line)) f.evidence.push({ source: 'mdoc', line }); return; }
    flags.set(flag, { flag, arg, evidence: [{ source: 'mdoc', line }] });
  };
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('.Sh ')) { section = line.slice(4).trim().toUpperCase(); continue; }
    if (!/^\.(It|Op|Fl|Oo)\b/.test(line)) continue;
    const toks = line.slice(1).split(/\s+/);
    for (let i = 0; i < toks.length; i++) {
      if (toks[i] !== 'Fl') continue;
      let j = i + 1;
      let dashes = '-';
      while (toks[j] === 'Fl') { dashes += '-'; j++; }
      const name = toks[j];
      if (!name || MACROS.has(name) || name.startsWith('\\')) { i = j; continue; }
      const next = toks[j + 1];
      const arg: FlagInfo['arg'] = next === 'Ar' ? 'required' : next === 'Op' || (next === 'Ns' && toks[j + 2] === 'Op') ? 'optional' : 'none';
      const clean = name.replace(/\\&/g, '').replace(/[,.;:]$/, '');
      const isCluster = dashes === '-' && section === 'SYNOPSIS' && /^[A-Za-z0-9]{2,}$/.test(clean) && toks[i - 1] === 'Op' && next !== 'Ar';
      if (isCluster) for (const ch of clean) add('-' + ch, 'none', line);
      else if (clean) add(dashes + clean, arg, line);
      i = j;
    }
  }
  return flags;
}

function parsePlatform(platform: Platform, text: string): PlatformInfo {
  const get = (re: RegExp) => (re.exec(text)?.[1] ?? '').trim();
  const lines = text.split('\n');
  return {
    platform,
    recorded_at: get(/^recorded_at=(.*)$/m),
    kernel: lines.find((l) => /^(Linux|Darwin) /.test(l))?.split(' ').slice(0, 3).join(' ') ?? '',
    os: get(/^PRETTY_NAME="?([^"\n]*)"?/m) || (get(/^ProductName:\s*(.*)$/m) ? `${get(/^ProductName:\s*(.*)$/m)} ${get(/^ProductVersion:\s*(.*)$/m)} (${get(/^BuildVersion:\s*(.*)$/m)})` : ''),
    userland: lines.find((l) => /^(ls \(GNU coreutils\)|BusyBox v)/.test(l)) ?? (platform === 'macos' ? 'BSD userland (macOS)' : ''),
    sh: get(/^sh=(.*)$/m),
    bash: get(/^bash=(.*)$/m),
  };
}

type Canaries = { short: string; long: string; primary?: string };
type ProbeRow = { flag: string; form: RunResult['form']; code: number; cls: string; stderr1: string };

/**
 * Parse _flagprobes.tsv into per-tool run results. A row is only usable when the canary of its kind (short option,
 * long option, find primary) printed something to compare against; tools whose canaries printed nothing are skipped.
 * The same flag can have rows of several kinds (find -a: an option before the path, an operator after it); it is
 * rejected only when every usable row rejected it.
 */
export function parseFlagProbes(text: string): Map<string, { runs: Record<string, RunResult>; rejects: Canaries }> {
  const byTool = new Map<string, { canary: Canaries; rows: ProbeRow[] }>();
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [tool, flag, form, code, cls, ...rest] = line.split('\t');
    if (!tool || !flag) continue;
    const stderr1 = rest.join('\t');
    const t = byTool.get(tool) ?? { canary: { short: '', long: '' }, rows: [] };
    byTool.set(tool, t);
    if (form === 'canary') {
      if (flag === '-~') t.canary.short = stderr1;
      else if (flag === '-wiroamnosuch') t.canary.primary = stderr1;
      else t.canary.long = stderr1;
      continue;
    }
    if (form !== 'with' && form !== 'without' && form !== 'primary') continue;
    t.rows.push({ flag, form, code: Number(code), cls: cls ?? '', stderr1 });
  }
  const out = new Map<string, { runs: Record<string, RunResult>; rejects: Canaries }>();
  for (const [tool, t] of byTool) {
    const runs: Record<string, RunResult> = {};
    const forms = new Map<string, ProbeRow[]>();
    for (const r of t.rows) (forms.get(r.flag) ?? forms.set(r.flag, []).get(r.flag)!).push(r);
    const canaryFor = (r: ProbeRow) => r.form === 'primary' ? t.canary.primary ?? '' : r.flag.startsWith('--') ? t.canary.long : t.canary.short;
    for (const [flag, all] of forms) {
      const rows = all.filter((r) => canaryFor(r)); // no wording to compare against: not classifiable
      if (!rows.length) continue;
      const rejectedAll = rows.every((r) => r.cls === 'rejected');
      const recognized = rows.find((r) => r.cls === 'accepted') ?? rows.find((r) => r.cls === 'other');
      if (rejectedAll) { const r = rows.find((x) => x.form === 'with') ?? rows[0]!; runs[flag] = { result: 'rejected', code: r.code, stderr1: r.stderr1.slice(0, 120), form: r.form }; }
      else if (recognized) runs[flag] = { result: 'recognized', code: recognized.code, stderr1: recognized.stderr1.slice(0, 120), form: recognized.form };
    }
    const rejects: Canaries = { short: t.canary.short, long: t.canary.long, ...(t.canary.primary ? { primary: t.canary.primary } : {}) };
    out.set(tool, { runs, rejects });
  }
  return out;
}

function parseProbes(platform: Platform, text: string, probes: Record<string, Probe>) {
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [id, code, stderr1, stdout1, ...cmd] = line.split('\t');
    if (!id) continue;
    const p = (probes[id] ??= { id, command: cmd.join('\t'), results: {} });
    p.results[platform] = { code: code === undefined || code === '?' ? null : Number(code), stderr1: stderr1 ?? '', stdout1: stdout1 ?? '' };
  }
}

export function extractTool(platform: Platform, dir: string): ToolOnPlatform {
  const pathTxt = (read(path.join(dir, 'path.txt')) ?? 'MISSING').trim();
  if (pathTxt === 'MISSING' || !pathTxt) return { present: false, flags: {}, sources: [], helpParsed: false, manParsed: false };
  const help = read(path.join(dir, 'help.txt')) ?? '';
  const helpCode = Number((read(path.join(dir, 'help.code')) ?? '1').trim());
  const version = (read(path.join(dir, 'version.txt')) ?? '').split('\n')[0]?.trim() ?? '';
  const manSrc = read(path.join(dir, 'man.src'));
  const manTxt = read(path.join(dir, 'man.txt'));
  const merged = new Map<string, FlagInfo>();
  const sources: Evidence['source'][] = [];
  const mergeIn = (m: Map<string, FlagInfo>) => {
    for (const [k, v] of m) {
      const cur = merged.get(k);
      if (!cur) merged.set(k, { ...v, evidence: [...v.evidence] });
      else { if (cur.arg === 'unknown' && v.arg !== 'unknown') cur.arg = v.arg; for (const e of v.evidence) if (!cur.evidence.some((x) => x.line === e.line)) cur.evidence.push(e); }
    }
  };
  let helpParsed = false;
  if (help.trim()) {
    // A real help text lists options; a BSD tool answers --help with "illegal option" plus its usage line, which is still a source.
    const isUsage = /illegal option|unrecognized option|invalid option|unknown option|^usage:/im.test(help) && !/--[a-z]+\s{2,}/.test(help);
    const m = parseHelpText(help, isUsage ? 'usage' : 'help');
    if (m.size) { mergeIn(m); sources.push(isUsage ? 'usage' : 'help'); helpParsed = !isUsage && helpCode === 0; }
  }
  let manParsed = false;
  if (manSrc && /^\.(Dd|Dt|Sh) /m.test(manSrc)) {
    const m = parseMdoc(manSrc);
    if (m.size) { mergeIn(m); sources.push('mdoc'); manParsed = true; }
  }
  if (manTxt && manTxt.trim()) {
    // Rendered man text: option paragraphs look like help lines ("  -i[SUFFIX], --in-place[=SUFFIX]" or "     -i extension").
    const m = parseHelpText(manTxt.replace(/^\s{5,}(-)/gm, '  $1'), 'man');
    if (m.size) { mergeIn(m); sources.push('man'); manParsed = true; }
  }
  const flags: Record<string, FlagInfo> = {};
  // Evidence is kept short: the first three distinct lines, each trimmed, is enough to show where a flag came from.
  for (const k of [...merged.keys()].sort()) { const f = merged.get(k)!; flags[k] = { ...f, evidence: f.evidence.slice(0, 3).map((e) => ({ source: e.source, line: e.line.length > 200 ? e.line.slice(0, 197) + '...' : e.line })) }; }
  return { present: true, path: pathTxt, version, flags, sources, helpParsed, manParsed };
}

export function buildDatabase(): Database {
  const db: Database = { generated_at: new Date().toISOString(), platforms: {} as Database['platforms'], tools: {}, probes: {} };
  for (const platform of PLATFORMS) {
    const pdir = path.join(OUT, platform);
    if (!existsSync(pdir)) { console.warn(`no recordings for ${platform}`); continue; }
    db.platforms[platform] = parsePlatform(platform, read(path.join(pdir, '_platform.txt')) ?? '');
    parseProbes(platform, read(path.join(pdir, '_probes.tsv')) ?? '', db.probes);
    const flagRuns = parseFlagProbes(read(path.join(pdir, '_flagprobes.tsv')) ?? '');
    for (const tool of readdirSync(pdir).filter((n) => !n.startsWith('_')).sort()) {
      const rec = extractTool(platform, path.join(pdir, tool));
      const fr = flagRuns.get(tool);
      if (fr && rec.present) { rec.runs = fr.runs; rec.rejects = fr.rejects; }
      (db.tools[tool] ??= {})[platform] = rec;
    }
  }
  return db;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const db = buildDatabase();
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path.join(DATA, 'flags.json'), JSON.stringify(db, null, 1) + '\n');
  const tools = Object.keys(db.tools).length;
  const counts = PLATFORMS.map((p) => `${p}: ${Object.values(db.tools).filter((t) => t[p]?.present).length} present, ${Object.values(db.tools).reduce((n, t) => n + Object.keys(t[p]?.flags ?? {}).length, 0)} flags`);
  console.log(`data/flags.json: ${tools} tools, ${Object.keys(db.probes).length} probes\n  ${counts.join('\n  ')}`);
}
