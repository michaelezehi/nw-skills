#!/usr/bin/env node
/**
 * Fail a deck whose slides all share one composition.
 *
 * The Unframed investor deck of 9 September ran fourteen slides on one grid:
 * eyebrow, headline top-left, one component, a small drawing in a right-hand
 * column. Every slide was correct and the deck read as a template at thumbnail
 * size, which no other check here can see, because every slide passes on its
 * own. The fix was composition: the split set per slide, the drawing large,
 * and the drawing swapping sides at the turns of the argument.
 *
 * This reads each main slide's composition as a signature, the shape of its
 * grid tracks plus which side the drawing sits on, and fails when one
 * signature carries more than SHARE of the slides or runs RUN slides in a row.
 * Exact track values are deliberately coarsened: `1.04fr .96fr` and
 * `1.12fr .88fr` are the same composition wearing different numbers, and that
 * is precisely the template smell.
 *
 *   node check-deck-rhythm.mjs <deck.html>
 */
import { readFile } from 'node:fs/promises';

const SHARE = 0.6; // no one composition on more than three slides in five
const RUN = 3;     // and never three of the same in a row

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-rhythm.mjs <deck.html>'); process.exit(1); }
const html = await readFile(file, 'utf-8');

const main = html.slice(0, html.indexOf('APPENDIX DIVIDER') >= 0 ? html.indexOf('APPENDIX DIVIDER') : html.length);
const slides = [...main.matchAll(/<section class="slide([^"]*)"[^>]*>([\s\S]*?)<\/section>/g)]
  .filter((m) => !/\bcover\b|\bdivider\b/.test(m[1]));

/** Coarsen a grid-template-columns value to the shape of its tracks. */
function shape(value) {
  return value.trim().split(/\s+/).map((t) => {
    if (/^\d+px$/.test(t)) return 'px';
    if (/^minmax\(0,\s*\d*\.?\d*fr\)$/.test(t) || /fr$/.test(t)) return 'fr';
    if (/^repeat\((\d+)/.test(t)) return `x${RegExp.$1}`;
    return 'auto';
  }).join(' ');
}

function signature(inner) {
  // the first grid with inline columns is the slide's frame
  const grid = /<div class="(?:split|stage)[^"]*"[^>]*style="[^"]*grid-template-columns:([^;"]+)/.exec(inner);
  const artAt = inner.search(/<div class="(?:art|fig)\b[^>]*>\s*<img/);
  if (!grid) return artAt < 0 ? 'single, no art' : 'single';
  const tracks = shape(grid[1]);
  // is the drawing the first child of the frame, or after the copy?
  const frameStart = grid.index;
  const copyAt = inner.slice(frameStart).search(/<div class="copy"|<div>\s*<div class="eyebrow"|<div>\s*<h2|<h2/);
  const artRel = artAt < 0 ? -1 : artAt - frameStart;
  const side = artAt < 0 ? 'no art' : (copyAt < 0 || artRel < copyAt) ? 'art left' : 'art right';
  return `${tracks}, ${side}`;
}

const sigs = slides.map((m) => signature(m[2]));
const count = new Map();
for (const s of sigs) count.set(s, (count.get(s) ?? 0) + 1);
const [top, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];

const faults = [];
if (slides.length >= 5 && n / slides.length > SHARE) {
  faults.push(`"${top}" carries ${n} of ${slides.length} main slides. The deck reads as a template.`);
}
let run = 1;
for (let i = 1; i < sigs.length; i++) {
  run = sigs[i] === sigs[i - 1] ? run + 1 : 1;
  if (run === RUN) faults.push(`slides ${i - 1} to ${i + 1} share "${sigs[i]}". Three in a row is a rhythm nobody hears.`);
}

if (faults.length) {
  for (const f of faults) console.error(f);
  console.error('\ncompositions seen:');
  for (const [s, c] of [...count.entries()].sort((a, b) => b[1] - a[1])) console.error(`  ${c}  ${s}`);
  process.exit(1);
}
console.log(`RHYTHM_OK ${slides.length} main slides, ${count.size} compositions, none on more than ${n}`);
