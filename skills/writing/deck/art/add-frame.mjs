#!/usr/bin/env node
/**
 * Add a frame to the library and draw it, in one command.
 *
 * The library is a guide, not a rule. If nothing in it holds the idea a slide
 * is actually making, drawing a new frame is the right answer and forcing the
 * nearest existing one is the wrong one. A doorway standing in for a threshold
 * is reuse; a doorway standing in for a decision is a slide illustrated with
 * something it does not mean, and a reader feels that before they can name it.
 *
 *   node add-frame.mjs <id> "<subject>"
 *   node add-frame.mjs bands "six plain outlined slabs ..." --shape=landscape
 *   node add-frame.mjs circle "twelve chairs, {figure} seated on four" --tint=uk
 *   node add-frame.mjs thing "..." --no-draw        # register it, draw later
 *
 * Flags: --shape=square|landscape|portrait (default square)
 *        --busy      keep dimension arrows (default drops them)
 *        --tint=name write one extra repaint in that palette mode
 *        --seed=N    a different draw of the same subject
 *        --art=<dir> the library, if not the project default
 *
 * `{figure}` is substituted with the house figure so every person in the set is
 * drawn by the same hand.
 *
 * The subject is linted first, against three failures that each cost a redraw
 * of the whole batch when they were found the hard way. They are warnings, not
 * refusals: a subject can have a good reason to break one, and the point is
 * that nobody meets them by surprise.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback = null) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const has = (name) => args.includes(`--${name}`);

const positional = args.filter((a) => !a.startsWith('--'));
const [id, rawSubject] = positional;

if (!id || !rawSubject) {
  console.error('usage: add-frame.mjs <id> "<subject>" [--shape=square|landscape|portrait] [--busy] [--tint=name] [--seed=N]');
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error(`id must be lowercase kebab-case, got "${id}"`);
  process.exit(1);
}

const SHAPES = { square: 'SQUARE', landscape: 'LANDSCAPE', portrait: 'PORTRAIT' };
const shape = flag('shape', 'square');
if (!SHAPES[shape]) {
  console.error(`--shape must be one of ${Object.keys(SHAPES).join(', ')}`);
  process.exit(1);
}

// ─── the subject lint ───
// Each of these cost a redraw of every frame in a batch before it was written down.
const TRAPS = [
  [/\bon a (surface|desk|table|floor)\b/i,
   'the model fills the frame with that surface, and a light ground inverts the matte, so the frame ships as a solid rectangle. Say "floating with nothing behind them, surrounded by empty black".'],
  [/\bruled ground plane\b|\bgrid(ded)? (ground|floor|plane)\b/i,
   'a ruled plane cues an engineering drawing, so the model attaches pseudo-numerals along leader lines even with clean:true. Say "floating with nothing behind them" instead.'],
  [/\bdrawn in orange-red\b|\bfilled (with )?orange-red\b/i,
   'that gets a soft filled glow rather than a line, and a glow has no edge for the saturation matte to key, so it repaints as a smear. Say "outlined in orange-red".'],
  [/\b(text|label|lettering|words?|numbers?|title|caption)\b/i,
   'the style draws no lettering. Anything written has to be a real HTML element on the slide, not part of the drawing.'],
];

const subject = rawSubject.replace(/\{figure\}/g, '${FIGURE}');

let warned = false;
for (const [re, why] of TRAPS) {
  const hit = re.exec(rawSubject);
  if (!hit) continue;
  if (!warned) console.error('');
  console.error(`  warning: "${hit[0]}" — ${why}`);
  warned = true;
}
if (warned) console.error('');

const framesFile = path.join(HERE, 'deck-art-frames.mjs');
if (!existsSync(framesFile)) {
  console.error(`no deck-art-frames.mjs beside this script at ${HERE}`);
  process.exit(1);
}
let frames = await readFile(framesFile, 'utf-8');

if (new RegExp(`id:\\s*'${id}'`).test(frames)) {
  console.error(`"${id}" is already in the library. Pick another id, or redraw it with --only=${id} --force.`);
  process.exit(1);
}

const tint = flag('tint');
if (tint && !new RegExp(`\\b${tint}\\s*:`).test(frames.slice(0, frames.indexOf('export const FRAMES')))) {
  console.error(`warning: tint "${tint}" is not a mode in PAINT or palette.json, so no tinted file will be written`);
}

// wrap the subject at a sensible width, as string concatenation, matching the file
const words = subject.split(' ');
const lines = [];
let line = '';
for (const w of words) {
  if ((line + ' ' + w).trim().length > 86) { lines.push(line.trim()); line = w; }
  else line = `${line} ${w}`;
}
if (line.trim()) lines.push(line.trim());

const uses = subject.includes('${FIGURE}');
const quote = uses ? '`' : "'";
const body = lines
  .map((l, i) => `      ${i === 0 ? '' : '+ '}${quote}${l}${i < lines.length - 1 ? ' ' : ''}${quote}`)
  .join('\n');

const entry = `  {
    id: '${id}',
    size: ${SHAPES[shape]},
${has('busy') ? '' : '    clean: true,\n'}${tint ? `    tint: '${tint}',\n` : ''}    subject:
${body},
  },
];
`;

const anchor = '  },\n];\n';
if (!frames.includes(anchor)) {
  console.error('could not find the end of FRAMES to append to');
  process.exit(1);
}
frames = frames.replace(anchor, `  },\n${entry}`);
await writeFile(framesFile, frames);
console.log(`added "${id}" (${shape}${has('busy') ? '' : ', clean'}${tint ? `, tint ${tint}` : ''})`);

if (has('no-draw')) {
  console.log(`registered only. Draw it with: gen-deck-art.mjs --only=${id}`);
  process.exit(0);
}

const gen = path.join(HERE, 'gen-deck-art.mjs');
const alpha = path.join(HERE, 'check-art-alpha.mjs');
const passthrough = args.filter((a) => a.startsWith('--art=') || a.startsWith('--seed='));

try {
  execFileSync('node', [gen, `--only=${id}`, ...passthrough], { stdio: 'inherit' });
  execFileSync('node', [alpha, ...passthrough.filter((a) => a.startsWith('--art='))], { stdio: 'inherit' });
} catch {
  console.error(`\n"${id}" is registered but did not draw or did not pass the cut-out check.`);
  console.error(`Look at the file, then redraw with a different subject rather than a different seed:`);
  console.error(`  gen-deck-art.mjs --only=${id} --force`);
  process.exit(1);
}

console.log(`\nDrawn and checked. Copy it into the deck: cp <library>/line/${id}*.webp <deck>/art/`);
console.log('If it earns its place, put it back in ~/.claude/skills/deck/art/ so the next project inherits it.');
