#!/usr/bin/env node
/**
 * No accent rails anywhere in the deck.
 *
 * A coloured bar down the side of a callout, or across the top of a slide or a
 * column, is the house's standing objection: it decorates a group that
 * proximity and a hairline already define, and it dates the whole page. Flat
 * tinted blocks and hairline rows do the same job without the costume.
 *
 * A 1px neutral hairline is a divider and stays. Anything 2px or thicker, or
 * any rule painted in an accent token, is a rail.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-rails.mjs <deck.html>'); process.exit(1); }
const html = await readFile(file, 'utf-8');
const faults = [];

// any border 2px or thicker on a side, in CSS or inline
for (const m of html.matchAll(/border(?:-(?:top|left|right|bottom))?:\s*([2-9]|\d\d+)px[^;}"']*/g)) {
  faults.push(`thick rule: ${m[0].slice(0, 60)}`);
}
// any 1px rule painted in an accent rather than a neutral rule token
for (const m of html.matchAll(/border-(?:top|left|right):\s*1px\s+solid\s+var\(--accent[^)]*\)/g)) {
  faults.push(`accent-coloured rule: ${m[0]}`);
}
// the full-bleed bar across the top of a slide
if (/\.slide::before\s*\{[^}]*height:\s*\d+px/.test(html)) {
  faults.push('slide::before paints a full-bleed bar across the top of every slide');
}

if (faults.length) { for (const f of faults) console.error(f); process.exit(1); }
console.log('RAILS_OK no accent rails, hairlines only');
