#!/usr/bin/env node
/**
 * Catch text printing on top of other text.
 *
 * This is the fault nothing else here sees. A slide whose content is taller
 * than its stage does not clip and does not run off the paper: it runs into the
 * footer, and two paragraphs print in the same place. The safe-area check
 * passes, because the ink is nowhere near the margin. The source looks correct,
 * because it is correct, and only the height was wrong. Michael has now caught
 * this by eye twice, on two different slides, which is twice too many.
 *
 * So this reads the PDF's own text layer and its word boxes, and fails when two
 * words from different lines share space. Overlapping glyph boxes are not a
 * judgement call: no correct page has them.
 *
 * A small overlap is normal and expected: descenders cross the next line's
 * ascenders, and a unit set in its own span sits against its number. So a pair
 * only counts when it overlaps by more than OVERLAP of the smaller word's area,
 * which neighbouring words on a line and stacked lines never reach.
 *
 *   node check-deck-overlap.mjs <deck.pdf>
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

const pdf = process.argv[2];
if (!pdf) {
  console.error('usage: check-deck-overlap.mjs <deck.pdf>');
  process.exit(1);
}

// Two rules, because there are two ways a page goes wrong and one signal that
// tells them apart: whether the words sit on the same baseline.
const SAME_BASELINE = 5;   // points of baseline difference still counted as one line
const SIDE_BY_SIDE = 0.3;  // share of the narrower word's width, for that same line
const BURIED = 0.7;        // share of the smaller word's area, at any baseline

const dir = await mkdtemp(path.join(tmpdir(), 'overlap-'));
try {
  const out = path.join(dir, 'words.xml');
  await run('pdftotext', ['-bbox', pdf, out]);
  const xml = await readFile(out, 'utf-8');

  const pages = xml.split('<page').slice(1);
  const faults = [];

  pages.forEach((page, i) => {
    const words = [...page.matchAll(
      /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g,
    )].map((m) => ({
      x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], text: m[5],
    })).filter((w) => w.text.trim());

    for (let a = 0; a < words.length; a++) {
      for (let b = a + 1; b < words.length; b++) {
        const p = words[a];
        const q = words[b];
        // Words come out in reading order per block, not sorted down the page,
        // so there is no ordering to stop early on. A few hundred words a page
        // makes the full pairwise pass cheap enough not to be clever about.
        //
        // There is deliberately no "same baseline, so skip it" rule here. The
        // first version had one and it threw away the exact fault this exists
        // to find: when a paragraph overruns its stage it lands ON the footer,
        // at the same baseline, and the two sentences interleave. Words really
        // on the same line sit side by side and never overlap by area, so the
        // area threshold is the whole test.
        const w = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0);
        const h = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
        if (w <= 0 || h <= 0) continue;
        const narrower = Math.min(p.x1 - p.x0, q.x1 - q.x0);
        const smaller = Math.min((p.x1 - p.x0) * (p.y1 - p.y0), (q.x1 - q.x0) * (q.y1 - q.y0));
        if (smaller <= 0 || narrower <= 0) continue;

        // Two sentences interleaving on one baseline. This is the overrun: a
        // paragraph that outgrew its stage lands on the footer and the two
        // print through each other. Words genuinely on the same line sit side
        // by side and never share horizontal space at all.
        const interleaved =
          Math.abs(p.y1 - q.y1) < SAME_BASELINE && w / narrower > SIDE_BY_SIDE;

        // Or one word sitting almost entirely inside another, at any baseline.
        // The threshold is high on purpose: a small label above a large number
        // genuinely overlaps its box by about two fifths, and that is a correct
        // page, not a broken one.
        const buried = (w * h) / smaller > BURIED;

        if (!interleaved && !buried) continue;
        faults.push(`page ${i + 1}: "${p.text}" prints on top of "${q.text}"`);
        a = words.length; // one report per page is enough to send someone looking
        break;
      }
    }
  });

  if (faults.length) {
    for (const f of faults) console.error(f);
    console.error('\nA slide is taller than its stage. Content is running into the footer.');
    process.exit(1);
  }
  console.log(`OVERLAP_OK ${pages.length} pages, no text printed over other text`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
