#!/usr/bin/env node
/**
 * Prove the on-screen page chrome never reaches the printed deck.
 *
 * A download button is for the person reading the HTML. If it survives into the
 * print stylesheet it lands on page one of the PDF that goes to an investor,
 * and nobody notices until it is sent. So every element outside `.deck` has to
 * be hidden inside the print media query.
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: check-deck-chrome.mjs <deck.html>'); process.exit(1); }
const html = await readFile(file, 'utf-8');

// Only what sits outside the deck container is chrome. Everything inside it is
// a slide, and slides are the thing being printed.
const body = html.slice(html.indexOf('<body>'));
const outside =
  body.slice(0, body.indexOf('<div class="deck">')) +
  body.slice(body.lastIndexOf('</section>'));
// Containers only. Hiding the container hides what is inside it, so checking
// every child class as well would just demand redundant rules.
const chrome = [...outside.matchAll(/<(?:div|nav|header|aside)\s+class="([a-z-]+)"/g)].map(
  (m) => m[1],
);

const print = html.match(/@media print\s*\{([\s\S]*?)\n\}/);
if (!print) { console.error('no @media print block'); process.exit(1); }

const faults = [];
for (const cls of new Set(chrome)) {
  if (!new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*display:\\s*none`).test(print[1])) {
    faults.push(`.${cls} is page chrome but the print block never hides it`);
  }
}

if (faults.length) { for (const f of faults) console.error(f); process.exit(1); }
console.log(`CHROME_OK ${new Set(chrome).size} chrome element(s), all hidden in print`);
