#!/usr/bin/env node
/**
 * Every slide carries a drawing.
 *
 * The divider and the appendix slides are the ones that quietly ship as walls
 * of type, because they are written last and they read as "just" a section
 * break. They are the slides a reader lands on hardest.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-figures.mjs <deck.html>'); process.exit(1); }
const slides = (await readFile(file, 'utf-8')).split(/<section class="slide/).slice(1);
const bare = [];
slides.forEach((slide, i) => {
  const name = slide.match(/class="pageno">([^<]*)/)?.[1]
    ?? slide.match(/&middot; ([^<]*)<\/span>/)?.[1]
    ?? `slide ${i + 1}`;
  if (!/<img[^>]+src="art\//.test(slide)) bare.push(name.trim() || `slide ${i + 1}`);
});
if (bare.length) { console.error(`slides with no drawing: ${bare.join(', ')}`); process.exit(1); }
console.log(`FIGURES_OK ${slides.length} slides, every one carries a drawing`);
