/**
 * The command line version: npx github:barbarkaragul-oss/will-it-run-on-a-mac [files or directories...]
 * Same core as the Action; prints one line per finding and exits 1 when something breaks.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, checkFiles, parsePlatforms, platformLine, PLATFORM_NAME, SITE, type Finding } from './action/core.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['node_modules', '.git']);

const HELP = `usage: will-it-run-on-a-mac [options] [file or directory ...]

Checks shell scripts for flags and shell constructs that break on macOS (BSD userland, bash 3.2, zsh) and
Alpine (BusyBox), against a database of what those platforms' own binaries did when every flag was run.
With no paths, every *.sh under the current directory is checked (node_modules and .git are skipped).

  --platforms <list>   macos,alpine (default), or include ubuntu
  --json               print the full report as JSON
  --verbose            also list what could not be checked ($OPTS, dynamic command names, unknown tools)
  --no-fail            exit 0 even when something breaks
  -h, --help           this text

Exit codes: 0 nothing breaks, 1 something breaks, 2 the check could not be run.
${SITE}`;

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.sh')) out.push(p);
  }
}

function label(f: Finding): string {
  if (f.severity === 'error') return 'breaks ';
  if (f.severity === 'warning') return 'warning';
  return 'note   ';
}

async function main(argv: string[]): Promise<number> {
  let platforms = 'macos,alpine', json = false, verbose = false, fail = true;
  const paths: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h' || a === '--help') { console.log(HELP); return 0; }
    else if (a === '--json') json = true;
    else if (a === '--verbose') verbose = true;
    else if (a === '--no-fail') fail = false;
    else if (a === '--platforms') { const v = argv[++i]; if (!v) throw new Error('--platforms needs a value'); platforms = v; }
    else if (a.startsWith('--platforms=')) platforms = a.slice('--platforms='.length);
    else if (a.startsWith('-')) throw new Error(`unknown option ${a} (see --help)`);
    else paths.push(a);
  }

  const chosen = parsePlatforms(platforms);
  const files: string[] = [];
  if (paths.length === 0) walk('.', files);
  for (const p of paths) {
    if (!existsSync(p)) throw new Error(`no such file or directory: ${p}`);
    if (statSync(p).isDirectory()) walk(p, files); else files.push(p);
  }
  if (files.length === 0) { console.error('no shell scripts found (looked for *.sh)'); return 0; }

  const engine = await loadEngine({
    treeSitterWasm: path.join(here, 'vendor', 'web-tree-sitter.wasm'),
    bashWasm: path.join(here, 'vendor', 'tree-sitter-bash.wasm'),
    flagsJson: path.join(here, '..', 'data', 'flags.json'),
    shellsJson: path.join(here, '..', 'data', 'shells.json'),
  });
  const report = checkFiles(
    files.sort().map((f) => ({ path: f.split(path.sep).join('/').replace(/^\.\//, ''), src: readFileSync(f, 'utf8') })),
    engine, { platforms: chosen, verbose });

  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const fr of report.files) {
      const shown = fr.findings.filter((f) => verbose || f.severity !== 'notice');
      console.log(`${fr.file} · ${fr.commands} command${fr.commands === 1 ? '' : 's'}, ${fr.flags} flag${fr.flags === 1 ? '' : 's'}${fr.interp ? ` · ${fr.interp} script` : ''}${shown.length ? '' : ' · nothing breaks'}`);
      for (const f of shown) {
        const what = f.flag ? `${f.subject} ${f.flag}` : f.subject;
        console.log(`  ${label(f)}  line ${f.line}  ${what}${f.platform ? `  (${PLATFORM_NAME[f.platform]})` : ''}`);
        console.log(`           ${f.message}`);
      }
    }
    console.log('');
    for (const p of report.platforms) console.log(platformLine(p, report.totals.perPlatform[p]!));
    console.log(`database recorded ${report.databaseRecordedAt.slice(0, 10)} · full evidence: ${SITE}`);
  }
  return fail && report.totals.errors > 0 ? 1 : 0;
}

// exitCode, not exit(): exiting while the wasm runtime's handles are closing trips a libuv assertion on Windows
main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e: unknown) => {
  console.error(`will-it-run-on-a-mac: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 2;
});
