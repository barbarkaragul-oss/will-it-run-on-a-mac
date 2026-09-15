/**
 * Builds the static site into docs/: the bundled page, the tree-sitter wasm files, and the database split
 * per tool so the page only fetches the tools a pasted script mentions.
 *   npx tsx scripts/build.ts
 */
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Database } from './extract.js';

const DOCS = path.resolve('docs');
mkdirSync(path.join(DOCS, 'vendor'), { recursive: true });
mkdirSync(path.join(DOCS, 'data', 'tools'), { recursive: true });

const result = await build({
  entryPoints: ['src/ui/main.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  outfile: path.join(DOCS, 'app.js'),
  logLevel: 'warning',
});
if (result.errors.length) process.exit(1);

for (const f of ['index.html', 'style.css']) copyFileSync(path.join('src/ui', f), path.join(DOCS, f));
copyFileSync('node_modules/web-tree-sitter/web-tree-sitter.wasm', path.join(DOCS, 'vendor', 'web-tree-sitter.wasm'));
copyFileSync('node_modules/tree-sitter-bash/tree-sitter-bash.wasm', path.join(DOCS, 'vendor', 'tree-sitter-bash.wasm'));
writeFileSync(path.join(DOCS, '.nojekyll'), '');

// Split the database: a small index (platforms, probes, tool names) plus one file per tool.
const db = JSON.parse(readFileSync('data/flags.json', 'utf8')) as Database;
rmSync(path.join(DOCS, 'data', 'tools'), { recursive: true, force: true });
mkdirSync(path.join(DOCS, 'data', 'tools'), { recursive: true });
const index = { generated_at: db.generated_at, platforms: db.platforms, probes: db.probes, tools: Object.keys(db.tools).sort() };
writeFileSync(path.join(DOCS, 'data', 'index.json'), JSON.stringify(index));
// the shell-semantics recordings ship as one small file; the page fetches it only when a script's shebang asks
if (existsSync('data/shells.json')) copyFileSync('data/shells.json', path.join(DOCS, 'data', 'shells.json'));
let bytes = 0;
for (const [tool, rec] of Object.entries(db.tools)) {
  const s = JSON.stringify(rec);
  bytes += s.length;
  writeFileSync(path.join(DOCS, 'data', 'tools', `${tool}.json`), s);
}
const appKb = Math.round(readFileSync(path.join(DOCS, 'app.js')).length / 1024);
console.log(`docs/app.js ${appKb} KB, vendor wasm ${Math.round((readFileSync(path.join(DOCS, 'vendor', 'web-tree-sitter.wasm')).length + readFileSync(path.join(DOCS, 'vendor', 'tree-sitter-bash.wasm')).length) / 1024)} KB, data index ${Math.round(JSON.stringify(index).length / 1024)} KB + ${Object.keys(db.tools).length} tool files ${Math.round(bytes / 1024)} KB`);
