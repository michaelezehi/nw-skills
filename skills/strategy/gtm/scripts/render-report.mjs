#!/usr/bin/env node
// Render a gtm report spec (JSON) into one black-and-white HTML page, and optionally a PDF.
//
//   node render-report.mjs <report.json> <out.html> [--pdf <out.pdf>]
//
// A spec with `parts: ["a.report.json", ...]` becomes one document: the spec itself first
// (usually an index), then each part as its own chapter, each starting on a new page.
// `cover: "cover.html"` (path relative to the spec) puts that HTML fragment on page one;
// without it a plain cover is drawn from the title and summary.
// Icons: layered line icons (face, shade, accent, ink groups) read from $NW_ICONS_DIR.
// Missing icons fall back to a plain drawn glyph, so the page always renders.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const pdfFlag = args.indexOf('--pdf');
const pdfPath = pdfFlag >= 0 ? args[pdfFlag + 1] : null;
const [specPath, outPath] = pdfFlag >= 0 ? args.filter((_, i) => i !== pdfFlag && i !== pdfFlag + 1) : args;
if (!specPath || !outPath) {
  console.error('usage: node render-report.mjs <report.json> <out.html> [--pdf <out.pdf>]');
  process.exit(1);
}
const specDir = dirname(resolve(specPath));
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const ICON_DIR = process.env.NW_ICONS_DIR || '';

// Sub-command → icon name. Reports may also name any icon in NW_ICONS_DIR directly.
const SKILL_ICONS = {
  validate: 'insight-bulb',
  feature: 'skill-puzzle',
  brief: 'doc-stack',
  competitors: 'radar',
  personas: 'people-search',
  interviews: 'interview',
  mvp: 'goal-target',
  pricing: 'discount-tag',
  plan: 'launch-rocket',
  metrics: 'metrics-bars',
  fundraise: 'investor',
  deck: 'screencast',
  summary: 'dashboard-tiles',
};

const FALLBACK = {
  default: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.4 2.4 4.6-5"/>',
  'decision-stamp': '<path d="M7 20h10M8 17h8l-1-4H9z"/><path d="M12 13V8"/><circle cx="12" cy="6" r="2.5"/>',
  'alert-triangle': '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  'domain-link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5c4-2 6.5 2 11 0v8c-4.5 2-7-2-11 0"/>',
};

function icon(name) {
  const file = ICON_DIR ? join(ICON_DIR, `${name}.svg`) : '';
  if (file && existsSync(file)) {
    return readFileSync(file, 'utf8')
      .replace(/<\?xml[^>]*>/, '')
      .replace(/\sid="(face|shade|accent|ink)"/g, ' data-layer="$1"')
      .replace(/<svg /, '<svg class="nw" aria-hidden="true" ');
  }
  const body = FALLBACK[name] || FALLBACK.default;
  return `<svg class="fb" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Parts bundled into this document, keyed by their page name, so sibling links become anchors.
const partIds = new Set();
const slug = (file) => basename(file).replace(/\.report\.json$|\.json$|\.html$/g, '');

// Inline marks: **bold**, `code`, [label](https://url) or [label](sibling.html). Everything else is escaped.
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(((?:\.\/)?[\w.-]+\.html)\)/g, (_, label, href) => {
      const id = slug(href);
      return partIds.has(id) ? `<a href="#part-${id}">${label}</a>` : `<a href="${href}">${label}</a>`;
    });
}

// Text length without the inline marks, for layout decisions.
const plain = (s) =>
  String(s ?? '')
    .replace(/\*\*|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

const rows = (items, cls) => `<ul class="rows${cls ? ' ' + cls : ''}">${(items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
const steps = (items) => `<ol class="steps">${(items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`;

// A table whose cells are paragraphs is not a table: every row becomes an entry, the first
// column its title and each other column a labelled line. A leading number column ("#")
// rides along with the title.
function entries(head, body, colMax, hl) {
  const idx = head.length >= 3 && colMax[0] <= 3 ? 1 : 0;
  return `<div class="entries">${body
    .map((r, i) => {
      const title = idx ? `<span class="idx">${inline(r[0])}</span>${inline(r[1])}` : inline(r[0]);
      const fields = head
        .map((h, c) =>
          c > idx && plain(r[c]) !== ''
            ? `<div class="f"><span class="k">${esc(h)}</span><div class="t">${inline(r[c])}</div></div>`
            : '',
        )
        .join('');
      return `<div class="entry${hl.has(i) ? ' hl' : ''}"><div class="e-title">${title}</div><div class="e-fields">${fields}</div></div>`;
    })
    .join('')}</div>`;
}

function table(b) {
  const head = b.head || [];
  const body = (b.rows || []).map((r) => r.map((c) => c ?? ''));
  const cols = Math.max(head.length, ...body.map((r) => r.length), 0);
  const colMax = Array.from({ length: cols }, (_, c) => Math.max(0, ...body.map((r) => plain(r[c]).length)));
  const longCols = colMax.filter((m) => m > 90).length;
  const paraCols = colMax.filter((m) => m > 60).length;
  const maxCell = Math.max(0, ...colMax);
  const hl = new Set(b.highlight || []);
  // Decided per table: long text gets room as entries, short cells stay a matrix.
  const stacked = (cols >= 4 && (longCols >= 1 || paraCols >= 2)) || (cols === 3 && (longCols >= 2 || maxCell > 160));
  if (stacked) return entries(head, body, colMax, hl);

  const wide = cols >= 6;
  // Short cells never wrap; the limit shrinks as columns multiply so a row still fits the page.
  const nowrapMax = cols <= 3 ? 24 : cols <= 5 ? 16 : 8;
  // Wide matrices get fixed column widths from their content, so no row can push past the page edge.
  const weights = colMax.map((m, c) => {
    // Header words are uppercase mono, about 1.4 times as wide as body text.
    const headWord = Math.max(0, ...String(head[c] ?? '').split(/\s+/).map((w) => w.length * 1.4));
    return Math.sqrt(Math.min(30, Math.max(9, m, headWord)));
  });
  const total = weights.reduce((a, w) => a + w, 0);
  const colgroup = wide
    ? `<colgroup>${weights.map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%">`).join('')}</colgroup>`
    : '';
  const cell = (c) => {
    const n = plain(c).length;
    return `<td${n > 0 && n <= nowrapMax ? ' class="nw"' : ''}>${inline(c)}</td>`;
  };
  return `
    <div class="tbl"><table${wide ? ' class="wide"' : ''}>${colgroup}
      <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r, i) => `<tr${hl.has(i) ? ' class="hl"' : ''}>${r.map(cell).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}

function cards(b) {
  const items = b.items || [];
  // Cards that carry lists read as line-separated rows; plain cards sit in a grid that does not stretch.
  const stack = items.some((c) => (c.points || []).length);
  return `<div class="cards ${stack ? 'stack' : 'grid'}">${items
    .map(
      (c) => `
      <div class="card${c.target ? ' target' : ''}">
        <div class="c-head">
          ${c.tag ? `<span class="tag">${esc(c.tag)}</span>` : ''}
          <h3>${inline(c.title)}</h3>
          ${c.price ? `<div class="price">${esc(c.price)}</div>` : ''}
          ${c.meta ? `<div class="meta">${inline(c.meta)}</div>` : ''}
        </div>
        <div class="c-body">
          ${(c.points || []).length ? rows(c.points) : ''}
          ${c.foot ? `<div class="foot">${inline(c.foot)}</div>` : ''}
        </div>
      </div>`,
    )
    .join('')}</div>`;
}

const BLOCKS = {
  p: (b) => `<p>${inline(b.text)}</p>`,
  list: (b) => rows(b.items),
  steps: (b) => steps(b.items),
  note: (b) => `<p class="note">${inline(b.text)}</p>`,
  callout: (b) => `<div class="callout"><span class="lbl">${esc(b.label || 'Note')}</span><p>${inline(b.text)}</p></div>`,
  verdict: (b) => `
    <div class="verdict">
      <div class="score"><span>${esc(b.score)}${b.out_of ? `<small>/${esc(b.out_of)}</small>` : ''}</span></div>
      <div><span class="lbl">${esc(b.label || 'Verdict')}</span><p class="big">${inline(b.headline || '')}</p>${b.text ? `<p>${inline(b.text)}</p>` : ''}</div>
    </div>`,
  stats: (b) => {
    const items = b.items || [];
    // Long labels or long values read better as rows than as a grid of tiles.
    const asRows = items.some((s) => plain(s.label).length > 40 || plain(s.value).length > 12) || items.length > 6;
    return `<div class="stats ${asRows ? 'rows' : 'grid'}">${items
      .map((s) => `<div class="stat"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`)
      .join('')}</div>`;
  },
  table,
  cards,
};

function block(b) {
  const fn = BLOCKS[b.type];
  if (!fn) throw new Error(`unknown block type: ${b.type}`);
  return fn(b);
}

function secHead(ic, num, heading) {
  return `<div class="sec-head"><span class="chip">${icon(ic)}</span><div><span class="num">${esc(num)}</span><h2>${inline(heading)}</h2></div></div>`;
}

// One report: header, verdict, what was done, sections, next, sources.
function renderPart(s, id) {
  const ic = s.icon || SKILL_ICONS[s.skill] || 'flag';
  const sections = (s.sections || [])
    .map(
      (sec, i) => `
    <section>
      ${secHead(sec.icon || 'flag', String(i + 1).padStart(2, '0'), sec.heading)}
      ${(sec.blocks || []).map(block).join('\n')}
    </section>`,
    )
    .join('\n');
  const done = (s.steps || []).length
    ? `<section class="did">${secHead('decision-stamp', '00', 'What I did')}${steps(s.steps)}</section>`
    : '';
  const assumptions = (s.assumptions || []).length
    ? `<div class="assume">${s.assumptions.map((a) => `<p>Assumption: ${inline(a)}</p>`).join('')}</div>`
    : '';
  const next = (s.next || []).length ? `<section>${secHead('flag', '→', 'Next')}${rows(s.next)}</section>` : '';
  const sources = (s.sources || []).length
    ? `<section class="sources">${secHead('domain-link', '§', 'Sources')}
        <ul class="rows">${s.sources
          .map(
            (x) =>
              `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label || x.url)}</a>${x.checked ? `<span class="muted">checked ${esc(x.checked)}</span>` : ''}</li>`,
          )
          .join('')}</ul></section>`
    : '';
  return `
  <article class="part" id="part-${esc(id)}">
    <header class="part-head">
      <div class="eyebrow">${esc(['gtm ' + (s.skill || ''), s.project, s.date].filter(Boolean).join(' · '))}</div>
      <div class="title-row">
        <span class="hero-ic">${icon(ic)}</span>
        <h1>${inline(s.title)}</h1>
      </div>
      ${s.subtitle ? `<p class="sub">${inline(s.subtitle)}</p>` : ''}
      ${s.aside ? `<p class="aside">${inline(s.aside)}</p>` : ''}
      ${assumptions}
    </header>
    ${s.summary ? block({ type: 'verdict', ...s.summary }) : ''}
    ${done}
    ${sections}
    ${next}
    ${sources}
  </article>`;
}

// Plain cover, used when no designed cover fragment is given.
function defaultCover(s) {
  const ic = s.icon || SKILL_ICONS[s.skill] || 'flag';
  return `
  <section class="cover cover-default">
    <div class="cv-top"><span class="cv-mark">${icon(ic)}</span><span class="eyebrow">${esc(s.project || '')}</span></div>
    <div class="cv-mid">
      <h1>${inline(s.title)}</h1>
      ${s.subtitle ? `<p>${inline(s.subtitle)}</p>` : ''}
    </div>
    <div class="cv-foot">
      ${s.summary ? `<div><span class="lbl">${esc(s.summary.label || 'Verdict')}</span><b>${inline(s.summary.headline || '')}</b></div>` : '<div></div>'}
      <span class="eyebrow">${esc(s.date || '')}</span>
    </div>
  </section>`;
}

const parts = (spec.parts || []).map((p) => {
  const file = resolve(specDir, p);
  partIds.add(slug(file));
  return { id: slug(file), spec: JSON.parse(readFileSync(file, 'utf8')) };
});

let cover = '';
if (spec.cover !== false) {
  const coverFile = spec.cover ? resolve(specDir, spec.cover) : null;
  cover = coverFile && existsSync(coverFile) ? readFileSync(coverFile, 'utf8') : defaultCover(spec);
}

const body = [renderPart(spec, slug(specPath)), ...parts.map((p) => renderPart(p.spec, p.id))].join('\n');

// Every page carries a download button: the PDF rendered with it, or the browser's save-as-PDF.
const dlIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>';
const pdfHref = pdfPath ? relative(dirname(resolve(outPath)), resolve(pdfPath)).split('\\').join('/') : null;
const download = pdfHref
  ? `<a class="dl-btn" href="${esc(encodeURI(pdfHref))}" download>${dlIcon}<span>Download PDF</span></a>`
  : `<button class="dl-btn" type="button" onclick="window.print()">${dlIcon}<span>Download PDF</span></button>`;
const topbar = `<div class="topbar"><div class="wrap"><span class="eyebrow">${esc(spec.project || spec.title || '')}</span>${download}</div></div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --ink:#111; --paper:#fff; --mute:#6b6b6b; --hair:#e4e4e1; --wash:#f6f6f4; --icon-accent:#cfcfcf; --mono:"Geist Mono", ui-monospace, monospace; --sans:"Geist", system-ui, sans-serif; }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; hyphens:none; -webkit-hyphens:none; }
  body { margin:0; background:var(--paper); color:var(--ink); font:400 14.5px/1.6 var(--sans); }
  .wrap { max-width:880px; margin:0 auto; padding:0 16px; }
  @media (min-width:720px) { .wrap { padding:0 32px; } }

  .eyebrow, .lbl, .num, .tag, .idx, .k, th, .stats.grid .l, .sources .muted { font-family:var(--mono); }
  .eyebrow { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--mute); }
  .part-head { padding:48px 0 20px; }
  .title-row { display:flex; gap:14px; align-items:center; margin:12px 0 8px; }
  .hero-ic { width:52px; height:52px; flex:none; display:grid; place-items:center; border:1px solid var(--ink); border-radius:14px; }
  .hero-ic svg { width:30px; height:30px; }
  h1 { font:600 clamp(26px,3.8vw,36px)/1.1 var(--sans); letter-spacing:-.025em; margin:0; }
  .sub { font-size:15.5px; line-height:1.5; color:#333; max-width:680px; margin:4px 0 0; }
  .aside { font-size:14.5px; font-weight:500; color:var(--ink); margin:10px 0 0; max-width:680px; }

  svg.nw { color:var(--ink); }
  svg.nw [data-layer="face"] { fill:var(--icon-face, transparent); }
  svg.nw [data-layer="shade"] { fill:color-mix(in srgb, currentColor 14%, transparent); }
  svg.nw [data-layer="accent"] { fill:var(--icon-accent); }
  svg.nw [data-layer="ink"] { fill:currentColor; }

  /* room between sections, little inside them */
  section { padding:40px 0 0; }
  .sec-head { display:flex; gap:12px; align-items:center; margin-bottom:14px; }
  .chip { width:34px; height:34px; flex:none; display:grid; place-items:center; border:1px solid var(--ink); border-radius:10px; background:var(--paper); }
  .chip svg { width:20px; height:20px; }
  .num { display:block; font-size:10.5px; color:var(--mute); letter-spacing:.1em; line-height:1.2; margin-bottom:2px; }
  h2 { font:600 20px/1.25 var(--sans); letter-spacing:-.015em; margin:0; }
  h3 { font-size:15px; line-height:1.35; font-weight:600; margin:0; letter-spacing:-.01em; }
  p { margin:0 0 10px; max-width:680px; }
  a { color:var(--ink); text-underline-offset:3px; text-decoration-thickness:1px; overflow-wrap:anywhere; }
  code { font:12.5px var(--mono); background:var(--wash); padding:1px 5px; border-radius:4px; overflow-wrap:anywhere; }
  b { font-weight:600; }
  .muted { color:var(--mute); font-size:12.5px; }
  .lbl { font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--mute); display:block; margin-bottom:5px; }
  .note { font-size:14px; color:var(--mute); }

  .assume { margin:14px 0 0; max-width:680px; font-size:13px; color:#555; border-top:1px solid var(--hair); }
  .assume p { margin:0; padding:5px 0; border-bottom:1px solid var(--hair); }

  /* line-separated items: lists, steps, sources */
  ul.rows, ol.steps { list-style:none; padding:0; margin:4px 0 20px; max-width:740px; border-top:1px solid var(--hair); }
  ul.rows li, ol.steps li { padding:8px 0; border-bottom:1px solid var(--hair); }
  ol.steps { counter-reset:s; }
  ol.steps li { counter-increment:s; position:relative; padding-left:36px; }
  ol.steps li::before { content:counter(s, decimal-leading-zero); position:absolute; left:0; top:10px; font:500 11px/1.6 var(--mono); letter-spacing:.06em; color:var(--mute); }

  .callout { padding:12px 0; margin:8px 0 22px; max-width:740px; border-top:1px solid var(--ink); border-bottom:1px solid var(--ink); }
  .callout p:last-child { margin:0; }

  .verdict { display:flex; gap:24px; align-items:center; padding:18px 22px; margin:10px 0 20px; border:1px solid var(--ink); border-radius:14px; }
  .verdict p { max-width:none; }
  .score { flex:none; min-width:80px; }
  .score span { font:600 40px/1 var(--sans); letter-spacing:-.035em; white-space:nowrap; }
  .score small { font-size:16px; color:var(--mute); letter-spacing:0; }
  .big { font:600 17px/1.35 var(--sans); letter-spacing:-.012em; margin-bottom:4px; }
  @media (max-width:560px) { .verdict { flex-direction:column; align-items:flex-start; } }

  /* stats: a quiet grid, or rows when labels run long; labels wrap, values never do */
  .stats { margin:4px 0 20px; border-top:1px solid var(--ink); }
  .stats.grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%,150px),1fr)); gap:0 24px; }
  .stat { padding:12px 0; border-bottom:1px solid var(--hair); }
  .stat .v { font:600 24px/1.1 var(--sans); letter-spacing:-.02em; white-space:nowrap; }
  .stats.grid .l { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--mute); margin-top:6px; line-height:1.45; }
  /* rows share one grid, so the value column fits the longest value and labels line up */
  .stats.rows { display:grid; grid-template-columns:max-content 1fr; column-gap:20px; align-items:baseline; }
  .stats.rows .stat { display:contents; }
  .stats.rows .v, .stats.rows .l { padding:10px 0; border-bottom:1px solid var(--hair); }
  .stats.rows .l { font-size:14px; color:#333; }

  /* tables: hairline rows, no outer box; short cells never wrap */
  .tbl { overflow-x:auto; margin:4px 0 22px; }
  table { border-collapse:collapse; width:100%; font-size:14px; line-height:1.45; }
  th, td { text-align:left; vertical-align:top; padding:9px 16px 9px 0; border-bottom:1px solid var(--hair); overflow-wrap:break-word; }
  th:last-child, td:last-child { padding-right:0; }
  th { font-size:10.5px; line-height:1.4; letter-spacing:.08em; text-transform:uppercase; color:var(--mute); font-weight:500; padding-top:0; padding-bottom:8px; border-bottom:1px solid var(--ink); }
  td.nw { white-space:nowrap; }
  tr.hl td { background:var(--wash); font-weight:500; box-shadow:inset 0 1px 0 var(--ink); }
  table.wide { table-layout:fixed; font-size:12.5px; line-height:1.4; }
  table.wide th, table.wide td { padding:7px 8px 7px 0; }
  table.wide th { font-size:9.5px; letter-spacing:.02em; }

  /* a long-text table as entries: title left, labelled lines right */
  .entries { margin:4px 0 22px; border-top:1px solid var(--ink); }
  .entry { display:grid; grid-template-columns:minmax(150px,26%) 1fr; gap:6px 28px; padding:14px 0; border-bottom:1px solid var(--hair); }
  /* the wash runs past the text edge by shadow, so nothing widens the page */
  .entry.hl, .card.target { background:var(--wash); box-shadow:14px 0 0 var(--wash), -14px 0 0 var(--wash); }
  .e-title { font-size:14.5px; line-height:1.4; font-weight:600; letter-spacing:-.01em; }
  .idx { font-size:11px; font-weight:400; color:var(--mute); letter-spacing:.06em; margin-right:10px; }
  .e-fields { display:grid; grid-template-columns:fit-content(150px) 1fr; gap:6px 16px; align-items:start; }
  .f { display:contents; }
  .k { font-size:10.5px; line-height:1.5; letter-spacing:.08em; text-transform:uppercase; color:var(--mute); padding-top:3px; }
  .t { font-size:14px; line-height:1.55; }

  /* cards: a grid that does not stretch, or rows when they hold lists; the target carries a filled tag */
  .cards { margin:4px 0 22px; border-top:1px solid var(--ink); }
  .cards.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%,220px),1fr)); gap:0 28px; align-items:start; }
  .card { padding:14px 0 16px; border-bottom:1px solid var(--hair); }
  .cards.stack .card { display:grid; grid-template-columns:minmax(150px,28%) 1fr; gap:6px 28px; }
  .tag { display:inline-block; font-size:10.5px; line-height:1; letter-spacing:.08em; text-transform:uppercase; color:var(--mute); margin-bottom:8px; }
  .card.target .tag { background:var(--ink); color:var(--paper); padding:5px 8px 4px; border-radius:999px; }
  .price { font:600 24px/1.1 var(--sans); letter-spacing:-.02em; margin:6px 0 2px; }
  .meta { font-size:12.5px; color:var(--mute); margin-top:4px; }
  .card ul.rows { margin:0; max-width:none; border-top:0; font-size:14px; }
  .card ul.rows li { padding:5px 0; }
  .card ul.rows li:first-child { padding-top:0; }
  .cards.grid .card ul.rows { margin-top:10px; border-top:1px solid var(--hair); }
  .cards.grid .card ul.rows li:first-child { padding-top:5px; }
  .card ul.rows li:last-child { border-bottom:0; }
  .foot { margin-top:8px; padding-top:8px; border-top:1px solid var(--hair); font-size:12.5px; color:var(--mute); }

  .sources ul.rows { max-width:none; font-size:13px; }
  .sources li { display:flex; justify-content:space-between; gap:16px; padding:6px 0; }
  .sources li a { min-width:0; }
  .sources .muted { flex:none; font-size:10.5px; letter-spacing:.04em; white-space:nowrap; padding-top:3px; }
  .part + .part { margin-top:56px; border-top:1px solid var(--ink); }
  footer { padding:24px 0 56px; margin-top:40px; border-top:1px solid var(--hair); font-size:12.5px; color:var(--mute); }
  @media (max-width:640px) {
    .entry, .cards.stack .card { grid-template-columns:1fr; gap:4px; }
    .stats.rows { grid-template-columns:1fr; } .stats.rows .v { padding-bottom:0; border-bottom:0; } .stats.rows .l { padding-top:2px; }
    .e-fields { grid-template-columns:1fr; gap:2px; } .f .k { margin-top:4px; }
  }

  .topbar { position:sticky; top:0; z-index:10; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--hair); }
  .topbar .wrap { display:flex; justify-content:space-between; align-items:center; gap:16px; padding-top:10px; padding-bottom:10px; }
  .topbar .eyebrow { white-space:nowrap; overflow:visible; }
  .dl-btn { display:inline-flex; align-items:center; gap:8px; flex:none; white-space:nowrap; background:var(--ink); color:var(--paper); border:0; border-radius:999px; padding:9px 16px; font:500 13px/1 var(--sans); text-decoration:none; cursor:pointer; }
  .dl-btn:hover { background:#333; }
  .dl-btn:focus-visible { outline:2px solid var(--ink); outline-offset:3px; }
  .dl-btn svg { width:15px; height:15px; }

  /* cover: an A4-shaped panel on screen, the whole first page in print */
  .cover { position:relative; width:100%; aspect-ratio:210 / 297; max-height:1240px; margin:32px auto 0; border-radius:22px; overflow:hidden; }
  .cover-default { background:var(--ink); color:var(--paper); padding:7% 8%; display:flex; flex-direction:column; justify-content:space-between; }
  .cover-default .eyebrow, .cover-default .lbl { color:#bdbdbd; }
  .cover-default .eyebrow { font-size:12px; letter-spacing:.14em; }
  .cover-default .lbl { font-size:11px; letter-spacing:.12em; margin-bottom:6px; }
  .cover-default .cv-top { display:flex; align-items:center; gap:14px; }
  .cover-default .cv-mark { width:64px; height:64px; display:grid; place-items:center; border:1.5px solid var(--paper); border-radius:18px; color:var(--paper); }
  .cover-default .cv-mark svg { width:38px; height:38px; color:var(--paper); }
  .cover-default h1 { font-size:clamp(40px,7vw,80px); line-height:.98; letter-spacing:-.045em; max-width:12ch; }
  .cover-default .cv-mid p { font-size:19px; color:#d6d6d6; max-width:30ch; margin-top:18px; }
  .cover-default .cv-foot { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; border-top:1px solid #444; padding-top:18px; }
  .cover-default .cv-foot .eyebrow { white-space:nowrap; }
  .cover-default .cv-foot b { font-weight:600; font-size:18px; letter-spacing:-.01em; }

  @page { size:A4; margin:16mm 14mm 18mm; }
  @page cover { margin:0; }
  @page onepage { margin:9mm 12mm 8mm; }
  @media print {
    .topbar { display:none; }
    body { font-size:9.5pt; line-height:1.5; }
    .wrap { max-width:none; padding:0; }
    .cover { page:cover; width:210mm; height:297mm; max-height:none; aspect-ratio:auto; margin:0; border-radius:0; break-after:page; } .part { break-before:page; }
    .part + .part { margin-top:0; border-top:0; } .part-head { padding:0 0 14px; }
    .hero-ic { width:44px; height:44px; border-radius:12px; } .hero-ic svg { width:26px; height:26px; }
    h1 { font-size:22pt; }
    .sub { font-size:10.5pt; } .aside { font-size:10pt; }
    section { padding:22px 0 0; }
    .sec-head { margin-bottom:10px; } .chip { width:30px; height:30px; border-radius:9px; } .chip svg { width:18px; height:18px; }
    h2 { font-size:13.5pt; } h3 { font-size:10.5pt; }
    .num { font-size:7pt; }
    p { margin-bottom:7px; }
    .note { font-size:9pt; }
    .verdict { padding:12px 16px; gap:18px; margin:6px 0 14px; border-radius:12px; }
    .score span { font-size:30pt; } .score small { font-size:12pt; } .big { font-size:12.5pt; }
    ul.rows, ol.steps, .tbl, .entries, .cards, .stats { margin:2px 0 14px; }
    .callout { margin:6px 0 14px; padding:8px 0; }
    ul.rows li, ol.steps li { padding:5px 0; } ol.steps li { padding-left:30px; } ol.steps li::before { top:6px; font-size:7.5pt; }
    .stat, .stats.rows .v, .stats.rows .l { padding:7px 0; } .stat .v { font-size:17pt; } .stats.grid .l { font-size:7pt; margin-top:4px; } .stats.rows .l { font-size:9.5pt; }
    section, .verdict, .card, .stat, .callout, .entry, tr { break-inside:avoid; }
    .sec-head { break-after:avoid; }
    .tbl { overflow:visible; }
    table { font-size:8.8pt; } table.wide { font-size:7.6pt; }
    th, td { padding:5px 10px 5px 0; } table.wide th, table.wide td { padding:4px 5px 4px 0; }
    th { font-size:7pt; padding-bottom:5px; } table.wide th { font-size:6.6pt; }
    .entry { padding:9px 0; gap:4px 20px; } .entry.hl, .card.target { box-shadow:10px 0 0 var(--wash), -10px 0 0 var(--wash); }
    .e-title { font-size:10pt; } .t { font-size:9pt; } .k { font-size:6.8pt; padding-top:2px; } .e-fields { grid-template-columns:fit-content(110px) 1fr; gap:3px 12px; }
    .card { padding:9px 0 10px; } .cards.stack .card { gap:4px 20px; }
    .tag { font-size:7pt; margin-bottom:5px; } .price { font-size:16pt; margin:4px 0 1px; } .meta { font-size:8.5pt; }
    .card ul.rows { font-size:9pt; } .card ul.rows li { padding:3px 0; } .foot { font-size:8.5pt; margin-top:5px; padding-top:5px; }
    .sources ul.rows { font-size:8.5pt; } .sources li { padding:4px 0; } .sources .muted { font-size:7pt; }
    a { text-decoration:none; }
    code { font-size:8pt; }
    footer { margin-top:24px; padding:12px 0 0; font-size:8.5pt; }
    /* one-page layout: a dense single sheet, sections may share a page */
    .one-page { font-size:8.6pt; line-height:1.42; } .one-page .wrap { page:onepage; }
    .one-page .part-head { padding:0 0 6px; } .one-page .title-row { margin:4px 0 4px; gap:10px; }
    .one-page .hero-ic { width:36px; height:36px; border-radius:10px; } .one-page .hero-ic svg { width:22px; height:22px; }
    .one-page h1 { font-size:18pt; } .one-page .sub { font-size:9.5pt; } .one-page .aside { font-size:9pt; margin-top:4px; }
    .one-page section { padding:8px 0 0; break-inside:auto; } .one-page .sec-head { margin-bottom:4px; gap:8px; }
    .one-page .chip { width:24px; height:24px; border-radius:7px; } .one-page .chip svg { width:14px; height:14px; }
    .one-page h2 { font-size:11pt; } .one-page .num { display:none; }
    .one-page .verdict { padding:9px 14px; gap:14px; margin:4px 0 4px; border-radius:11px; }
    .one-page .score span { font-size:26pt; } .one-page .big { font-size:11pt; margin-bottom:2px; } .one-page p { margin-bottom:4px; }
    .one-page ul.rows, .one-page ol.steps, .one-page .tbl, .one-page .entries, .one-page .cards, .one-page .stats, .one-page .callout { margin:2px 0 4px; }
    .one-page ul.rows li, .one-page ol.steps li { padding:2px 0; } .one-page ol.steps li { padding-left:24px; } .one-page ol.steps li::before { top:3px; font-size:7pt; }
    .one-page .stats.grid { grid-template-columns:repeat(4, 1fr); gap:0 12px; }
    .one-page .stat { padding:4px 0; } .one-page .stat .v { font-size:13pt; } .one-page .stats.grid .l { font-size:6.5pt; margin-top:2px; }
    .one-page .cards.stack, .one-page .cards.grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:0 14px; align-items:start; }
    .one-page .cards.stack .card { display:block; }
    .one-page .card { padding:5px 0 6px; } .one-page .card.target { box-shadow:6px 0 0 var(--wash), -6px 0 0 var(--wash); }
    .one-page .tag { font-size:6.5pt; margin-bottom:3px; } .one-page .card.target .tag { padding:3px 6px 2px; }
    .one-page .card h3 { font-size:9.5pt; } .one-page .card ul.rows { margin-top:3px; font-size:8.2pt; border-top:1px solid var(--hair); }
    .one-page .card ul.rows li { padding:2px 0; } .one-page .card ul.rows li:first-child { padding-top:2px; }
    .one-page .foot { font-size:7.8pt; margin-top:3px; padding-top:3px; } .one-page .callout { padding:5px 0; }
    .one-page table { font-size:8.2pt; } .one-page th, .one-page td { padding:2px 8px 2px 0; } .one-page th { font-size:6.5pt; }
    .one-page .sources ul.rows { font-size:7.6pt; } .one-page .sources li { padding:1px 0; }
    .one-page footer { margin-top:6px; padding-top:4px; font-size:7.2pt; } .one-page code { font-size:7.6pt; padding:0 4px; }
    .one-page .muted { font-size:7pt; }
  }
</style>
</head>
<body${spec.layout === 'one-page' ? ' class="one-page"' : ''}>
${topbar}
<div class="wrap">
  ${cover}
  <main>
    ${body}
  </main>
  <footer>${inline(spec.footer || `Made with /gtm. Outside claims carry a source or say Estimate. Nothing about the company was invented.`)}</footer>
</div>
</body>
</html>
`;

if (/[—–]/.test(html)) {
  console.error('render-report: the report contains an em or en dash. Rewrite those sentences and render again.');
  process.exit(2);
}
writeFileSync(outPath, html);
console.log(outPath);

if (pdfPath) {
  const chrome = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => p && existsSync(p));
  if (!chrome) {
    console.error('render-report: no Chrome found for PDF export. Set CHROME_PATH or open the HTML and print to PDF.');
    process.exit(3);
  }
  // A throwaway profile per print, so a running Chrome or an earlier print never holds the lock.
  const profile = mkdtempSync(join(tmpdir(), 'gtm-chrome-'));
  const chromeArgs = [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-mock-keychain',
    '--password-store=basic',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=15000',
    `--print-to-pdf=${resolve(pdfPath)}`,
    pathToFileURL(resolve(outPath)).href,
  ];
  // Chrome often writes the PDF and then exits non-zero when its teardown watchdog fires,
  // so success is judged by the file, not the exit code. One retry covers a failed launch.
  const target = resolve(pdfPath);
  rmSync(target, { force: true });
  const printed = () => existsSync(target) && statSync(target).size > 0;
  try {
    for (let attempt = 0; attempt < 2 && !printed(); attempt++) {
      try {
        execFileSync(chrome, chromeArgs, { stdio: 'ignore', timeout: 90_000 });
      } catch {
        // checked below
      }
    }
  } finally {
    // A crash-dump helper can outlive the watchdog; end anything still using this profile.
    try {
      execFileSync('pkill', ['-f', profile], { stdio: 'ignore' });
    } catch {
      // nothing left running
    }
    rmSync(profile, { recursive: true, force: true });
  }
  if (!printed()) {
    console.error('render-report: Chrome did not write the PDF. The HTML is ready; open it and use Download PDF.');
    process.exit(3);
  }
  console.log(pdfPath);
}
