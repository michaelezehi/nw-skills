#!/usr/bin/env node
/**
 * The deck's declared text colours clear WCAG against the ground they sit on.
 *
 * A new ground is where contrast quietly fails: the colour is picked because it
 * looks right against the headline, and the secondary text underneath it is
 * never measured. Body text needs 4.5:1 and large text 3:1, so every token pair
 * the stylesheet declares is checked rather than eyeballed.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-contrast.mjs <deck.html>'); process.exit(1); }
const css = await readFile(file, 'utf-8');

const tok = (name) => {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
const lum = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [ground, text, minimum, what it is]
const PAIRS = [
  ['ember', 'on-ember', 4.5, 'ember body'],
  ['ember', 'on-ember-2', 4.5, 'ember secondary'],
  ['ember', 'accent-ember', 3.0, 'ember accent'],
  ['sage-deep', 'on-olive', 4.5, 'sage body'],
  ['sage-deep', 'accent-olive', 3.0, 'sage accent'],
  ['olive', 'on-olive', 4.5, 'olive body'],
  ['olive', 'on-olive-2', 4.5, 'olive secondary'],
  ['olive', 'accent-olive', 3.0, 'olive accent'],
  ['paper', 'ink', 4.5, 'paper body'],
  ['paper', 'ink-2', 4.5, 'paper secondary'],
  ['paper', 'stone', 4.5, 'paper tertiary'],
  ['paper', 'accent-deep', 3.0, 'paper accent'],
];

const fails = [];
const lines = [];
for (const [bg, fg, min, label] of PAIRS) {
  const r = ratio(tok(bg), tok(fg));
  lines.push(`${label} ${r.toFixed(2)}:1`);
  if (r < min) fails.push(`${label} is ${r.toFixed(2)}:1, needs ${min}:1 (${tok(fg)} on ${tok(bg)})`);
}
if (fails.length) { for (const f of fails) console.error(f); process.exit(1); }
console.log(`CONTRAST_OK ${lines.join(', ')}`);
