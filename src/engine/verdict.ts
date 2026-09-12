/**
 * Decides, for one command flag on one platform, what the recorded evidence says. The order of trust:
 * a real execution (probe) beats documentation, documentation beats silence, and silence is reported as
 * unknown rather than guessed.
 */
import type { Database, Platform, ToolOnPlatform, Evidence } from '../../scripts/extract.js';

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
  probe?: { id: string; command: string; code: number | null; stderr1: string };
}

/** Commands that are shell builtins in every common /bin/sh; their flags depend on the shell. */
export const BUILTINS = new Set(['echo', 'printf', 'test', '[', 'cd', 'export', 'read', 'set', 'unset', 'shift', 'exit', 'return', 'eval', 'exec', 'source', '.', 'alias', 'type', 'ulimit', 'umask', 'wait', 'trap', 'true', 'false', 'pwd', 'local', 'declare', 'typeset', 'let', 'getopts', 'hash', 'jobs', 'fg', 'bg', 'command', 'builtin', 'times', 'readonly', 'break', 'continue']);

const PLATFORM_LABEL: Record<Platform, string> = { ubuntu: 'Ubuntu (GNU)', macos: 'macOS (BSD)', alpine: 'Alpine (BusyBox)' };

function probeFor(db: Database, tool: string, flag: string, platform: Platform) {
  // A probe counts when its command starts with the tool and the flag, optionally after a `printf ... |` feed.
  for (const p of Object.values(db.probes)) {
    const m = /^(?:printf [^|]*\| )?([a-z0-9]+) (-[A-Za-z0-9]|--[a-z-]+)(?=[ =]|$)/.exec(p.command);
    if (!m || m[1] !== tool || m[2] !== flag) continue;
    const r = p.results[platform];
    if (!r) continue;
    return { id: p.id, command: p.command, code: r.code, stderr1: r.stderr1 };
  }
  return undefined;
}

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
  const probe = probeFor(db, tool, flag, platform);
  const info = t.flags[flag];
  if (probe && probe.code !== null) {
    const name = flag.replace(/^-+/, '');
    if (probe.code !== 0 && rejectedName(probe.stderr1) === name) {
      return { platform, tool, flag, status: 'rejected', headline: info ? `${tool} ${flag} is documented on ${label} but the recorded run rejected it: "${probe.stderr1}".` : `${tool} ${flag} was rejected on ${label}: "${probe.stderr1}".`, evidence: info?.evidence ?? [], probe };
    }
    if (probe.code === 0 && !info) {
      return { platform, tool, flag, status: 'ok-probed', headline: `${tool} ${flag} is not in ${label}'s documentation, but the recorded run accepted it (exit 0).`, evidence: [], probe };
    }
  }
  if (info) {
    const argNote = info.arg === 'required' ? ' (takes a required argument here)' : info.arg === 'optional' ? ' (argument optional here)' : '';
    return { platform, tool, flag, status: 'ok', headline: `${tool} ${flag} is documented on ${label}${argNote}.`, evidence: info.evidence, ...(probe ? { probe } : {}) };
  }
  if (documentationIsComplete(t)) {
    const usage = Object.values(t.flags).flatMap((f) => f.evidence).find((e) => e.source === 'usage' || e.source === 'help');
    return { platform, tool, flag, status: 'missing', headline: `${tool} ${flag} is not among the options ${label}'s ${t.sources.join('/')} lists for ${tool}${t.version ? ` (${t.version})` : ''}.`, evidence: usage ? [usage] : [], ...(probe ? { probe } : {}) };
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
