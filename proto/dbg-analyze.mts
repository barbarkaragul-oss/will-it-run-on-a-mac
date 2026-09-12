import { readFileSync } from 'node:fs';
import { Parser, Language } from 'web-tree-sitter';
import { analyzeScript } from '../src/engine/analyze.js';
const db = JSON.parse(readFileSync('data/flags.json', 'utf8'));
await Parser.init();
const lang = await Language.load('node_modules/tree-sitter-bash/tree-sitter-bash.wasm');
const parser = new Parser(); parser.setLanguage(lang);
const script = [
  "sudo -u deploy sed -z 's/a/b/' f",
  'LC_ALL=C env -i sort -h f',
  "printf 'a\\0' | xargs -0 -I{} cp --reflink=auto {} /tmp",
  "find . -name '*.log' -exec rm -rf {} +",
  "sh -c 'stat -c %s f'",
  "grep -P 'x+' file.txt | sort -V",
  'date -d yesterday',
].join('\n') + '\n';
const a = analyzeScript(parser, script, db);
for (const c of a.commands) console.log(JSON.stringify(c.name), 'via', c.via, 'flags', c.flags.map((f) => f.flag + ':' + f.verdicts.macos.status + '/' + f.verdicts.alpine.status), 'notes', c.notes, 'checked', c.checked);
console.log('unknown', a.unknownTools, 'errors', a.parseErrors);
