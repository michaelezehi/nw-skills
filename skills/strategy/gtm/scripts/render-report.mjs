#!/usr/bin/env node
// Render a gtm report spec (JSON) into one minimalist black-and-white HTML page.
// Usage: node render-report.mjs <report.json> <out.html>
// Icons: layered line icons (face, shade, accent, ink groups) read from $NW_ICONS_DIR.
// Without it, or for a missing name, a plain drawn glyph is used, so the page always renders.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) {
  console.error('usage: node render-report.mjs <report.json> <out.html>');
  process.exit(1);
}
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

// Inline marks: **bold**, `code`, [label](https://url). Everything else is escaped.
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

const scribble =
  '<svg class="scribble" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 60 3, 120 11, 180 6 S 270 4, 298 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const ring =
  '<svg class="ring" viewBox="0 0 120 80" aria-hidden="true"><path d="M60 6 C 100 4, 116 24, 114 42 C 112 64, 84 76, 56 74 C 24 72, 6 58, 8 38 C 10 18, 34 6, 66 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

const BLOCKS = {
  p: (b) => `<p>${inline(b.text)}</p>`,
  list: (b) => `<ul class="ticks">${(b.items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`,
  steps: (b) => `<ol class="steps">${(b.items || []).map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`,
  note: (b) => `<p class="note">${inline(b.text)}</p>`,
  callout: (b) =>
    `<div class="callout sk"><span class="lbl">${esc(b.label || 'Note')}</span><p>${inline(b.text)}</p></div>`,
  verdict: (b) => `
    <div class="verdict sk">
      <div class="score">${ring}<span>${esc(b.score)}${b.out_of ? `<small>/${esc(b.out_of)}</small>` : ''}</span></div>
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

const skillIcon = spec.icon || SKILL_ICONS[spec.skill] || 'flag';
const sections = (spec.sections || [])
  .map(
    (s, i) => `
  <section>
    <div class="sec-head">
      <span class="chip sk">${icon(s.icon || 'flag')}</span>
      <div><span class="num">${String(i + 1).padStart(2, '0')}</span><h2>${inline(s.heading)}</h2>${scribble}</div>
    </div>
    ${(s.blocks || []).map(block).join('\n')}
  </section>`,
  )
  .join('\n');

const done = (spec.steps || []).length
  ? `<section class="did">
      <div class="sec-head"><span class="chip sk">${icon('decision-stamp')}</span><div><span class="num">00</span><h2>What I did</h2>${scribble}</div></div>
      <ol class="steps">${spec.steps.map((s) => `<li>${inline(s)}</li>`).join('')}</ol>
    </section>`
  : '';

const assumptions = (spec.assumptions || []).length
  ? `<div class="assume">${spec.assumptions.map((a) => `<p>Assumption: ${inline(a)}</p>`).join('')}</div>`
  : '';

const next = (spec.next || []).length
  ? `<section>
      <div class="sec-head"><span class="chip sk">${icon('flag')}</span><div><span class="num">→</span><h2>Next</h2>${scribble}</div></div>
      <ul class="ticks">${spec.next.map((n) => `<li>${inline(n)}</li>`).join('')}</ul>
    </section>`
  : '';

const sources = (spec.sources || []).length
  ? `<section class="sources">
      <div class="sec-head"><span class="chip sk">${icon('domain-link')}</span><div><span class="num">§</span><h2>Sources</h2>${scribble}</div></div>
      <ul>${spec.sources
        .map(
          (s) =>
            `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label || s.url)}</a>${s.checked ? ` <span class="muted">checked ${esc(s.checked)}</span>` : ''}</li>`,
        )
        .join('')}</ul>
    </section>`
  : '';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif&family=Caveat:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root { --ink:#111; --paper:#fff; --mute:#666; --hair:#e6e6e6; --wash:#f6f6f4; --icon-accent:#cfcfcf; }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--paper); color:var(--ink); font:400 16px/1.65 "Instrument Sans", system-ui, sans-serif; }
  .wrap { max-width:960px; margin:0 auto; padding:0 16px; }
  @media (min-width:720px) { .wrap { padding:0 32px; } }

  /* hand-drawn outline: uneven radii so nothing reads as a square box */
  .sk { border:1.6px solid var(--ink); border-radius:18px 26px 16px 28px / 26px 16px 28px 18px; }

  header { padding:56px 0 28px; }
  .eyebrow, .lbl, .num, th, .stat .l, .muted { font-family:"Instrument Sans", system-ui, sans-serif; }
  .eyebrow { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .title-row { display:flex; gap:18px; align-items:center; margin:14px 0 10px; }
  .hero-ic { width:76px; height:76px; flex:none; display:grid; place-items:center; }
  .hero-ic svg { width:46px; height:46px; }
  h1 { font:400 clamp(36px,6vw,58px)/1.02 "Instrument Serif", Georgia, serif; letter-spacing:-.01em; margin:0; }
  .sub { font-size:18px; color:#333; max-width:720px; margin:6px 0 0; }
  .hand { font-family:"Caveat", cursive; font-size:22px; line-height:1.2; color:#333; }

  svg.nw { color:var(--ink); }
  svg.nw [data-layer="face"] { fill:var(--icon-face, transparent); }
  svg.nw [data-layer="shade"] { fill:color-mix(in srgb, currentColor 14%, transparent); }
  svg.nw [data-layer="accent"] { fill:var(--icon-accent); }
  svg.nw [data-layer="ink"] { fill:currentColor; }

  section { padding:30px 0 6px; }
  .sec-head { display:flex; gap:14px; align-items:flex-start; margin-bottom:14px; }
  .chip { width:46px; height:46px; flex:none; display:grid; place-items:center; background:var(--paper); }
  .chip svg { width:26px; height:26px; }
  .num { font-size:12px; color:var(--mute); letter-spacing:.1em; }
  h2 { font:400 28px/1.15 "Instrument Serif", Georgia, serif; margin:0; }
  .scribble { display:block; width:min(220px,60%); height:10px; margin-top:4px; color:var(--ink); }
  h3 { font-size:17px; font-weight:600; margin:4px 0; }
  p { margin:0 0 12px; max-width:740px; }
  a { color:var(--ink); text-underline-offset:3px; }
  code { font:13px ui-monospace, Menlo, monospace; background:var(--wash); padding:1px 6px; border-radius:6px; }
  .muted { color:var(--mute); font-size:13px; }
  .lbl { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--mute); white-space:nowrap; display:block; margin-bottom:6px; }

  .assume { margin:6px 0 4px; padding:14px 18px; background:var(--wash); border-radius:16px 22px 14px 20px; font-size:14px; color:#444; }
  .assume p { margin:0 0 4px; }

  ul.ticks { list-style:none; padding:0; margin:0 0 12px; max-width:760px; }
  ul.ticks li { position:relative; padding-left:26px; margin-bottom:7px; }
  ul.ticks li::before { content:""; position:absolute; left:3px; top:.62em; width:11px; height:6px; border-left:2px solid var(--ink); border-bottom:2px solid var(--ink); transform:rotate(-48deg); border-radius:1px; }
  ol.steps { counter-reset:s; list-style:none; padding:0; margin:0 0 12px; display:grid; gap:8px; }
  ol.steps li { counter-increment:s; position:relative; padding:2px 0 2px 40px; }
  ol.steps li::before { content:counter(s); position:absolute; left:0; top:0; width:28px; height:28px; display:grid; place-items:center; font:600 13px/1 "Instrument Sans", sans-serif; border:1.6px solid var(--ink); border-radius:50% 46% 52% 48% / 48% 52% 46% 50%; }

  .note { font-family:"Caveat", cursive; font-size:23px; line-height:1.25; color:#333; }
  .callout { padding:16px 20px; margin:6px 0 16px; }
  .callout p:last-child { margin:0; }

  .verdict { display:flex; gap:22px; align-items:center; padding:20px 22px; margin:6px 0 16px; }
  .score { position:relative; width:120px; height:80px; flex:none; display:grid; place-items:center; }
  .score .ring { position:absolute; inset:0; width:100%; height:100%; color:var(--ink); }
  .score span { font:400 38px/1 "Instrument Serif", Georgia, serif; white-space:nowrap; }
  .score small { font-size:18px; color:var(--mute); }
  .big { font:400 22px/1.3 "Instrument Serif", Georgia, serif; margin-bottom:6px; }
  @media (max-width:560px) { .verdict { flex-direction:column; align-items:flex-start; } }

  .stats { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%,170px),1fr)); gap:12px; margin:6px 0 16px; }
  .stat { padding:14px 16px; }
  .stat .v { font:400 32px/1.1 "Instrument Serif", Georgia, serif; white-space:nowrap; }
  .stat .l { font-size:11.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .tbl { overflow-x:auto; margin:6px 0 16px; padding:4px 6px; }
  table { border-collapse:collapse; width:100%; font-size:14.5px; }
  th, td { text-align:left; vertical-align:top; padding:10px 12px; border-bottom:1px dashed #cfcfcf; }
  th { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--mute); font-weight:500; white-space:nowrap; border-bottom:1.6px solid var(--ink); }
  tr:last-child td { border-bottom:0; }
  tr.hl td { background:var(--wash); font-weight:500; }

  .cards { display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(min(100%,260px),1fr)); margin:6px 0 16px; }
  .card { padding:18px 18px 16px; display:flex; flex-direction:column; }
  .card.target { background:var(--ink); color:var(--paper); }
  .card.target .lbl, .card.target .meta, .card.target .foot { color:#bdbdbd; }
  .card.target ul.ticks li::before { border-color:var(--paper); }
  .card.target a { color:var(--paper); }
  .price { font:400 34px/1.1 "Instrument Serif", Georgia, serif; white-space:nowrap; margin:4px 0 2px; }
  .meta { font-size:13px; color:var(--mute); }
  .card ul.ticks { margin-top:12px; font-size:14.5px; }
  .foot { margin-top:auto; padding-top:10px; border-top:1px dashed currentColor; font-size:13px; color:var(--mute); }

  .sources ul { padding-left:18px; font-size:14px; }
  .sources li { margin-bottom:5px; }
  footer { padding:30px 0 60px; margin-top:24px; border-top:1px dashed #cfcfcf; font-size:13px; color:var(--mute); }
  @media print { .card.target { color:#000; background:#fff; } header { padding-top:10px; } section { break-inside:avoid; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">${esc(['gtm ' + (spec.skill || ''), spec.project, spec.date].filter(Boolean).join(' · '))}</div>
    <div class="title-row">
      <span class="hero-ic sk">${icon(skillIcon)}</span>
      <h1>${inline(spec.title)}</h1>
    </div>
    ${spec.subtitle ? `<p class="sub">${inline(spec.subtitle)}</p>` : ''}
    ${spec.aside ? `<p class="hand">${inline(spec.aside)}</p>` : ''}
    ${assumptions}
  </header>
  <main>
    ${spec.summary ? block({ type: 'verdict', ...spec.summary }) : ''}
    ${done}
    ${sections}
    ${next}
    ${sources}
  </main>
  <footer>${inline(spec.footer || `Made with /gtm ${spec.skill || ''}. Outside claims carry a source or say Estimate. Nothing about the company was invented.`)}</footer>
</div>
</body>
</html>
`;

if (/[\u2014\u2013]/.test(html)) {
  console.error('render-report: the report contains an em or en dash. Rewrite those sentences and render again.');
  process.exit(2);
}
writeFileSync(outPath, html);
console.log(outPath);
