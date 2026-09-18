/**
 * The GitHub Action: find the shell scripts, run the core on them, and report the result the three ways a
 * workflow run can show it -- annotations on the lines, a step summary, and outputs -- then fail if something breaks.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { loadEngine, checkFiles, parsePlatforms, platformLine, PLATFORM_NAME, SITE, badgeSnippet, type Finding, type Report } from './core.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function lines(name: string): string[] {
  return core.getInput(name).split('\n').map((s) => s.trim()).filter(Boolean);
}

function annotate(f: Finding): void {
  const props = { title: f.title, file: f.file, startLine: f.line, startColumn: f.column, endLine: f.endLine, ...(f.endLine === f.line ? { endColumn: f.endColumn } : {}) };
  if (f.severity === 'error') core.error(f.message, props);
  else if (f.severity === 'warning') core.warning(f.message, props);
  else core.notice(f.message, props);
}

const WARN_LABEL: Partial<Record<Finding['kind'], string>> = {
  caveat: 'exists, failed in use', undocumented: 'not documented', 'shell-differs': 'prints something else', 'parse-error': 'did not parse',
};
const cut = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\|/g, '\\|');

async function writeSummary(r: Report): Promise<void> {
  const t = r.totals;
  const s = core.summary.addHeading('Will it run on a Mac?', 2)
    .addRaw(`${t.filesChecked} file${t.filesChecked === 1 ? '' : 's'}, ${t.commands} command${t.commands === 1 ? '' : 's'}, ${t.flags} flag${t.flags === 1 ? '' : 's'} checked against what the platforms' own binaries did when the flags were run (database recorded ${r.databaseRecordedAt.slice(0, 10)}).`, true)
    .addList(r.platforms.map((p) => platformLine(p, t.perPlatform[p]!)));
  const rows = r.files.flatMap((f) => f.findings).filter((f) => f.severity !== 'notice');
  if (rows.length) {
    s.addTable([
      [{ data: 'Where', header: true }, { data: 'What', header: true }, { data: 'Platform', header: true }, { data: 'Verdict', header: true }, { data: 'Evidence', header: true }],
      ...rows.slice(0, 200).map((f) => [
        `${esc(f.file)}:${f.line}`,
        `<code>${esc(f.flag ? `${f.subject} ${f.flag}` : f.subject)}</code>`,
        f.platform ? PLATFORM_NAME[f.platform] : '',
        f.severity === 'error' ? '❌ breaks' : `⚠️ ${WARN_LABEL[f.kind] ?? f.kind}`,
        esc(cut(f.message, 220)),
      ]),
    ]);
    if (rows.length > 200) s.addRaw(`…and ${rows.length - 200} more in the JSON report.`, true);
  }
  s.addRaw(`Paste a script at <a href="${SITE}">${SITE}</a> to see the full evidence for each flag. To show it in your README: the first badge is this workflow's status and turns red when something breaks; the second says what the scripts are checked with.`, true)
    .addCodeBlock(badgeSnippet(process.env.GITHUB_REPOSITORY, process.env.GITHUB_WORKFLOW_REF), 'markdown');
  await s.write();
}

async function run(): Promise<void> {
  const platforms = parsePlatforms(core.getInput('platforms'));
  const failOnBreak = core.getBooleanInput('fail-on-break');
  const verbose = core.getBooleanInput('verbose');
  const reportPath = core.getInput('report-path') || 'wiroam-report.json';
  const patterns = [...lines('files'), ...lines('exclude').map((e) => (e.startsWith('!') ? e : `!${e}`))];

  const globber = await glob.create(patterns.join('\n'), { followSymbolicLinks: false, matchDirectories: false });
  const matched = (await globber.glob()).sort();
  if (matched.length === 0) {
    core.notice('No shell scripts matched the files patterns; nothing to check.');
    core.setOutput('breaks', 0); core.setOutput('warnings', 0); core.setOutput('files-checked', 0);
    return;
  }

  const engine = await loadEngine({
    treeSitterWasm: path.join(here, 'vendor', 'web-tree-sitter.wasm'),
    bashWasm: path.join(here, 'vendor', 'tree-sitter-bash.wasm'),
    flagsJson: path.join(here, '..', 'data', 'flags.json'),
    shellsJson: path.join(here, '..', 'data', 'shells.json'),
  });
  const cwd = process.cwd();
  const files = matched.map((abs) => ({ path: path.relative(cwd, abs).split(path.sep).join('/'), src: readFileSync(abs, 'utf8') }));
  const report = checkFiles(files, engine, { platforms, verbose });

  // GitHub keeps only the first few annotations of each kind per step; the errors go first so they are the ones kept
  const all = report.files.flatMap((f) => f.findings);
  for (const sev of ['error', 'warning', 'notice'] as const) for (const f of all) if (f.severity === sev) annotate(f);

  for (const p of platforms) core.info(platformLine(p, report.totals.perPlatform[p]!));
  await writeSummary(report);

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  core.setOutput('breaks', report.totals.errors);
  core.setOutput('warnings', report.totals.warnings);
  core.setOutput('files-checked', report.totals.filesChecked);
  for (const p of platforms) core.setOutput(`breaks-${p}`, report.totals.perPlatform[p]!.breaks);
  core.setOutput('report', reportPath);

  if (failOnBreak && report.totals.errors > 0) {
    const where = platforms.filter((p) => { const c = report.totals.perPlatform[p]!; return c.breaks + c.shellBreaks > 0; }).map((p) => PLATFORM_NAME[p]);
    core.setFailed(`${report.totals.errors} thing${report.totals.errors === 1 ? '' : 's'} will break on ${where.join(' and ')}; see the annotations and the job summary.`);
  }
}

if (!existsSync(path.join(here, '..', 'data', 'flags.json'))) core.setFailed(`the flag database is missing next to the action (${path.join(here, '..', 'data', 'flags.json')})`);
else run().catch((e: unknown) => core.setFailed(e instanceof Error ? e.message : String(e)));
