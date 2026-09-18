/**
 * The one place that decides what counts as a break. The page (src/ui/main.ts) and the GitHub Action
 * (src/action/core.ts) both count through here, so "N will break" means the same thing in both.
 */
import type { Analysis, CommandFinding, FlagFinding } from './analyze.js';
import type { Platform } from '../../scripts/extract.js';

export interface PlatformCounts {
  /** rejected flags plus missing tools, unguarded */
  breaks: number;
  /** flags the platform's documentation does not list */
  undocumented: number;
  /** flags that exist but whose recorded use of the same kind failed there, unguarded */
  caveats: number;
  /** breaks and caveats in commands that only run where they can (command -v, || fallback) */
  guarded: number;
}

export type Classification = 'break' | 'caveat' | 'undocumented' | 'guarded' | null;

/** The tool itself on a platform: missing is a break, or guarded when the command only runs where it exists. */
export function classifyTool(c: CommandFinding, p: Platform): 'break' | 'guarded' | null {
  if (c.tool?.[p] !== 'missing') return null;
  return c.guard ? 'guarded' : 'break';
}

/** One flag on one platform. */
export function classifyFlag(c: CommandFinding, f: FlagFinding, p: Platform): Classification {
  const v = f.verdicts[p];
  if (v.status === 'rejected') return c.guard ? 'guarded' : 'break';
  if (v.status === 'missing') return 'undocumented';
  if (v.caveat && v.status !== 'missing-tool') return c.guard ? 'guarded' : 'caveat';
  return null;
}

export function countPlatform(a: Analysis, p: Platform): PlatformCounts {
  const n: PlatformCounts = { breaks: 0, undocumented: 0, caveats: 0, guarded: 0 };
  const bump = (k: Classification | 'break' | 'guarded' | null): void => {
    if (k === 'break') n.breaks++; else if (k === 'caveat') n.caveats++; else if (k === 'undocumented') n.undocumented++; else if (k === 'guarded') n.guarded++;
  };
  for (const c of a.commands) {
    bump(classifyTool(c, p));
    for (const f of c.flags) bump(classifyFlag(c, f, p));
  }
  return n;
}

/** How the guard reads after "this command": "is guarded by `command -v timeout` on line 13", "runs only if `mktemp -d` fails (line 9)". */
export function guardPhrase(c: CommandFinding): string {
  if (!c.guard) return '';
  return c.guard.kind === 'or-fallback'
    ? `runs only if \`${c.guard.text}\` fails (line ${c.guard.line + 1})`
    : `is guarded by \`${c.guard.text}\` on line ${c.guard.line + 1}`;
}

/** The same, as a label on its own: "guarded by `command -v timeout` on line 13". */
export function guardLabel(c: CommandFinding): string {
  return guardPhrase(c).replace(/^is /, '');
}
