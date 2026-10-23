// Builds the tabbed verdict report from FINAL.json and the driver's notes.
//   node build-report.mjs <FINAL.json> <notes.json> <out.html> [--config <copy-panel.config.json>]
// Every number on the page is computed here from FINAL.json or git.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [finalPath, notesPath, outPath] = process.argv.slice(2);
if (!outPath) { console.error('usage: build-report.mjs <FINAL.json> <notes.json> <out.html> [--config <file>]'); process.exit(1); }
const ci = process.argv.indexOf('--config');
const cfgPath = ci > 0 ? process.argv[ci + 1] : path.join(path.dirname(finalPath), '..', 'copy-panel.config.json');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : { sets: [] };
const final = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
const fmt = (v) => Number(v).toLocaleString('en-GB');
const n = (f) => final.filter(f).length;
const items = final.filter((x) => x.file !== 'calls');

const stats = {
  total: final.length,
  unanimous: n((x) => /^3 of 3/.test(x.how)),
  split: n((x) => /^2 of 3/.test(x.how)),
  round2: n((x) => String(x.how).startsWith('round 2')),
  oldKept: n((x) => x.winnerBase === 0 && x.file !== 'calls'),
  own: n((x) => x.winnerBase == null && x.how !== 'house rule only' && x.file !== 'calls'),
  auto: n((x) => x.how === 'house rule only'),
  unresolved: n((x) => x.final == null),
};
stats.judged = stats.total - stats.auto;
const fill = (s) => String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in stats ? fmt(stats[k]) : `{{${k}}}`));

const setNames = [...new Set(items.map((x) => x.set))];
const sets = setNames.map((name) => ({ name, label: cfg.sets.find((s) => s.name === name)?.label ?? name }));
const rows = items.map((x) => ({ set: x.set, group: x.file, id: x.id, field: x.field, versions: x.versions, final: x.final, how: x.how, winnerBase: x.winnerBase,
  votes: (x.votes || []).map((v) => ({ panel: v.panel, base: v.base, reason: v.reason })) }));
const calls = final.filter((x) => x.file === 'calls').map((x) => ({ title: x.title || x.id, final: x.final, how: x.how, votes: x.votes }));

const pages = (notes.pages || []).map((p) => ({ ...p, html: fill(p.html) }));
if (/^[0-9a-f]{6,40}$/.test(notes.commitsSince ?? "")) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const log = execSync(`git log --format="%h|%s" ${notes.commitsSince}..HEAD`).toString().trim().split('\n').filter(Boolean).map((l) => l.split('|'));
  pages.push({ key: 'commits', label: `Commits (${log.length})`, html: `<div class="tablewrap"><table><thead><tr><th>Commit</th><th>What</th></tr></thead><tbody>${log.map(([h, s]) => `<tr><td><code>${h}</code></td><td>${esc(s)}</td></tr>`).join('')}</tbody></table></div>` });
}

const tiles = notes.tiles ?? [[fmt(stats.total), 'items with a final wording'], [fmt(stats.unanimous), 'unanimous'], [fmt(stats.split), 'decided 2 to 1'],
  [fmt(stats.round2), 'settled in round 2'], [fmt(stats.oldKept), 'old wording kept'], [fmt(stats.own), 'panel wrote its own'], [fmt(stats.auto), 'house-rule fixes, not judged']];
const data = { title: notes.title, eyebrow: notes.eyebrow, lede: notes.lede, tldr: (notes.tldr || []).map(fill), tiles, sets, rows, groups: notes.groups || {}, calls, pages };
const tpl = fs.readFileSync(path.join(HERE, 'report-template.html'), 'utf8');
const out = tpl.replace('__TITLE__', notes.title).replace('__DATA__', () => JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(outPath, out);
console.log(JSON.stringify({ bytes: out.length, ...stats, tabs: 1 + sets.length + (calls.length ? 1 : 0) + pages.length }));
