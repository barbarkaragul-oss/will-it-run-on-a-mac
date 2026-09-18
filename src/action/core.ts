/**
 * The part of the GitHub Action and the command line tool that knows nothing about GitHub: load the parser and the
 * databases, run the same engine the page runs on each file, and turn its verdicts into findings with a severity.
 * The counts follow the page exactly (src/ui/main.ts render/worst), so "N will break" means the same thing in CI.
 */
import { readFileSync, existsSync } from 'node:fs';
import { Parser, Language } from 'web-tree-sitter';
import { analyzeTree, PLATFORMS } from '../engine/analyze.js';
import { analyzeShells, detectShebang, targetsFor } from '../engine/shells.js';
import { countPlatform, classifyTool, classifyFlag, guardPhrase } from '../engine/counts.js';
import type { Database, Platform } from '../../scripts/extract.js';
import type { ShellsDatabase } from '../../scripts/extract-shells.js';

export { PLATFORMS };
export type { Platform };

export const PLATFORM_NAME: Record<Platform, string> = { ubuntu: 'Ubuntu', macos: 'macOS', alpine: 'Alpine' };
/** Ubuntu is the reference the scripts were written against; by default only the other two are reported. */
export const DEFAULT_PLATFORMS: Platform[] = ['macos', 'alpine'];

export type Severity = 'error' | 'warning' | 'notice';
export type FindingKind =
  | 'rejected'       // the binary rejected the flag when it was run there
  | 'missing-tool'   // the tool is not on the platform at all
  | 'caveat'         // the flag exists, but the recorded command using it still failed there
  | 'undocumented'   // the platform's documentation lists the tool's flags and this one is not among them
  | 'shell-breaks'   // bash runs the construct, this shell errors
  | 'shell-differs'  // both run it, they print different things
  | 'guarded'        // would break, but the command only runs where it can (command -v, || fallback)
  | 'parse-error'
  | 'unchecked'      // $OPTS, a dynamic command name: reported as not checked
  | 'unknown-tool';

export interface Finding {
  severity: Severity;
  kind: FindingKind;
  file: string;
  /** 1-based, as GitHub annotations want them */
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  platform?: Platform;
  /** the command, or the shell construct */
  subject: string;
  /** the flag, when there is one */
  flag?: string;
  title: string;
  message: string;
}

export interface PlatformCount {
  /** the page's "N will break": rejected flags plus commands whose tool is missing */
  breaks: number;
  /** the page's "N not documented there" */
  undocumented: number;
  /** flags that exist but whose recorded use failed there */
  caveats: number;
  /** breaks and failed uses in commands that only run where they can (command -v X, the right of ||) */
  guarded: number;
  /** shell constructs that error under the shell the shebang reaches there */
  shellBreaks: number;
}

export interface FileReport {
  file: string;
  interp: string | null;
  commands: number;
  flags: number;
  unchecked: number;
  parseErrors: number;
  perPlatform: Partial<Record<Platform, PlatformCount>>;
  findings: Finding[];
}

export interface Report {
  generatedAt: string;
  databaseRecordedAt: string;
  platforms: Platform[];
  files: FileReport[];
  totals: {
    filesChecked: number;
    commands: number;
    flags: number;
    errors: number;
    warnings: number;
    perPlatform: Partial<Record<Platform, PlatformCount>>;
  };
}

export interface Engine {
  parser: Parser;
  db: Database;
  shellsDb: ShellsDatabase | undefined;
}

export interface EnginePaths {
  treeSitterWasm: string;
  bashWasm: string;
  flagsJson: string;
  shellsJson: string;
}

export interface CheckOptions {
  platforms: Platform[];
  verbose: boolean;
}

export async function loadEngine(paths: EnginePaths): Promise<Engine> {
  // bundled, web-tree-sitter cannot find its own wasm next to itself, so it is told where it is
  await Parser.init({ locateFile: () => paths.treeSitterWasm });
  const lang = await Language.load(paths.bashWasm);
  const parser = new Parser();
  parser.setLanguage(lang);
  const db = JSON.parse(readFileSync(paths.flagsJson, 'utf8')) as Database;
  const shellsDb = existsSync(paths.shellsJson) ? (JSON.parse(readFileSync(paths.shellsJson, 'utf8')) as ShellsDatabase) : undefined;
  return { parser, db, shellsDb };
}

export function parsePlatforms(input: string): Platform[] {
  const wanted = input.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return [...DEFAULT_PLATFORMS];
  const bad = wanted.filter((w) => !(PLATFORMS as string[]).includes(w));
  if (bad.length) throw new Error(`unknown platform ${bad.map((b) => `"${b}"`).join(', ')}; use ${PLATFORMS.join(', ')}`);
  return PLATFORMS.filter((p) => wanted.includes(p));
}

const emptyCount = (): PlatformCount => ({ breaks: 0, undocumented: 0, caveats: 0, guarded: 0, shellBreaks: 0 });
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, notice: 2 };

export function checkSource(src: string, file: string, engine: Engine, opts: CheckOptions): FileReport {
  const { parser, db, shellsDb } = engine;
  const tree = parser.parse(src);
  if (!tree) throw new Error(`${file}: the parser returned nothing`);
  const a = analyzeTree(tree, db, parser);
  const findings: Finding[] = [];
  const perPlatform: Partial<Record<Platform, PlatformCount>> = {};
  for (const p of opts.platforms) perPlatform[p] = emptyCount();

  // the counts come from the same function the page uses; the findings below are the same classification, itemized
  for (const p of opts.platforms) perPlatform[p] = { ...countPlatform(a, p), shellBreaks: 0 };
  for (const c of a.commands) {
    const at = { file, line: c.start.row + 1, column: c.start.column + 1, endLine: c.end.row + 1, endColumn: c.end.column + 1 };
    const guarded = guardPhrase(c);
    for (const p of opts.platforms) {
      const t = classifyTool(c, p);
      const missing = `${c.name} is not on ${PLATFORM_NAME[p]} at all: the tool itself is missing there, so every use of it breaks.`;
      if (t === 'break') findings.push({ ...at, severity: 'error', kind: 'missing-tool', platform: p, subject: c.name, title: `${c.name} is not on ${PLATFORM_NAME[p]}`, message: missing });
      else if (t === 'guarded' && opts.verbose) findings.push({ ...at, severity: 'notice', kind: 'guarded', platform: p, subject: c.name, title: `${c.name} is not on ${PLATFORM_NAME[p]}, but it is guarded`, message: `${c.name} is not on ${PLATFORM_NAME[p]} at all, but this command ${guarded}.` });
      for (const f of c.flags) {
        const v = f.verdicts[p];
        const fat = { file, line: f.start.row + 1, column: f.start.column + 1, endLine: f.end.row + 1, endColumn: f.end.column + 1 };
        const base = { ...fat, platform: p, subject: c.name, flag: f.flag, message: v.headline };
        switch (classifyFlag(c, f, p)) {
          case 'break': findings.push({ ...base, severity: 'error', kind: 'rejected', title: `${c.name} ${f.flag} breaks on ${PLATFORM_NAME[p]}` }); break;
          case 'undocumented': findings.push({ ...base, severity: 'warning', kind: 'undocumented', title: `${c.name} ${f.flag} is not documented on ${PLATFORM_NAME[p]}` }); break;
          case 'caveat': findings.push({ ...base, severity: 'warning', kind: 'caveat', title: `${c.name} ${f.flag} exists on ${PLATFORM_NAME[p]}, but this use failed there` }); break;
          case 'guarded': if (opts.verbose) findings.push({ ...base, severity: 'notice', kind: 'guarded', title: `${c.name} ${f.flag} on ${PLATFORM_NAME[p]}: guarded`, message: `${v.headline} This command ${guarded}.` }); break;
          default: break;
        }
      }
    }
    if (opts.verbose) for (const note of c.notes)
      findings.push({ ...at, severity: 'notice', kind: 'unchecked', subject: c.name, title: `${c.name}: not checked`, message: note });
  }
  if (opts.verbose) {
    const unchecked = a.commands.filter((c) => !c.checked);
    for (const c of unchecked) if (c.notes.length === 0)
      findings.push({ file, line: c.start.row + 1, column: c.start.column + 1, endLine: c.end.row + 1, endColumn: c.end.column + 1, severity: 'notice', kind: 'unchecked', subject: c.name, title: `${c.name}: not checked`, message: 'the command name is not static, so it was not checked' });
    for (const t of a.unknownTools) {
      const c = a.commands.find((x) => x.name === t)!;
      findings.push({ file, line: c.start.row + 1, column: c.start.column + 1, endLine: c.end.row + 1, endColumn: c.end.column + 1, severity: 'notice', kind: 'unknown-tool', subject: t, title: `${t}: not in the database`, message: `${t} is not one of the recorded tools, so its flags were not checked.` });
    }
  }

  const interp = detectShebang(src).interp;
  if (shellsDb) {
    const targets = targetsFor(interp, shellsDb).filter((t) => opts.platforms.includes(t.platform));
    for (const cf of analyzeShells(tree, shellsDb, targets)) {
      const at = { file, line: cf.start.row + 1, column: cf.start.column + 1, endLine: cf.end.row + 1, endColumn: cf.end.column + 1, subject: cf.label };
      for (const v of cf.verdicts) {
        if (v.status === 'breaks') {
          perPlatform[v.target.platform]!.shellBreaks++;
          findings.push({ ...at, severity: 'error', kind: 'shell-breaks', platform: v.target.platform, title: `${cf.label}: breaks under ${v.target.label}`, message: `${v.target.label}: ${v.headline}` });
        } else if (v.status === 'differs') {
          findings.push({ ...at, severity: 'warning', kind: 'shell-differs', platform: v.target.platform, title: `${cf.label}: differs under ${v.target.label}`, message: `${v.target.label}: ${v.headline}` });
        }
      }
    }
  }

  if (a.parseErrors.length) {
    const first = a.parseErrors[0]!;
    findings.push({ file, line: first.row + 1, column: first.column + 1, endLine: first.row + 1, endColumn: first.column + 1, severity: 'warning', kind: 'parse-error', subject: file,
      title: 'the script did not parse cleanly',
      message: `parse error at line ${first.row + 1}${a.parseErrors.length > 1 ? ` (and ${a.parseErrors.length - 1} more)` : ''}; the results for this file may be partial.` });
  }

  findings.sort((x, y) => x.line - y.line || x.column - y.column || SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
  return {
    file, interp,
    commands: a.commands.length,
    flags: a.commands.reduce((n, c) => n + c.flags.length, 0),
    unchecked: a.commands.reduce((n, c) => n + c.notes.length, 0) + a.commands.filter((c) => !c.checked).length,
    parseErrors: a.parseErrors.length,
    perPlatform, findings,
  };
}

export function checkFiles(files: { path: string; src: string }[], engine: Engine, opts: CheckOptions): Report {
  const reports = files.map((f) => checkSource(f.src, f.path, engine, opts));
  const perPlatform: Partial<Record<Platform, PlatformCount>> = {};
  for (const p of opts.platforms) {
    const sum = emptyCount();
    for (const r of reports) {
      const c = r.perPlatform[p];
      if (!c) continue;
      sum.breaks += c.breaks; sum.undocumented += c.undocumented; sum.caveats += c.caveats; sum.guarded += c.guarded; sum.shellBreaks += c.shellBreaks;
    }
    perPlatform[p] = sum;
  }
  const all = reports.flatMap((r) => r.findings);
  return {
    generatedAt: new Date().toISOString(),
    databaseRecordedAt: engine.db.generated_at,
    platforms: opts.platforms,
    files: reports,
    totals: {
      filesChecked: reports.length,
      commands: reports.reduce((n, r) => n + r.commands, 0),
      flags: reports.reduce((n, r) => n + r.flags, 0),
      errors: all.filter((f) => f.severity === 'error').length,
      warnings: all.filter((f) => f.severity === 'warning').length,
      perPlatform,
    },
  };
}

/** One line for a platform, worded as the page words it. */
export function platformLine(p: Platform, c: PlatformCount): string {
  const parts = [c.breaks ? `${c.breaks} will break` : 'nothing breaks'];
  if (c.caveats) parts.push(`${c.caveats} exist${c.caveats === 1 ? 's' : ''} but failed in use`);
  if (c.undocumented) parts.push(`${c.undocumented} not documented there`);
  if (c.shellBreaks) parts.push(`${c.shellBreaks} shell construct${c.shellBreaks === 1 ? '' : 's'} break`);
  if (c.guarded) parts.push(`${c.guarded} guarded`);
  return `${PLATFORM_NAME[p]}: ${parts.join(' · ')}`;
}

export const SITE = 'https://barbarkaragul-oss.github.io/will-it-run-on-a-mac/';
/** A fixed badge: says what the scripts are checked with and links here. It does not change colour; the workflow badge does. */
export const BADGE_MARKDOWN = `[![Will it run on a Mac?](https://img.shields.io/badge/will%20it%20run%20on%20a%20Mac%3F-checked%20in%20CI-2ea44f)](${SITE})`;

/**
 * The two badges for a README: the workflow's own status badge, which turns red when the check fails, and the fixed one
 * that says what the check is. In a run, GITHUB_REPOSITORY and GITHUB_WORKFLOW_REF name the repository and the workflow
 * file ("owner/repo/.github/workflows/scripts.yml@refs/heads/main"), so the first badge can be written out for them.
 */
export function badgeSnippet(repository?: string, workflowRef?: string): string {
  const m = repository && workflowRef ? /^(.+?)\/\.github\/workflows\/([^@/]+)@/.exec(workflowRef) : null;
  const [repo, file] = m && m[1] === repository ? [repository, m[2]!] : ['OWNER/REPO', 'WORKFLOW.yml'];
  const url = `https://github.com/${repo}/actions/workflows/${file}`;
  return `[![scripts](${url}/badge.svg)](${url})\n${BADGE_MARKDOWN}`;
}
