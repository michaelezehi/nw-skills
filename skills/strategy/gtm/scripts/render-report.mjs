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
// Without it, or for a missing name, a plain drawn glyph is used, so the page always renders.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
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

const BLOCKS = {
  p: (b) => `<p>${inline(b.text)}</p>`,
  list: (b) => `<ul class="ticks">${(b.items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`,
  steps: (b) => `<ol class="steps">${(b.items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`,
  note: (b) => `<p class="note">${inline(b.text)}</p>`,
  callout: (b) =>
    `<div class="callout sk"><span class="lbl">${esc(b.label || 'Note')}</span><p>${inline(b.text)}</p></div>`,
  verdict: (b) => `
    <div class="verdict sk">
      <div class="score"><span>${esc(b.score)}${b.out_of ? `<small>/${esc(b.out_of)}</small>` : ''}</span></div>
      <div><span class="lbl">${esc(b.label || 'Verdict')}</span><p class="big">${inline(b.headline || '')}</p>${b.text ? `<p>${inline(b.text)}</p>` : ''}</div>
    </div>`,
  stats: (b) =>
    `<div class="stats">${(b.items || [])
      .map((s) => `<div class="stat sk"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`)
      .join('')}</div>`,
  table: (b) => `
    <div class="tbl sk"><table>
      <thead><tr>${(b.head || []).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${(b.rows || [])
        .map(
          (r, i) =>
            `<tr${(b.highlight || []).includes(i) ? ' class="hl"' : ''}>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>
    </table></div>`,
  cards: (b) =>
    `<div class="cards">${(b.items || [])
      .map(
        (c) => `
      <div class="card sk${c.target ? ' target' : ''}">
        ${c.tag ? `<span class="lbl">${esc(c.tag)}</span>` : ''}
        <h3>${inline(c.title)}</h3>
        ${c.price ? `<div class="price">${esc(c.price)}</div>` : ''}
        ${c.meta ? `<div class="meta">${inline(c.meta)}</div>` : ''}
        ${c.points ? `<ul class="ticks">${c.points.map((p) => `<li>${inline(p)}</li>`).join('')}</ul>` : ''}
        ${c.foot ? `<div class="foot">${inline(c.foot)}</div>` : ''}
      </div>`,
      )
      .join('')}</div>`,
};

function block(b) {
  const fn = BLOCKS[b.type];
  if (!fn) throw new Error(`unknown block type: ${b.type}`);
  return fn(b);
}

function secHead(ic, num, heading) {
  return `<div class="sec-head"><span class="chip sk">${icon(ic)}</span><div><span class="num">${esc(num)}</span><h2>${inline(heading)}</h2></div></div>`;
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
    ? `<section class="did">${secHead('decision-stamp', '00', 'What I did')}
        <ol class="steps">${s.steps.map((x) => `<li>${inline(x)}</li>`).join('')}</ol></section>`
    : '';
  const assumptions = (s.assumptions || []).length
    ? `<div class="assume">${s.assumptions.map((a) => `<p>Assumption: ${inline(a)}</p>`).join('')}</div>`
    : '';
  const next = (s.next || []).length
    ? `<section>${secHead('flag', '→', 'Next')}<ul class="ticks">${s.next.map((n) => `<li>${inline(n)}</li>`).join('')}</ul></section>`
    : '';
  const sources = (s.sources || []).length
    ? `<section class="sources">${secHead('domain-link', '§', 'Sources')}
        <ul>${s.sources
          .map(
            (x) =>
              `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label || x.url)}</a>${x.checked ? ` <span class="muted">checked ${esc(x.checked)}</span>` : ''}</li>`,
          )
          .join('')}</ul></section>`
    : '';
  return `
  <article class="part" id="part-${esc(id)}">
    <header class="part-head">
      <div class="eyebrow">${esc(['gtm ' + (s.skill || ''), s.project, s.date].filter(Boolean).join(' · '))}</div>
      <div class="title-row">
        <span class="hero-ic sk">${icon(ic)}</span>
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
  :root { --ink:#111; --paper:#fff; --mute:#666; --hair:#e6e6e6; --wash:#f6f6f4; --icon-accent:#cfcfcf; }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { margin:0; background:var(--paper); color:var(--ink); font:400 16px/1.65 "Geist", system-ui, sans-serif; }
  .wrap { max-width:960px; margin:0 auto; padding:0 16px; }
  @media (min-width:720px) { .wrap { padding:0 32px; } }

  /* rounded outline, never a square box */
  .sk { border:1.5px solid var(--ink); border-radius:18px; }

  .eyebrow, .lbl, .num, th, .stat .l { font-family:"Geist Mono", ui-monospace, monospace; }
  .eyebrow { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--mute); }
  .part-head { padding:56px 0 28px; }
  .title-row { display:flex; gap:18px; align-items:center; margin:14px 0 10px; }
  .hero-ic { width:76px; height:76px; flex:none; display:grid; place-items:center; }
  .hero-ic svg { width:46px; height:46px; }
  h1 { font:600 clamp(34px,5.6vw,56px)/1.04 "Geist", system-ui, sans-serif; letter-spacing:-.035em; margin:0; }
  .sub { font-size:18px; color:#333; max-width:720px; margin:6px 0 0; }
  .aside { font-size:17px; font-weight:500; color:var(--ink); margin:10px 0 0; letter-spacing:-.01em; }

  svg.nw { color:var(--ink); }
  svg.nw [data-layer="face"] { fill:var(--icon-face, transparent); }
  svg.nw [data-layer="shade"] { fill:color-mix(in srgb, currentColor 14%, transparent); }
  svg.nw [data-layer="accent"] { fill:var(--icon-accent); }
  svg.nw [data-layer="ink"] { fill:currentColor; }

  section { padding:30px 0 6px; }
  .sec-head { display:flex; gap:14px; align-items:center; margin-bottom:14px; }
  .chip { width:46px; height:46px; flex:none; display:grid; place-items:center; background:var(--paper); }
  .chip svg { width:26px; height:26px; }
  .num { font-size:12px; color:var(--mute); letter-spacing:.1em; }
  h2 { font:600 26px/1.2 "Geist", system-ui, sans-serif; letter-spacing:-.02em; margin:0; }
  h3 { font-size:17px; font-weight:600; margin:4px 0; letter-spacing:-.01em; }
  p { margin:0 0 12px; max-width:740px; }
  a { color:var(--ink); text-underline-offset:3px; }
  code { font:13px "Geist Mono", ui-monospace, monospace; background:var(--wash); padding:1px 6px; border-radius:6px; }
  .muted { color:var(--mute); font-size:13px; }
  .lbl { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--mute); display:block; margin-bottom:6px; }

  .assume { margin:6px 0 4px; padding:14px 18px; background:var(--wash); border-radius:16px; font-size:14px; color:#444; }
  .assume p { margin:0 0 4px; }

  ul.ticks { list-style:none; padding:0; margin:0 0 12px; max-width:760px; }
  ul.ticks li { position:relative; padding-left:26px; margin-bottom:7px; }
  ul.ticks li::before { content:""; position:absolute; left:3px; top:.62em; width:11px; height:6px; border-left:2px solid var(--ink); border-bottom:2px solid var(--ink); transform:rotate(-48deg); border-radius:1px; }
  ol.steps { counter-reset:s; list-style:none; padding:0; margin:0 0 12px; display:grid; gap:8px; }
  ol.steps li { counter-increment:s; position:relative; padding:2px 0 2px 40px; }
  ol.steps li::before { content:counter(s); position:absolute; left:0; top:0; width:28px; height:28px; display:grid; place-items:center; font:600 13px/1 "Geist", sans-serif; border:1.5px solid var(--ink); border-radius:50%; }

  .note { font-size:15.5px; color:var(--mute); }
  .callout { padding:16px 20px; margin:6px 0 16px; }
  .callout p:last-child { margin:0; }

  .verdict { display:flex; gap:26px; align-items:center; padding:22px 24px; margin:6px 0 16px; }
  .score { flex:none; min-width:96px; }
  .score span { font:600 52px/1 "Geist", system-ui, sans-serif; letter-spacing:-.04em; white-space:nowrap; }
  .score small { font-size:20px; color:var(--mute); letter-spacing:0; }
  .big { font:600 21px/1.3 "Geist", system-ui, sans-serif; letter-spacing:-.015em; margin-bottom:6px; }
  @media (max-width:560px) { .verdict { flex-direction:column; align-items:flex-start; } }

  /* labels wrap instead of being cut off */
  .stats { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%,200px),1fr)); gap:12px; margin:6px 0 16px; }
  .stat { padding:14px 16px; }
  .stat .v { font:600 30px/1.1 "Geist", system-ui, sans-serif; letter-spacing:-.03em; white-space:nowrap; }
  .stat .l { font-size:11.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--mute); margin-top:4px; }

  .tbl { overflow-x:auto; margin:6px 0 16px; padding:4px 6px; }
  table { border-collapse:collapse; width:100%; font-size:14.5px; }
  th, td { text-align:left; vertical-align:top; padding:10px 12px; border-bottom:1px dashed #cfcfcf; overflow-wrap:break-word; hyphens:auto; }
  th { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--mute); font-weight:500; border-bottom:1.5px solid var(--ink); }
  tr:last-child td { border-bottom:0; }
  tr.hl td { background:var(--wash); font-weight:500; }

  .cards { display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(min(100%,260px),1fr)); margin:6px 0 16px; }
  .card { padding:18px 18px 16px; display:flex; flex-direction:column; }
  .card.target { background:var(--ink); color:var(--paper); }
  .card.target .lbl, .card.target .meta, .card.target .foot { color:#bdbdbd; }
  .card.target ul.ticks li::before { border-color:var(--paper); }
  .card.target a { color:var(--paper); }
  .price { font:600 32px/1.1 "Geist", system-ui, sans-serif; letter-spacing:-.03em; margin:4px 0 2px; }
  .meta { font-size:13px; color:var(--mute); }
  .card ul.ticks { margin-top:12px; font-size:14.5px; }
  .foot { margin-top:auto; padding-top:10px; border-top:1px dashed currentColor; font-size:13px; color:var(--mute); }

  .sources ul { padding-left:18px; font-size:14px; }
  .sources li { margin-bottom:5px; overflow-wrap:anywhere; }
  .part + .part { margin-top:48px; border-top:1.5px solid var(--ink); }
  footer { padding:30px 0 60px; margin-top:24px; border-top:1px dashed #cfcfcf; font-size:13px; color:var(--mute); }

  /* cover: an A4-shaped panel on screen, the whole first page in print */
  .cover { position:relative; width:100%; aspect-ratio:210 / 297; max-height:1240px; margin:32px auto 0; border-radius:22px; overflow:hidden; }
  .cover-default { background:var(--ink); color:var(--paper); padding:7% 8%; display:flex; flex-direction:column; justify-content:space-between; }
  .cover-default .eyebrow, .cover-default .lbl { color:#bdbdbd; }
  .cover-default .cv-top { display:flex; align-items:center; gap:14px; }
  .cover-default .cv-mark { width:64px; height:64px; display:grid; place-items:center; border:1.5px solid var(--paper); border-radius:18px; color:var(--paper); }
  .cover-default .cv-mark svg { width:38px; height:38px; color:var(--paper); }
  .cover-default h1 { font-size:clamp(40px,7vw,80px); line-height:.98; letter-spacing:-.045em; max-width:12ch; }
  .cover-default .cv-mid p { font-size:19px; color:#d6d6d6; max-width:30ch; margin-top:18px; }
  .cover-default .cv-foot { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; border-top:1px solid #444; padding-top:18px; }
  .cover-default .cv-foot b { font-weight:600; font-size:18px; letter-spacing:-.01em; }

  @page { size:A4; margin:16mm 14mm 18mm; }
  @page cover { margin:0; }
  @media print {
    body { font-size:10.5pt; line-height:1.55; }
    section { padding:16px 0 4px; }
    .chip { width:38px; height:38px; } .chip svg { width:22px; height:22px; }
    h2 { font-size:17pt; }
    .stats, .cards, .tbl, .verdict, .callout { margin:4px 0 12px; }
    .wrap { max-width:none; padding:0; }
    .cover { page:cover; width:210mm; height:297mm; max-height:none; aspect-ratio:auto; margin:0; border-radius:0; break-after:page; }
    .part { break-before:page; }
    .part + .part { margin-top:0; border-top:0; }
    .part-head { padding-top:0; }
    h1 { font-size:30pt; }
    section, .verdict, .card, .stat, .callout, tr { break-inside:avoid; }
    .sec-head { break-after:avoid; }
    .tbl { overflow:visible; }
    table { font-size:9.5pt; }
    th, td { padding:6px 7px; }
    th { font:600 8pt/1.3 "Geist", system-ui, sans-serif; letter-spacing:0; text-transform:none; color:var(--ink); }
    a { text-decoration:none; }
    footer { padding-bottom:0; }
  }
</style>
</head>
<body>
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
  // Headless Chrome occasionally fails to launch; one retry clears it.
  try {
    try {
      execFileSync(chrome, chromeArgs, { stdio: 'ignore', timeout: 90_000 });
    } catch {
      execFileSync(chrome, chromeArgs, { stdio: 'ignore', timeout: 90_000 });
    }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(pdfPath);
}
