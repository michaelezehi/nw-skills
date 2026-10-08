#!/usr/bin/env node
/**
 * Install the deck art pipeline and the deck checkers into a project.
 *
 * The point of this is that a second project gets the SAME thirty drawings, in
 * its own colours, without spending a single API call. Every frame was drawn
 * white-on-black once and the originals are kept; colour is applied afterwards
 * by repainting those originals. So installing is a copy plus a palette plus a
 * repaint, and the result is one hand across every project rather than thirty
 * new drawings that almost match.
 *
 *   node ~/.claude/skills/deck/scripts/install-art.mjs           # into cwd
 *   node ~/.claude/skills/deck/scripts/install-art.mjs <dir>     # into a project
 *   node ~/.claude/skills/deck/scripts/install-art.mjs --at=docs/decks
 *   node ~/.claude/skills/deck/scripts/install-art.mjs --fresh   # draw its own
 *
 * `--fresh` installs the pipeline and the subject list but none of the drawings,
 * for a project whose ideas are its own. It then draws all thirty from scratch,
 * which costs thirty API calls and gives a library nobody else has. The default
 * inherits the drawings and repaints them, which costs nothing. Both are
 * reasonable; the library is a starting point, not a house rule.
 *
 * It writes:
 *   <project>/<at>/_art/line/.raw/   the thirty originals
 *   <project>/<at>/_art/palette.json the project's ink and accent, to edit
 *   <project>/<at>/_scripts/         the art pipeline and the deck checkers
 *
 * It never overwrites a palette that already exists, because that file is the
 * one thing here a person actually wrote.
 */
import { cp, mkdir, readdir, writeFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const atFlag = args.find((a) => a.startsWith('--at='))?.slice(5);
const target = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const AT = atFlag ?? '_r&d/decks';

if (!existsSync(target)) {
  console.error(`no such directory: ${target}`);
  process.exit(1);
}

const artDir = path.join(target, AT, '_art');
const scriptDir = path.join(target, AT.split('/')[0], 'scripts');

await mkdir(path.join(artDir, 'line', '.raw'), { recursive: true });
await mkdir(scriptDir, { recursive: true });

// the originals, which are the whole reason the default costs nothing. --fresh
// skips them so the project draws its own rather than repainting ours.
const fresh = args.includes('--fresh');
const raws = fresh ? [] : await readdir(path.join(SKILL, 'art/line/.raw'));
for (const f of raws) {
  await cp(path.join(SKILL, 'art/line/.raw', f), path.join(artDir, 'line/.raw', f));
}

for (const f of ['gen-deck-art.mjs', 'deck-art-frames.mjs', 'check-art-alpha.mjs', 'add-frame.mjs']) {
  await cp(path.join(SKILL, 'art', f), path.join(scriptDir, f));
}
await cp(path.join(SKILL, 'art/README.md'), path.join(artDir, 'README.md'));

const checks = await readdir(path.join(SKILL, 'checks'));
for (const f of checks) await cp(path.join(SKILL, 'checks', f), path.join(scriptDir, f));

// the palette is the only file a person edits, so it is never overwritten
const palette = path.join(artDir, 'palette.json');
let wrotePalette = false;
try {
  await access(palette);
} catch {
  await writeFile(palette, `${JSON.stringify({
    light: { line: [23, 35, 28], accent: [90, 125, 95] },
    dark: { line: [241, 239, 231], accent: [159, 194, 164] },
  }, null, 2)}\n`);
  wrotePalette = true;
}

const rel = (p) => path.relative(target, p);
console.log(`INSTALL_OK ${fresh ? 'no' : raws.length} drawings and ${checks.length + 4} scripts`);
console.log(`  art     ${rel(artDir)}`);
console.log(`  scripts ${rel(scriptDir)}`);
console.log(`  palette ${rel(palette)}${wrotePalette ? ' (written, edit it)' : ' (kept, already yours)'}`);
const gen = rel(path.join(scriptDir, 'gen-deck-art.mjs'));
const add = rel(path.join(scriptDir, 'add-frame.mjs'));
console.log('');
console.log('Next, from the project root:');
console.log(`  1. edit ${rel(palette)} to this project's ink and accent`);
if (fresh) {
  console.log(`  2. node '${gen}'          # draws all thirty. Thirty API calls.`);
  console.log('     Edit FRAMES in deck-art-frames.mjs first if the subjects should be');
  console.log("     this project's own rather than the ones shipped.");
} else {
  console.log(`  2. node '${gen}' --repaint   # recolours all thirty. No API call.`);
}
console.log(`  3. node '${rel(path.join(scriptDir, 'check-art-alpha.mjs'))}'`);
console.log('');
console.log('The library is a guide, not a rule. When a slide means something none of');
console.log('these drawings holds, draw the new one rather than force the nearest fit:');
console.log(`  node '${add}' <id> "<subject>" --shape=landscape`);
