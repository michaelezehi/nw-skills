#!/usr/bin/env node
/**
 * All three brand grounds are actually in use, and each slide picks exactly one.
 *
 * A third ground is only worth having if it appears. It is also only worth
 * having if it stays rare, so this fails a deck that leans on any one ground
 * for more than four fifths of its pages.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-grounds.mjs <deck.html>'); process.exit(1); }
const classes = [...(await readFile(file, 'utf-8')).matchAll(/<section class="slide([^"]*)"/g)].map(m => m[1]);
const count = { paper: 0, olive: 0, ember: 0 };
for (const c of classes) {
  const olive = /\bol\b/.test(c);
  const ember = /\bem\b/.test(c);
  if (olive && ember) { console.error(`a slide asks for two grounds: "${c.trim()}"`); process.exit(1); }
  count[ember ? 'ember' : olive ? 'olive' : 'paper']++;
}
const total = classes.length;
const missing = Object.entries(count).filter(([, n]) => n === 0).map(([k]) => k);
if (missing.length) { console.error(`ground never used: ${missing.join(', ')}`); process.exit(1); }
const [top, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
if (n / total > 0.8) { console.error(`${top} carries ${n} of ${total} slides, too much for a rhythm`); process.exit(1); }
console.log(`GROUNDS_OK paper ${count.paper}, olive ${count.olive}, ember ${count.ember} of ${total}`);
