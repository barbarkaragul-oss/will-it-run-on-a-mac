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
export interface ToolOnPlatform {
  present: boolean;
  path?: string;
  version?: string;
  flags: Record<string, FlagInfo>;
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
      const specArg: FlagInfo['arg'] = /^\s*-[A-Za-z0-9#?] [A-Z][A-Z_]*(\b|$)/.test(line) || /^\s+-[A-Za-z0-9#?] [a-z]+\t/.test(line) ? 'required' : 'none';
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
    for (const tool of readdirSync(pdir).filter((n) => !n.startsWith('_')).sort()) {
      (db.tools[tool] ??= {})[platform] = extractTool(platform, path.join(pdir, tool));
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
