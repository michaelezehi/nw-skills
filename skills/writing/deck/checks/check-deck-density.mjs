#!/usr/bin/env node
/**
 * Hold a deck to its own text budget.
 *
 * Faye Safari's note on the first deck was that it reads as a document rather
 * than a deck. The fix has to be measurable or it drifts back on the next edit,
 * so every visible run of body copy on a numbered slide is counted here.
 * Footnotes, source lines and appendix slides are exempt: they exist to be
 * dense, and nobody reads them from across a room.
 */
import { readFile } from 'node:fs/promises';

const LIMIT = 45;
const file = process.argv[2];
if (!file) {
  console.error('usage: check-deck-density.mjs <deck.html>');
  process.exit(1);
}

const html = await readFile(file, 'utf-8');
const slides = html.split(/<section class="slide/).slice(1);

const over = [];
let seen = 0;
for (const slide of slides) {
  // The page number is the only thing that tells a main slide from an appendix
  // one. It was written as `.slide-number` here and as `.pageno` in the deck,
  // so this counted nothing at all until 9 September. Accept both, and refuse
  // to run silently over a deck where it matches neither.
  const number = slide.match(/class="(?:slide-number|pageno)"[^>]*>(?:<strong>)?([A-Z0-9]+)/)?.[1] ?? '?';
  if (number !== '?') seen++;
  if (!/^\d+$/.test(number)) continue; // appendix slides and dividers carry A-marks or none

  const body = slide.replace(/<div class="foot">[\s\S]*?<\/div>/g, '');
  for (const m of body.matchAll(/<p class="(lead|card p|tiny)?[^"]*"[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = m[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > LIMIT) over.push(`slide ${number}: ${words} words, "${text.slice(0, 60)}..."`);
  }
  for (const m of body.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > LIMIT) over.push(`slide ${number}: ${words} words, "${text.slice(0, 60)}..."`);
  }
}

if (seen === 0) {
  console.error('no slide carried a page number, so nothing was counted');
  process.exit(1);
}
if (over.length) {
  for (const line of over) console.error(line);
  process.exit(1);
}
console.log(`DENSITY_OK every body paragraph under ${LIMIT} words, across ${seen} numbered slides`);
