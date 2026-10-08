#!/usr/bin/env node
/**
 * Table columns line up down the page, and values start on the column.
 *
 * Two faults hide behind valid CSS. An `auto` track sizes itself to the content
 * of its own grid, and each table row here is its own grid, so `auto` puts
 * every row's column in a slightly different place: the table looks ragged and
 * nothing in the source looks wrong. And a right-aligned value column lines up
 * the last character of each value rather than the first, which reads as
 * misalignment against a left-aligned table.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-alignment.mjs <deck.html>'); process.exit(1); }
const html = await readFile(file, 'utf-8');

const faults = [];

for (const m of html.matchAll(/<div class="row"[^>]*style="([^"]*)"/g)) {
  if (/grid-template-columns:[^;"]*\bauto\b/.test(m[1])) {
    faults.push(`row with an auto track, so it cannot align with its neighbours: ${m[1].slice(0, 70)}`);
  }
}

const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
for (const m of css.matchAll(/([.#][\w.-]+)\s*\{[^}]*text-align:\s*right/g)) {
  faults.push(`${m[1]} is right aligned; deck values start on the column`);
}


/**
 * A value that cannot wrap can widen its own row's tracks.
 *
 * Each `.row` is its own grid, so an `fr` track is really `minmax(auto, Xfr)`
 * and one long `white-space: nowrap` value pushes that row's columns out of
 * line with every other row in the block. It looks like a shared-track bug and
 * it is not: the tracks are shared, the content broke them. The cheap guard is
 * a character budget on the value column, measured against the longest value
 * the block already carries.
 */
const VALUE_BUDGET = 20;
for (const block of html.matchAll(/<div class="rows"[\s\S]*?<\/div>\s*<\/div>/g)) {
  for (const v of block[0].matchAll(/<span class="n">([^<]*)<\/span>/g)) {
    const text = v[1].replace(/&pound;/g, '\u00a3').replace(/&#36;/g, '$');
    if (text.length > VALUE_BUDGET) {
      faults.push(`value "${text}" is ${text.length} chars and will widen its own row`);
    }
  }
}

if (faults.length) { for (const f of faults) console.error(f); process.exit(1); }
console.log('ALIGNMENT_OK shared tracks, no right-aligned values');
