import { Parser, Language } from 'web-tree-sitter';
import { analyzeScript, PLATFORMS, type Analysis, type CommandFinding, type FlagFinding } from '../engine/analyze.js';
import type { Database, Platform, PlatformInfo, Probe, ToolOnPlatform } from '../../scripts/extract.js';
import type { Verdict, Status } from '../engine/verdict.js';
import { SAMPLES } from './samples.js';

interface Index { generated_at: string; platforms: Record<Platform, PlatformInfo>; probes: Record<string, Probe>; tools: string[] }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
function h(tag: string, attrs: Record<string, string | boolean | undefined> = {}, ...children: Array<Node | string | null | undefined>): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'text') el.textContent = String(v);
    else if (k === 'open' && v === true) el.setAttribute('open', '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(c);
  return el;
}

const PLATFORM_NAME: Record<Platform, string> = { ubuntu: 'Ubuntu · GNU', macos: 'macOS · BSD', alpine: 'Alpine · BusyBox' };
const LABEL: Record<Status, string> = { ok: 'ok', 'ok-probed': 'ok (run)', missing: 'not documented', rejected: 'breaks', 'missing-tool': 'no such tool', builtin: 'builtin', unknown: 'unknown' };

let parser: Parser | undefined;
let index: Index | undefined;
const db: Database = { generated_at: '', platforms: {} as Database['platforms'], tools: {}, probes: {} };
const loading = new Map<string, Promise<void>>();

async function ensureTools(names: Iterable<string>): Promise<void> {
  if (!index) return;
  const known = new Set(index.tools);
  const jobs: Promise<void>[] = [];
  for (const n of names) {
    if (!known.has(n) || db.tools[n]) continue;
    let p = loading.get(n);
    if (!p) {
      p = fetch(`data/tools/${n}.json`).then((r) => r.json()).then((rec: Partial<Record<Platform, ToolOnPlatform>>) => { db.tools[n] = rec; }).catch(() => { loading.delete(n); });
      loading.set(n, p);
    }
    jobs.push(p);
  }
  await Promise.all(jobs);
}

function namesIn(a: Analysis): Set<string> {
  const s = new Set<string>();
  for (const c of a.commands) { s.add(c.name); for (const v of c.via) s.add(v.replace(/ .*$/, '')); }
  return s;
}

let timer: number | undefined;
function schedule() { if (timer) clearTimeout(timer); timer = window.setTimeout(() => void run(), 250); }

async function run(): Promise<void> {
  if (!parser || !index) return;
  const src = $<HTMLTextAreaElement>('script').value;
  // Each pass can reveal more tools (xargs CMD, find -exec CMD, sh -c '...') once the wrapper's own record is loaded.
  let a = analyzeScript(parser, src, db);
  for (let pass = 0; pass < 4; pass++) {
    const before = Object.keys(db.tools).length;
    await ensureTools(namesIn(a));
    if (Object.keys(db.tools).length === before) break;
    a = analyzeScript(parser, src, db);
  }
  render(a, src);
}

function worst(f: FlagFinding): { text: string; cls: string } {
  const bad = PLATFORMS.filter((p) => f.verdicts[p].status === 'rejected' || f.verdicts[p].status === 'missing-tool');
  const maybe = PLATFORMS.filter((p) => f.verdicts[p].status === 'missing');
  if (bad.length) return { text: `breaks on ${bad.map((p) => PLATFORM_NAME[p].split(' ')[0]).join(' and ')}`, cls: 'rejected' };
  if (maybe.length) return { text: `not documented on ${maybe.map((p) => PLATFORM_NAME[p].split(' ')[0]).join(' and ')}`, cls: 'missing' };
  if (PLATFORMS.every((p) => f.verdicts[p].status === 'builtin')) return { text: 'shell builtin', cls: 'builtin' };
  if (PLATFORMS.some((p) => f.verdicts[p].status === 'unknown')) return { text: 'partly unknown', cls: 'unknown' };
  return { text: 'fine on all three', cls: 'ok' };
}

function render(a: Analysis, src: string): void {
  const lines = src.split('\n');
  const summary = $('summary');
  const findings = $('findings');
  const flags = a.commands.flatMap((c) => c.flags);
  const missingTools = (p: Platform) => a.commands.filter((c) => c.tool?.[p] === 'missing').length;
  const perPlatform = PLATFORMS.map((p) => ({ p, breaks: flags.filter((f) => f.verdicts[p].status === 'rejected').length + missingTools(p), maybe: flags.filter((f) => f.verdicts[p].status === 'missing').length }));
  const unchecked = a.commands.reduce((n, c) => n + c.notes.length, 0) + a.commands.filter((c) => !c.checked).length;
  summary.replaceChildren(
    h('div', { class: 'summary-box' },
      h('div', {}, `${a.commands.length} command${a.commands.length === 1 ? '' : 's'}, ${flags.length} flag${flags.length === 1 ? '' : 's'} checked${unchecked ? `, ${unchecked} thing${unchecked === 1 ? '' : 's'} not checked` : ''}.`),
      ...perPlatform.map(({ p, breaks, maybe }) => h('div', { class: 'verdict-line' }, h('span', { class: `pill ${breaks ? 'rejected' : maybe ? 'missing' : 'ok'}` , text: PLATFORM_NAME[p] }), h('span', {}, breaks ? h('b', { class: 'bad', text: `${breaks} will break` }) : h('b', { class: 'ok', text: 'nothing breaks' }), maybe ? ` · ${maybe} not documented there` : ''))),
      a.parseErrors.length ? h('div', { class: 'note', text: `Parse error near line ${a.parseErrors[0]!.row + 1}, column ${a.parseErrors[0]!.column + 1}: commands after it may be missing.` }) : null,
      a.unknownTools.length ? h('div', { class: 'note', text: `Not recorded on any platform, so not judged: ${a.unknownTools.join(', ')}.` }) : null,
    ),
  );
  findings.replaceChildren(...a.commands.map((c) => renderCommand(c, lines)));
}

function renderCommand(c: CommandFinding, lines: string[]): HTMLElement {
  const lineText = (lines[c.start.row] ?? '').trim();
  const clean = c.checked && c.flags.every((f) => worst(f).cls === 'ok') && c.notes.length === 0 && !(c.tool && PLATFORMS.some((p) => c.tool![p] === 'missing'));
  const card = h('div', { class: `cmd${clean ? ' clean' : ''}` });
  card.append(h('h3', {}, h('span', { class: 'line', text: `line ${c.start.row + 1}` }), h('code', { text: c.name }), c.via.length ? h('span', { class: 'via', text: `via ${c.via.join(' → ')}` }) : null, h('span', { class: 'muted mono', text: lineText.length > 90 ? lineText.slice(0, 87) + '…' : lineText })));
  if (!c.checked) { card.append(h('p', { class: 'note', text: c.notes[0] ?? 'not checked' })); return card; }
  const gone = c.tool ? PLATFORMS.filter((p) => c.tool![p] === 'missing') : [];
  if (gone.length) {
    card.classList.remove('clean');
    card.append(h('div', { class: 'flag' }, h('div', { class: 'head' }, h('code', { text: c.name }), h('span', { class: 'pill rejected', text: `no such tool on ${gone.map((p) => PLATFORM_NAME[p].split(' ')[0]).join(' and ')}` })), h('p', { class: 'note', text: `command -v ${c.name} found nothing on ${gone.map((p) => `${PLATFORM_NAME[p]} (${index?.platforms[p]?.os ?? p})`).join(' and ')} when the platforms were recorded.` })));
  }
  for (const f of c.flags) card.append(renderFlag(c, f));
  for (const n of c.notes) card.append(h('p', { class: 'note', text: n }));
  if (c.flags.length === 0 && c.notes.length === 0) card.append(h('p', { class: 'note', text: 'no flags to check' }));
  return card;
}

function renderFlag(c: CommandFinding, f: FlagFinding): HTMLElement {
  const w = worst(f);
  const el = h('div', { class: 'flag' });
  el.append(h('div', { class: 'head' }, h('code', { text: `${c.name} ${f.flag}` }), h('span', { class: `pill ${w.cls}`, text: w.text })));
  if (PLATFORMS.every((p) => f.verdicts[p].status === 'builtin')) {
    // One line is enough: the answer does not vary by userland.
    el.append(h('p', { class: 'note', text: f.verdicts.macos.headline }));
    return el;
  }
  const per = h('div', { class: 'per' });
  for (const p of PLATFORMS) {
    const v = f.verdicts[p];
    per.append(h('div', { class: 'p' }, h('span', { class: 'name', text: PLATFORM_NAME[p] }), h('span', {}, h('span', { class: `pill ${v.status}`, text: LABEL[v.status] }), ' ', v.headline)));
    const ev = evidenceFor(v);
    if (ev) per.append(ev);
  }
  el.append(per);
  return el;
}

function evidenceFor(v: Verdict): HTMLElement | null {
  const items: HTMLElement[] = [];
  if (v.run) items.push(h('li', {}, h('code', { text: `${v.tool} ${v.flag} ${v.run.form === 'with' ? 'probe.txt' : ''}`.trim() }), ` → exit ${v.run.code}${v.run.stderr1 ? `, stderr: ` : ''}`, v.run.stderr1 ? h('code', { text: v.run.stderr1 }) : null));
  if (v.probe) items.push(h('li', {}, h('code', { text: v.probe.command }), ` → exit ${v.probe.code}${v.probe.stderr1 ? ', stderr: ' : ''}`, v.probe.stderr1 ? h('code', { text: v.probe.stderr1 }) : null));
  for (const e of v.evidence.slice(0, 2)) items.push(h('li', {}, h('span', { class: 'muted', text: `${e.source}: ` }), h('code', { text: e.line })));
  if (!items.length) return null;
  const d = h('details', { class: 'evidence' }, h('summary', { text: `evidence (${items.length})` }), h('ul', {}, ...items));
  return d;
}

function renderPlatforms(): void {
  if (!index) return;
  $('platforms').replaceChildren(...PLATFORMS.map((p) => { const i = index!.platforms[p]; return h('div', { class: 'platform' }, h('b', { text: PLATFORM_NAME[p] }), h('span', { class: 'muted', text: `${i?.os || ''}${i?.userland ? ' · ' + i.userland : ''} · recorded ${i?.recorded_at?.slice(0, 10) ?? '?'}` })); }));
  $('dbinfo').textContent = `database generated ${index.generated_at.slice(0, 10)}, ${index.tools.length} tools`;
}

function encodeShare(src: string): string { return btoa(unescape(encodeURIComponent(src))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeShare(s: string): string { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); }

let toastTimer: number | undefined;
function toast(msg: string) {
  let el = document.querySelector<HTMLDivElement>('.toast');
  if (!el) { el = h('div', { class: 'toast' }) as HTMLDivElement; document.body.append(el); }
  el.textContent = msg; el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200);
}

async function init(): Promise<void> {
  const sel = $<HTMLSelectElement>('sample');
  for (const s of SAMPLES) sel.append(h('option', { value: s.id, text: s.title }));
  sel.append(h('option', { value: 'custom', text: 'Custom (edited)' }));
  const ta = $<HTMLTextAreaElement>('script');
  const applySample = (id: string) => { const s = SAMPLES.find((x) => x.id === id); if (!s) return; ta.value = s.script; $('blurb').textContent = s.blurb; };
  const hash = new URLSearchParams(location.hash.slice(1)).get('s');
  if (hash) { try { ta.value = decodeShare(hash); sel.value = 'custom'; $('blurb').textContent = 'Shared script.'; } catch { applySample(SAMPLES[0]!.id); } }
  else applySample(SAMPLES[0]!.id);
  sel.addEventListener('change', () => { if (sel.value !== 'custom') { applySample(sel.value); history.replaceState(null, '', location.pathname); schedule(); } });
  ta.addEventListener('input', () => { sel.value = 'custom'; $('blurb').textContent = ''; schedule(); });
  $('share').addEventListener('click', () => { const url = `${location.origin}${location.pathname}#s=${encodeShare(ta.value)}`; history.replaceState(null, '', `#s=${encodeShare(ta.value)}`); navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast('Link is in the address bar')); });
  const theme = $('theme');
  const setTheme = (t: string | null) => { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); };
  try { setTheme(localStorage.getItem('theme')); } catch { /* ignore */ }
  theme.addEventListener('click', () => { const cur = document.documentElement.getAttribute('data-theme'); const next = cur === 'dark' ? 'light' : 'dark'; setTheme(next); try { localStorage.setItem('theme', next); } catch { /* ignore */ } });

  const status = $('status');
  try {
    const [idx] = await Promise.all([
      fetch('data/index.json').then((r) => r.json() as Promise<Index>),
      Parser.init({ locateFile: (f: string) => `vendor/${f}` }),
    ]);
    index = idx;
    db.generated_at = idx.generated_at; db.platforms = idx.platforms; db.probes = idx.probes;
    const lang = await Language.load('vendor/tree-sitter-bash.wasm');
    parser = new Parser();
    parser.setLanguage(lang);
    renderPlatforms();
    status.textContent = 'Parser ready; nothing leaves your browser.';
    await run();
  } catch (e) {
    status.textContent = `Could not load the parser or the database: ${(e as Error).message}`;
  }
}

void init();
