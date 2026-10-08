#!/usr/bin/env node
/**
 * Prove every image a deck asks for is actually next to it.
 *
 * A deck is built in one folder and then sent as a folder, or rendered to PDF
 * from a copy. A missing frame does not throw: the browser draws nothing, the
 * PDF prints a blank column, and the slide still looks deliberate enough that
 * nobody notices until it is on someone else's screen.
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: check-deck-assets.mjs <deck.html>');
  process.exit(1);
}

const dir = path.dirname(path.resolve(file));
const html = await readFile(file, 'utf-8');

const srcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const local = srcs.filter((s) => !/^(https?:|data:)/.test(s));
const missing = [];
for (const src of new Set(local)) {
  try {
    await access(path.join(dir, src));
  } catch {
    missing.push(src);
  }
}

if (missing.length) {
  for (const src of missing) console.error(`missing: ${src}`);
  process.exit(1);
}
console.log(`ASSETS_OK ${new Set(local).size} images present`);
