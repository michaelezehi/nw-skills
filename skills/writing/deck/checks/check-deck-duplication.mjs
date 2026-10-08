#!/usr/bin/env node
/**
 * Catch a headline figure stated on more than one main slide.
 *
 * A number repeated across two slides is not emphasis, it is the reader
 * discovering that two slides are doing the same job. It happened here twice:
 * the England treatment figure and the alcohol harm cost were both on the
 * stakes slide and again on the market-by-region slide, so the second one read
 * as a slide the deck had already given.
 *
 * The appendix is exempt: sourcing a figure is exactly where it should appear
 * a second time. So is a figure that appears twice on the same slide, which is
 * a layout choice rather than a repeated claim.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-duplication.mjs <deck.html>'); process.exit(1); }
const html = await readFile(file, 'utf-8');

const main = html.slice(0, html.indexOf('APPENDIX DIVIDER') >= 0
  ? html.indexOf('APPENDIX DIVIDER')
  : html.length);

/**
 * The deck sets a unit in its own span, so "27.4bn" reaches here as
 * "&pound; 27.4 bn" on a stat slide and as "&pound;27.4bn" in a sentence.
 * Without closing that gap the same claim reads as two different figures.
 */
const normalise = (chunk) =>
  chunk
    .replace(/<[^>]+>/g, ' ')
    .replace(/&pound;|&#36;/g, '')
    .replace(/(\d)\s+(bn|m|k|%)\b/g, '$1$2');

const slides = [...main.matchAll(/<section class="slide[^"]*">([\s\S]*?)<\/section>/g)].map(
  (m) => normalise(m[1]),
);

/** figures worth policing: money, large counts, and percentages with a unit */
const FIGURE = /\d[\d,.]*(?:bn|m|k)?\b/g;
const interesting = (f) => /[,.]|bn|m\b|k\b/.test(f) && !/^\d{1,2}$/.test(f);

const seen = new Map();
slides.forEach((text, i) => {
  const here = new Set();
  for (const m of text.matchAll(FIGURE)) {
    const f = m[0];
    if (!interesting(f)) continue;
    here.add(f);
  }
  for (const f of here) {
    if (!seen.has(f)) seen.set(f, []);
    seen.get(f).push(i + 1);
  }
});

const dupes = [...seen.entries()].filter(([, pages]) => pages.length > 1);
// A deck declares its own repeats, in its own head, so the exception is
// visible to whoever opens the file rather than buried in this script. Three
// decks share this checker now, and the investor deck's gambling figure is no
// business of the sales guide's.
//
// Separated by semicolons, not commas, because the figures it lists are
// thousands-separated: splitting "250,000" on a comma allows "250" and "000"
// and never the number anyone wrote.
//
//   <meta name="deck-repeat-ok" content="1.3; 1.3m">
const declared = /<meta name="deck-repeat-ok" content="([^"]*)"/.exec(html)?.[1] ?? '';
const allowed = new Set(declared.split(';').map((t) => t.trim()).filter(Boolean));

const faults = dupes.filter(([f]) => !allowed.has(f));
if (faults.length) {
  for (const [f, pages] of faults) console.error(`${f} appears on slides ${pages.join(' and ')}`);
  process.exit(1);
}
console.log(`NO_DUPES ${slides.length} main slides, no figure claimed twice`);
