#!/usr/bin/env node
/**
 * Prove every line-art frame is a cut-out, not a rectangle.
 *
 * A frame whose ground was never keyed still writes a valid webp and still
 * looks right in a file listing; it only shows up as a visible box once it is
 * on a slide. This fails the frame instead, on two counts: the four corners
 * must be fully transparent, and at least a third of the whole frame must be,
 * which catches a drawing that keyed only its border.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = (await import('sharp')).default;
/**
 * The folder of frames to check. A path given on the command line wins, which is
 * how a deck checks its own `art/` copy; otherwise the project library, which
 * Renovyn keeps at `_r&d/decks/_art/line` and another project names once with
 * DECK_ART_DIR.
 */
const DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : process.env.DECK_ART_DIR
    ? path.join(path.resolve(process.env.DECK_ART_DIR), 'line')
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', '_r&d/decks/_art/line');

const files = (await readdir(DIR)).filter((f) => f.endsWith('.webp')).sort();
if (!files.length) {
  console.error('no frames found');
  process.exit(1);
}

const bad = [];
for (const file of files) {
  const img = sharp(path.join(DIR, file));
  const { width, height, channels } = await img.metadata();
  if (channels !== 4) {
    bad.push(`${file}: ${channels} channels, no alpha`);
    continue;
  }
  const raw = await img.ensureAlpha().raw().toBuffer();
  const at = (x, y) => raw[(y * width + x) * 4 + 3];
  const m = 6;
  const corners = [at(m, m), at(width - m, m), at(m, height - m), at(width - m, height - m)];
  if (corners.some((a) => a > 8)) {
    bad.push(`${file}: opaque corner (alpha ${corners.join(',')})`);
    continue;
  }
  let clear = 0;
  for (let i = 3; i < raw.length; i += 4) if (raw[i] < 8) clear++;
  const pct = clear / (width * height);
  if (pct < 0.33) bad.push(`${file}: only ${(pct * 100).toFixed(0)}% transparent`);
}

if (bad.length) {
  for (const line of bad) console.error(line);
  process.exit(1);
}
console.log(`ALPHA_OK ${files.length} frames`);
