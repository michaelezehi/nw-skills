#!/usr/bin/env node
/**
 * Draw the Renovyn line-art library used by decks, briefs and marketing pages.
 *
 * House style is a technical blueprint: thin outlined linework, exploded
 * isometric construction, dimension arrows and dashed centre lines, with one
 * accent marking the single thing the frame is about. No lettering, because
 * models render text as garbage and every label has to be translatable.
 *
 * The model draws white lines and an orange-red accent on solid black, which is
 * the combination it draws most cleanly. Nothing ships in those colours. Each
 * frame is separated into a matte and repainted twice in Renovyn's own palette:
 *
 *   <id>.webp          ink linework + sage accent, for light slides
 *   <id>-on-dark.webp  cream linework + light sage accent, for dark slides
 *
 * Both carry real alpha, so a frame sits on paper, on olive, on a photograph or
 * on a video still with no box around it and no CSS at the call site.
 *
 * Usage:
 *   node '_r&d/scripts/gen-deck-art.mjs' --list           # what already exists
 *   node '_r&d/scripts/gen-deck-art.mjs'                  # only missing frames
 *   node '_r&d/scripts/gen-deck-art.mjs' --force          # redraw everything
 *   node '_r&d/scripts/gen-deck-art.mjs' --only=cover,shield
 *   node '_r&d/scripts/gen-deck-art.mjs' --seed=11        # a different draw
 *   node '_r&d/scripts/gen-deck-art.mjs' --repaint        # recolour, no API call
 *   node '_r&d/scripts/gen-deck-art.mjs' --backend=openrouter
 *
 * Output: _r&d/decks/_art/line/
 */
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = (await import('sharp')).default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
/**
 * Where the library lives. Renovyn keeps it at `_r&d/decks/_art`, which stays
 * the default so nothing here changes. Another project installing this pipeline
 * puts it wherever its own layout wants and says so once, with DECK_ART_DIR or
 * `--art=<dir>`; the script itself has no opinion beyond the default.
 */
const artFlag = process.argv.find((a) => a.startsWith('--art='))?.slice(6);
const ART_DIR = artFlag
  ? path.resolve(artFlag)
  : process.env.DECK_ART_DIR
    ? path.resolve(process.env.DECK_ART_DIR)
    : path.join(REPO_ROOT, '_r&d/decks/_art');
const OUT_DIR = path.join(ART_DIR, 'line');

const FAL_MODEL = 'fal-ai/flux/dev';
const OPENROUTER_MODEL = 'google/gemini-3.1-flash-image';
const WEBP_QUALITY = 90;

import {
  FRAMES,
  NEGATIVE,
  STYLE,
  STYLE_CLEAN,
  loadPalette,
} from './deck-art-frames.mjs';

/** Set once in main(), so a project palette reaches repaint() without threading. */
let PAINT = loadPalette(ART_DIR).paint;

function parseArgs(argv) {
  const args = { force: false, only: null, seed: 5, repaint: false, backend: 'fal', list: false };
  for (const arg of argv) {
    if (arg === '--list') args.list = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--repaint') args.repaint = true;
    else if (arg.startsWith('--only=')) args.only = arg.slice(7).split(',').map((s) => s.trim());
    else if (arg.startsWith('--seed=')) args.seed = Number(arg.slice(7));
    else if (arg.startsWith('--backend=')) args.backend = arg.slice(10);
  }
  return args;
}

/**
 * Separate the drawing from its ground and repaint it in one Renovyn colour pair.
 *
 * Two masks come out of the raw pixels. Luminance carries the white linework, so
 * it becomes the alpha for those pixels; a steep lift crushes the near-black
 * ground (the model draws it at RGB 5 to 7, and it carries a soft vignette that
 * a gentle curve leaves behind as a visible veil) down to zero. Saturation
 * carries the accent, and it needs its own alpha term: orange-red sits at a
 * luminance of about 99, so a luminance-only matte would ship the accent lines
 * at 40 percent opacity and they would read as a smudge.
 *
 * Colour is then discarded entirely. Every pixel is repainted as line or accent,
 * which is what makes one generated frame serve a light slide and a dark one.
 */
async function repaint(buffer, mode) {
  const { width, height } = await sharp(buffer).metadata();
  const rgb = await sharp(buffer).removeAlpha().raw().toBuffer();
  const { line, accent } = PAINT[mode];
  const out = Buffer.alloc(width * height * 4);

  // Which way round is this drawing? Asked for black, the model sometimes
  // returns the same blueprint on white, and a luminance matte then keys out
  // the *linework* and keeps the ground, shipping a solid rectangle that looks
  // fine in a file listing and ruins the slide. The four corners settle it.
  const corner = (x, y) => {
    const i = (y * width + x) * 3;
    return 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
  };
  const m = 8;
  const groundLum =
    (corner(m, m) + corner(width - m, m) + corner(m, height - m) + corner(width - m, height - m)) / 4;
  const inverted = groundLum > 127;

  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const rawLum = 0.299 * r + 0.587 * g + 0.114 * b;
    const lum = inverted ? 255 - rawLum : rawLum;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);

    const lumAlpha = Math.min(255, Math.max(0, lum * 1.35 - 28));
    const satAlpha = Math.min(255, Math.max(0, sat * 1.6 - 20));
    const alpha = Math.max(lumAlpha, satAlpha);

    const paint = sat > 42 ? accent : line;
    out[o] = paint[0];
    out[o + 1] = paint[1];
    out[o + 2] = paint[2];
    out[o + 3] = Math.round(alpha);
  }

  return sharp(out, { raw: { width, height, channels: 4 } });
}

/** Env file to key. Nothing here is ever written back to disk. */
function readKey(names, files) {
  for (const name of names) {
    const direct = process.env[name];
    if (direct && direct.length > 8 && !direct.startsWith('your')) return direct;
  }
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const name of names) {
      const match = readFileSync(file, 'utf-8').match(
        new RegExp(`^${name}\\s*=\\s*["']?([^"'\\n\\r]+)`, 'm'),
      );
      const key = match?.[1]?.trim();
      if (key && key.length > 8 && !key.startsWith('your')) return key;
    }
  }
  return null;
}

async function callFal(apiKey, prompt, size, seed) {
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE,
      num_images: 1,
      enable_safety_checker: true,
      image_size: size,
      num_inference_steps: 40,
      guidance_scale: 3.2,
      seed,
    }),
  });
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.ai returned no image URL');
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function callOpenRouter(apiKey, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      modalities: ['image', 'text'],
    }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('openrouter returned no image');
  return Buffer.from(url.split(',', 2)[1], 'base64');
}

/**
 * The model centres its drawing in a lot of empty canvas, and once the ground is
 * transparent that emptiness is still layout: a frame set to 480px wide spends
 * a third of it on nothing and the drawing reads as an afterthought beside the
 * copy. Trimming to the ink means the width in the slide is the width of the
 * drawing. A small pad keeps antialiased edges off the crop line.
 */
async function writeVariants(raw, id, tint) {
  const variants = [
    ['light', ''],
    ['dark', '-on-dark'],
    ['ember', '-on-ember'],
  ];
  if (tint) variants.push([tint, `-${tint}`]);
  for (const [mode, suffix] of variants) {
    const painted = await repaint(raw, mode);
    const trimmed = await painted
      .png()
      .toBuffer()
      .then((buf) => sharp(buf).trim({ threshold: 6 }).toBuffer({ resolveWithObject: true }))
      .catch(() => null);

    const base = trimmed
      ? sharp(trimmed.data).extend({
          top: 8,
          bottom: 8,
          left: 8,
          right: 8,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
      : painted;

    await base
      .webp({ quality: WEBP_QUALITY, effort: 5, alphaQuality: 100 })
      .toFile(path.join(OUT_DIR, `${id}${suffix}.webp`));
  }
}

async function main() {
  const { force, only, seed, repaint: repaintOnly, backend, list } = parseArgs(process.argv.slice(2));

  const palette = loadPalette(ART_DIR);
  PAINT = palette.paint;

  // Look before you draw. A deck that needs a picture of a doorway should find
  // `discharge` rather than commission a second doorway in a slightly different
  // hand, which is how a library stops reading as one hand.
  if (list) {
    console.log(`palette: ${palette.source}\n`);
    for (const frame of FRAMES) {
      const shape =
        frame.size.width > frame.size.height
          ? 'landscape'
          : frame.size.width < frame.size.height
            ? 'portrait'
            : 'square';
      const tint = frame.tint ? `, ${frame.tint} tint` : '';
      const subject = frame.subject.replace(/\s+/g, ' ').slice(0, 96);
      console.log(`${frame.id.padEnd(15)} ${shape}${tint}\n${' '.repeat(16)}${subject}...`);
    }
    console.log(`\n${FRAMES.length} frames in the library`);
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const frames = only ? FRAMES.filter((f) => only.includes(f.id)) : FRAMES;
  if (!frames.length) {
    console.error(`No frames matched --only=${only?.join(',')}`);
    process.exit(1);
  }

  const RAW_DIR = path.join(OUT_DIR, '.raw');
  await fs.mkdir(RAW_DIR, { recursive: true });

  // Repaint from the kept originals, so a palette change costs nothing.
  if (repaintOnly) {
    for (const frame of frames) {
      const src = path.join(RAW_DIR, `${frame.id}.png`);
      if (!existsSync(src)) {
        console.log(`- ${frame.id}: no original kept, skipped`);
        continue;
      }
      await writeVariants(await fs.readFile(src), frame.id, frame.tint);
      console.log(`- ${frame.id}: repainted`);
    }
    return;
  }

  const falKey = readKey(
    ['FAL_KEY', 'FAL_API_KEY'],
    [
      path.join(REPO_ROOT, '.env'),
      path.join(REPO_ROOT, '.env.local'),
      path.resolve(REPO_ROOT, '../x-unframed/apps/api/.env'),
    ],
  );
  const orKey = readKey(
    ['OPENROUTER_API_KEY'],
    [path.join(REPO_ROOT, '.env'), path.join(REPO_ROOT, '.env.local')],
  );

  const useFal = backend === 'fal' && falKey;
  if (!useFal && !orKey) {
    console.error('No image key found (FAL_API_KEY or OPENROUTER_API_KEY)');
    process.exit(1);
  }
  console.log(`backend: ${useFal ? 'fal.ai flux/dev' : 'openrouter ' + OPENROUTER_MODEL}\n`);

  for (const [i, frame] of frames.entries()) {
    const out = path.join(OUT_DIR, `${frame.id}.webp`);
    if (!force && existsSync(out)) {
      console.log(`- ${frame.id}: exists, skipped`);
      continue;
    }

    const prompt = `${frame.subject}. ${frame.clean ? STYLE_CLEAN : STYLE}.`;
    process.stdout.write(`- ${frame.id}: drawing... `);
    const raw = useFal
      ? await callFal(falKey, prompt, frame.size, seed + i)
      : await callOpenRouter(orKey, prompt);

    await fs.writeFile(path.join(RAW_DIR, `${frame.id}.png`), raw);
    await writeVariants(raw, frame.id, frame.tint);
    console.log('ok');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
