/**
 * Decides, for one command flag on one platform, what the recorded evidence says. The order of trust:
 * a real execution (probe) beats documentation, documentation beats silence, and silence is reported as
 * unknown rather than guessed.
 */
import type { Database, Platform, ToolOnPlatform, Evidence, RunResult } from '../../scripts/extract.js';

export type Status =
  | 'ok'            // documented on this platform (and no probe contradicts it)
  | 'ok-probed'     // not documented, but a recorded run on this platform accepted it
  | 'missing'       // the platform's own documentation lists this tool's flags and this one is not among them
  | 'rejected'      // a recorded run on this platform rejected it (even if the docs mention it)
  | 'missing-tool'  // the tool itself is not on this platform
  | 'builtin'       // handled by the shell, not by a binary: depends on the shell, not the userland
  | 'unknown';      // no usable documentation for this tool on this platform

export interface Verdict {
  platform: Platform;
  tool: string;
  flag: string;
  status: Status;
  /** One sentence for the card. */
  headline: string;
  evidence: Evidence[];
  /** The exhaustive execution result for this flag on this platform, when the tool was probed. */
  run?: RunResult;
  /** A scenario probe that exercised exactly this flag. */
  probe?: { id: string; command: string; code: number | null; stderr1: string };
}

/** Commands that are shell builtins in every common /bin/sh; their flags depend on the shell. */
export const BUILTINS = new Set(['echo', 'printf', 'test', '[', 'cd', 'export', 'read', 'set', 'unset', 'shift', 'exit', 'return', 'eval', 'exec', 'source', '.', 'alias', 'type', 'ulimit', 'umask', 'wait', 'trap', 'true', 'false', 'pwd', 'local', 'declare', 'typeset', 'let', 'getopts', 'hash', 'jobs', 'fg', 'bg', 'command', 'builtin', 'times', 'readonly', 'break', 'continue']);

const PLATFORM_LABEL: Record<Platform, string> = { ubuntu: 'Ubuntu (GNU)', macos: 'macOS (BSD)', alpine: 'Alpine (BusyBox)' };

export function probeFor(db: Database, tool: string, flag: string, platform: Platform) {
  // A probe counts when its command starts with the tool (optionally after a `printf ... |` feed) and carries the flag
  // as its first option; failing that, a probe of the same tool that uses the flag anywhere (find . -name f -printf ...).
  const esc = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = new RegExp(`^(?:printf [^|]*\\| )?${tool} ${esc}(?=[ =]|$)`);
  const anywhere = new RegExp(`^(?:printf [^|]*\\| )?${tool} .*(?:^|\\s)${esc}(?=[\\s=]|$)`);
  const name = flag.replace(/^-+/, '');
  const pick = (re: RegExp) => {
    const hits = Object.values(db.probes).filter((p) => re.test(p.command) && p.results[platform]).map((p) => ({ id: p.id, command: p.command, code: p.results[platform]!.code, stderr1: p.results[platform]!.stderr1 }));
    // Prefer a conclusive answer for this flag: a rejection that names it, then a clean run, then anything.
    return hits.find((x) => x.code !== null && x.code !== 0 && rejectedName(x.stderr1) === name) ?? hits.find((x) => x.code === 0) ?? hits[0];
  };
  return pick(first) ?? pick(anywhere);
}

/** Tools whose single-dash words are an expression language (find -name, test -f): their man pages list primaries in a form the extractor does not parse, so "not documented" would be a false claim. */
export const EXPRESSION_TOOLS = new Set(['find', 'test', '[', 'expr']);

function rejectedName(stderr1: string): string {
  const m = /option(?: --|:)? ?'?-{0,2}([A-Za-z0-9][A-Za-z0-9-]*)|unrecognized: (-{1,2}[A-Za-z0-9-]+)|Option (--?[A-Za-z0-9-]+) is not supported|unknown primary or operator: (-[A-Za-z0-9-]+)|(-[A-Za-z0-9-]+): unknown primary/.exec(stderr1);
  return m ? (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').replace(/^-+/, '').replace(/=.*$/, '') : '';
}

/** Does this tool's record on this platform list its options completely enough that absence means something? */
export function documentationIsComplete(t: ToolOnPlatform): boolean {
  // GNU --help and BSD mdoc pages enumerate options; a bare BSD usage line only shows the letters, which is still an
  // enumeration; a rendered man page alone (Ubuntu curl) is also an enumeration. Anything else is unknown.
  return t.sources.includes('help') || t.sources.includes('mdoc') || t.sources.includes('usage') || t.sources.includes('man');
}

export function judge(db: Database, tool: string, flag: string, platform: Platform): Verdict {
  const label = PLATFORM_LABEL[platform];
  if (BUILTINS.has(tool)) {
    return { platform, tool, flag, status: 'builtin', headline: `${tool} is a shell builtin: what ${flag} does depends on the shell (macOS /bin/sh is bash 3.2 in POSIX mode, Ubuntu's is dash, Alpine's is BusyBox ash), not on the userland.`, evidence: [] };
  }
  const t = db.tools[tool]?.[platform];
  if (!t) return { platform, tool, flag, status: 'unknown', headline: `${tool} was not recorded on ${label}.`, evidence: [] };
  if (!t.present) return { platform, tool, flag, status: 'missing-tool', headline: `${tool} does not exist on ${label} (command -v ${tool} found nothing on the recorded system).`, evidence: [] };
  const info = t.flags[flag];
  const when = db.platforms[platform] ? ` (${db.platforms[platform].os || label}, run on ${db.platforms[platform].recorded_at.slice(0, 10)})` : '';
  const argNote = info?.arg === 'required' ? ', takes a required argument here' : info?.arg === 'optional' ? ', argument optional here' : '';
  const probe = probeFor(db, tool, flag, platform);
  // 1. The flag was executed on this platform by the exhaustive probe: that answer wins.
  const run = t.runs?.[flag];
  if (run) {
    if (run.result === 'rejected') {
      return { platform, tool, flag, status: 'rejected', headline: `${tool} ${flag} does not exist on ${label}: the binary answered "${run.stderr1}"${when}${info ? '. The documentation still mentions it' : ''}.`, evidence: info?.evidence ?? [], run, ...(probe ? { probe } : {}) };
    }
    const how = run.code === 0 ? 'exit 0' : run.stderr1 ? `it complained about something else: "${run.stderr1}"` : `exit ${run.code}, no option error`;
    // A scenario probe can still show the flag behaving differently (date -d yesterday on BusyBox: the flag exists, the date format does not).
    const caveat = probe && probe.code !== null && probe.code !== 0 && rejectedName(probe.stderr1) !== flag.replace(/^-+/, '') ? ` The recorded command "${probe.command}" still failed there: "${probe.stderr1}".` : '';
    if (info) return { platform, tool, flag, status: 'ok', headline: `${tool} ${flag} exists on ${label}${argNote}; executed there, ${how}${when}.${caveat}`, evidence: info.evidence, run, ...(probe ? { probe } : {}) };
    return { platform, tool, flag, status: 'ok-probed', headline: `${tool} ${flag} is not in ${label}'s documentation, but the binary accepts it: executed there, ${how}${when}.${caveat}`, evidence: [], run, ...(probe ? { probe } : {}) };
  }
  // 2. One of the scenario probes (collector/probes.txt) exercised exactly this flag.
  if (probe && probe.code !== null) {
    const name = flag.replace(/^-+/, '');
    if (probe.code !== 0 && rejectedName(probe.stderr1) === name) {
      return { platform, tool, flag, status: 'rejected', headline: info ? `${tool} ${flag} is documented on ${label} but the recorded run rejected it: "${probe.stderr1}".` : `${tool} ${flag} was rejected on ${label}: "${probe.stderr1}".`, evidence: info?.evidence ?? [], probe };
    }
    if (probe.code === 0 && !info) {
      return { platform, tool, flag, status: 'ok-probed', headline: `${tool} ${flag} is not in ${label}'s documentation, but the recorded run accepted it (exit 0).`, evidence: [], probe };
    }
  }
  // 3. Documentation only.
  if (info) {
    return { platform, tool, flag, status: 'ok', headline: `${tool} ${flag} is documented on ${label}${argNote ? ` (${argNote.slice(2)})` : ''}; not executed there.`, evidence: info.evidence, ...(probe ? { probe } : {}) };
  }
  if (probe && probe.code !== null && probe.code !== 0 && !info) {
    return { platform, tool, flag, status: 'unknown', headline: `${tool} ${flag}: the only recorded command using it failed on ${label} for another reason ("${probe.stderr1}"), and no documentation for it was parsed.`, evidence: [], probe };
  }
  if (documentationIsComplete(t) && !EXPRESSION_TOOLS.has(tool)) {
    const usage = Object.values(t.flags).flatMap((f) => f.evidence).find((e) => e.source === 'usage' || e.source === 'help');
    return { platform, tool, flag, status: 'missing', headline: `${tool} ${flag} is not among the options ${label}'s ${t.sources.join('/')} lists for ${tool}${t.version ? ` (${t.version})` : ''}; not executed there.`, evidence: usage ? [usage] : [], ...(probe ? { probe } : {}) };
  }
  return { platform, tool, flag, status: 'unknown', headline: `No usable option list was recorded for ${tool} on ${label}.`, evidence: [] };
}

/** Split a command word into the flags it carries: "-rf" -> ["-r","-f"], "--foo=bar" -> ["--foo"], "-n5" -> ["-n"] (when -n takes an argument). */
export function flagsInWord(word: string, argTakers: Set<string>): string[] {
  if (word === '-' || word === '--' || !word.startsWith('-')) return [];
  if (word.startsWith('--')) return [word.replace(/=.*$/, '')];
  const out: string[] = [];
  for (let i = 1; i < word.length; i++) {
    const f = '-' + word[i]!;
    out.push(f);
    if (argTakers.has(f)) break; // the rest of the word is the argument ("-n5", "-i.bak")
  }
  return out;
}
