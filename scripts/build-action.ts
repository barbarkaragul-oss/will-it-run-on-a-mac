/**
 * Builds the GitHub Action and the command line tool into dist/: two self-contained bundles (the engine, the parser
 * and @actions/* inside, so a workflow that uses the action runs nothing but node) and the two tree-sitter wasm files
 * next to them. The flag database is not copied: both read data/ from the repository they ship in.
 *   npx tsx scripts/build-action.ts
 */
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
mkdirSync(path.join(DIST, 'vendor'), { recursive: true });

const result = await build({
  entryPoints: { index: 'src/action/main.ts', cli: 'src/cli.ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  // kept readable: the annotations and a failing run's stack should point at something a person can read
  minify: false,
  sourcemap: false,
  outdir: DIST,
  // some of @actions/*'s dependencies are CommonJS and require() node built-ins, which an ES module has no require for
  banner: { js: "import { createRequire as __wiroamCreateRequire } from 'node:module'; const require = __wiroamCreateRequire(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'warning',
});
if (result.errors.length) process.exit(1);

copyFileSync('node_modules/web-tree-sitter/web-tree-sitter.wasm', path.join(DIST, 'vendor', 'web-tree-sitter.wasm'));
copyFileSync('node_modules/tree-sitter-bash/tree-sitter-bash.wasm', path.join(DIST, 'vendor', 'tree-sitter-bash.wasm'));
console.log('dist/index.js (action), dist/cli.js (command line), dist/vendor/*.wasm');
