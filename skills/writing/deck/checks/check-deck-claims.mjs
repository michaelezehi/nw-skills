#!/usr/bin/env node
/**
 * Keep the claims we are not allowed to make out of a deck.
 *
 * The August deck audit found six overclaims that contradicted decks already
 * sent to partners, so the list below is a hard stop rather than a style note.
 * Negation is the whole point though: "not a medical device" and "we publish no
 * risk score" are the sentences we want on the slide, and a plain grep for the
 * banned phrase fails exactly the deck that is behaving. So a hit only counts
 * when nothing negates it in the sentence it sits in.
 */
import { readFile } from 'node:fs/promises';

const BANNED = [
  /HIPAA/i,
  /regulatory licensing/i,
  /\bmedical device\b/i,
  /\bpredicts? relapse\b/i,
  /\bdetects? relapse\b/i,
  /\brisk score\b/i,
  /\bAI companion\b/i,
  /\baddicts\b/i,
  /\bMOU\b|\bletter of intent\b|\bLOI\b/i,
];

const NEGATION = /\b(not|no|never|without|neither|nor|do not|does not|cannot)\b/i;

const file = process.argv[2];
if (!file) {
  console.error('usage: check-deck-claims.mjs <deck.html>');
  process.exit(1);
}

const text = (await readFile(file, 'utf-8'))
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ');

const sentences = text.split(/(?<=[.!?])\s+/);
const hits = [];
for (const sentence of sentences) {
  for (const rule of BANNED) {
    if (!rule.test(sentence)) continue;
    const clause = sentence.slice(0, sentence.search(rule));
    if (NEGATION.test(clause)) continue; // "not a medical device" is the line we want
    hits.push(`${rule} in: "${sentence.trim().slice(0, 110)}"`);
  }
}

if (hits.length) {
  for (const hit of hits) console.error(hit);
  process.exit(1);
}
console.log('CLAIMS_OK no unnegated banned claim');
