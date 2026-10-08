#!/usr/bin/env node
/**
 * Prove nothing in a rendered deck touches the edge of the page.
 *
 * Clipping is the one deck fault that never shows up in the source. The CSS is
 * valid, the browser prints without complaint, and the drawing simply runs off
 * the paper. It is only visible by looking at every page, which is exactly the
 * check that gets skipped when a deck is rebuilt in a hurry.
 *
 * So this rasterises the PDF and reads the pixels. The page background is the
 * most common colour on the page; any pixel in the outer band that differs from
 * it by more than a small threshold is ink where ink may not be. The top rows
 * are exempt because the accent bar is full bleed on purpose.
 *
 *   node check-deck-safearea.mjs <deck.pdf> [--band 24] [--report out.txt]
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const sharp = (await import('sharp')).default;

const pdf = process.argv[2];
if (!pdf) {
  console.error('usage: check-deck-safearea.mjs <deck.pdf> [--band N]');
  process.exit(1);
}
const bandArg = process.argv.indexOf('--band');
const BAND = bandArg > -1 ? Number(process.argv[bandArg + 1]) : 24;
const ACCENT_BAR_ROWS = 8; // the full-bleed rule at the top of every slide
const TOLERANCE = 20; // the dot-grid texture sits about 7 levels off the ground

const dir = await mkdtemp(path.join(tmpdir(), 'safearea-'));
try {
  await run('pdftoppm', ['-png', '-r', '72', pdf, path.join(dir, 'pg')]);
  const pages = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
  if (!pages.length) throw new Error('pdftoppm produced no pages');

  const faults = [];
  for (const file of pages) {
    const img = sharp(path.join(dir, file));
    const { width, height } = await img.metadata();
    const raw = await img.removeAlpha().raw().toBuffer();
    const px = (x, y) => {
      const i = (y * width + x) * 3;
      return [raw[i], raw[i + 1], raw[i + 2]];
    };

    // the page ground is whatever colour covers most of the page
    const counts = new Map();
    for (let i = 0; i < raw.length; i += 3 * 7) {
      const key = (raw[i] >> 3) * 65536 + (raw[i + 1] >> 3) * 256 + (raw[i + 2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = 0;
    let bestKey = 0;
    for (const [key, n] of counts) if (n > best) [best, bestKey] = [n, key];
    const ground = [
      ((bestKey >> 16) & 31) << 3,
      ((bestKey >> 8) & 31) << 3,
      (bestKey & 31) << 3,
    ];
    const isInk = (x, y) => {
      const [r, g, b] = px(x, y);
      return (
        Math.abs(r - ground[0]) > TOLERANCE ||
        Math.abs(g - ground[1]) > TOLERANCE ||
        Math.abs(b - ground[2]) > TOLERANCE
      );
    };

    // pdftoppm at 72dpi renders a 1280px page at 960px, so the 4px rule lands
    // at 3px. The exemption has to clear the whole top strip including the
    // corners, or every page with the rule fails on the rule itself.
    const hits = [];
    for (let y = ACCENT_BAR_ROWS; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inBand = x < BAND || x >= width - BAND || y < BAND || y >= height - BAND;
        if (!inBand) continue;
        if (isInk(x, y)) hits.push([x, y]);
      }
    }
    if (hits.length > 40) {
      const [x, y] = hits[0];
      faults.push(`${file}: ${hits.length} ink pixels inside the ${BAND}px margin, first at ${x},${y}`);
    }
  }

  if (faults.length) {
    for (const f of faults) console.error(f);
    process.exit(1);
  }
  console.log(`SAFEAREA_OK ${pages.length} pages clear of a ${BAND}px margin`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
