#!/usr/bin/env node
/**
 * Keep engineering vocabulary out of a deck.
 *
 * Michael's note on 9 September: "Remove words like Binary, no tech jargon,
 * humanise everything." The decks had drifted into describing the software the
 * way the software describes itself. A clinical director does not read a
 * "binary", a "deterministic classifier" or a "research export"; they read an
 * app, a fixed rule, and the figures they take to a board.
 *
 * Two lists. The first is jargon that has no place on a slide at all. The
 * second is the puffery the house style bans anyway, checked here so a deck
 * cannot pick it up on a later edit.
 *
 * Only visible copy is read. CSS class names, HTML attributes and source
 * comments are none of a reader's business, and `<i>` is exempt because the
 * provider deck's appendix deliberately prints the software's own field names
 * beside their plain-English labels, which is the point of that slide.
 *
 *   node check-deck-plain.mjs <deck.html> [more.html ...]
 */
import { readFile } from 'node:fs/promises';

const JARGON = [
  'binary', 'schema', 'deterministic', 'classifier', 'metadata', 'codebase',
  'backend', 'API', 'boolean', 'null', 'append-only', 'appended', 'folded',
  'roll-ups', 'rollups', 'aggregation', 'identifier', 'identifiers',
  'instrumented', 'structurally', 'UTC', 'CSV', 'union', 'idempotent',
  'pipeline', 'console', 'repository', 'production', 'runtime', 'payload',
];
const PUFFERY = [
  'delve', 'leverage', 'pivotal', 'tapestry', 'seamless', 'robust',
  'groundbreaking', 'showcase', 'foster', 'realm', 'landscape', 'testament',
  'underscore', 'crucial', 'comprehensive', 'best-in-class', 'cutting-edge',
  'world-class', 'revolutionary',
];

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: check-deck-plain.mjs <deck.html> [more.html ...]');
  process.exit(1);
}

let faults = 0;
for (const file of files) {
  const html = await readFile(file, 'utf-8');
  const body = html.slice(html.indexOf('<body'));
  // One deck's jargon is another's trade language. "Pipeline" is engineering
  // talk in a product deck and plain sales English in a commission guide, so
  // the exception is declared in the deck that needs it:
  //   <meta name="deck-plain-ok" content="pipeline">
  const exempt = new Set(
    (/<meta name="deck-plain-ok" content="([^"]*)"/.exec(html)?.[1] ?? '')
      .split(',').map((w) => w.trim().toLowerCase()).filter(Boolean),
  );
  const text = body
    .replace(/<i>[^<]*<\/i>/g, ' ') // the appendix prints real field names on purpose
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ');

  for (const [label, words] of [['jargon', JARGON], ['puffery', PUFFERY]]) {
    for (const w of words) {
      if (exempt.has(w.toLowerCase())) continue;
      const hit = new RegExp(`\\b${w.replace('-', '[- ]')}\\b`, 'i').exec(text);
      if (!hit) continue;
      // "European Union" is a place, not a type
      if (/union/i.test(w) && /European\s+$/i.test(text.slice(0, hit.index))) continue;
      const at = Math.max(0, hit.index - 60);
      console.error(`${file}: ${label} "${hit[0]}" in "...${text.slice(at, hit.index + 60).replace(/\s+/g, ' ').trim()}..."`);
      faults++;
    }
  }
}

if (faults) process.exit(1);
console.log(`PLAIN_OK ${files.length} deck(s), no engineering vocabulary and no puffery`);
