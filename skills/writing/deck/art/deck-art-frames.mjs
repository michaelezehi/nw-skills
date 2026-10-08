/**
 * What the Renovyn line-art library draws, and what colour it ships in.
 *
 * Split out of gen-deck-art.mjs so the pipeline and the subjects can be read
 * separately: this file is the only one that changes when a deck needs a frame
 * it does not have, and the generator never needs opening to add one.
 *
 * A project that is not Renovyn overrides the palette by dropping a
 * `palette.json` beside the library, shaped like PAINT below. Nothing else has
 * to change, because every frame is drawn white on black and repainted.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Renovyn palette. Generation colours are never these; repaint is. */
export const PAINT = {
  light: { line: [23, 35, 28], accent: [90, 125, 95] },
  dark: { line: [241, 239, 231], accent: [159, 194, 164] },
  // The brand's orange-red ground. Warm cream linework rather than the olive
  // set's cool cream, and an amber accent, because a sage accent on ember goes
  // muddy where an amber one glows the way the raw generation does.
  ember: { line: [252, 240, 231], accent: [255, 196, 107] },
  // The three region tints used by the market slides. A frame with `tint` set
  // writes one extra file in that pair, so the three regions sit side by side
  // on the same paper ground and read as three places rather than three copies
  // of one drawing. Line and accent are close together on purpose: the colour
  // is carrying the region, so the accent must not fight it.
  uk: { line: [56, 84, 61], accent: [123, 156, 128] },
  europe: { line: [176, 53, 24], accent: [214, 118, 70] },
  world: { line: [22, 33, 26], accent: [90, 125, 95] },
};

/** Shared look. Every prompt is this plus one subject. */
export const STYLE = [
  'technical blueprint line illustration on a pure solid black background,',
  'thin precise white 1px linework, exploded isometric construction drawing,',
  'engineering dimension arrows, dashed centre lines, small tick marks and leader lines,',
  'a few accents in luminous orange-red (#E5301B) marking the key element only,',
  'unfilled outlines only, no solid fills, no glow, no bloom, no neon,',
  'flat, no shading, no gradients, no photorealism, generous negative space,',
  'clean patent-diagram aesthetic, centred composition,',
  'completely free of any lettering, annotation text, numerals or dimension figures',
].join(' ');

/**
 * The same world without the annotation furniture.
 *
 * Dimension arrows are where the model invents lettering: it has seen a
 * million engineering drawings with figures on every leader line, so it draws
 * figure-shaped marks whatever the prompt says. At thumbnail size those read
 * as texture. On a frame that fills half a slide they read as broken text, and
 * that is exactly what got flagged on the ask slide. Frames marked `clean` in
 * FRAMES drop the arrows and keep the construction.
 */
export const STYLE_CLEAN = [
  'technical blueprint line illustration on a pure solid black background,',
  'thin precise white 1px linework, exploded isometric construction drawing,',
  'dashed centre lines and plain unlabelled leader lines,',
  'absolutely no numbers, no dimension figures, no annotation of any kind,',
  'a few accents in luminous orange-red (#E5301B) marking the key element only,',
  'unfilled outlines only, no solid fills, no glow, no bloom, no neon,',
  'flat, no shading, no gradients, no photorealism, generous negative space,',
  'clean patent-diagram aesthetic, centred composition,',
  'the drawing must be completely free of any lettering, text, symbols or numerals',
].join(' ');

export const NEGATIVE = [
  'text, letters, numbers, numerals, digits, words, labels, captions, annotation,',
  'dimension figures, measurement text, handwriting, watermark, signature, logo,',
  'photograph, photorealistic, colour photo, skin texture, face detail,',
  'busy background, clutter, noise, gradient background, white background,',
  'blurry, low resolution, 3d render, plastic, glossy',
].join(' ');

export const SQUARE = { width: 1024, height: 1024 };
export const PORTRAIT = { width: 832, height: 1216 };
export const LANDSCAPE = { width: 1216, height: 832 };

/** A figure is always the same drawing, so the set reads as one hand. */
export const FIGURE =
  'a human figure drawn as a smooth continuous contour outline with no facial features';

export const FRAMES = [
  {
    id: 'cover',
    size: PORTRAIT,
    subject:
      `${FIGURE} standing at the base of a tall exploded isometric stack of thin floating ` +
      'rounded rectangular phone screens receding upward in perspective, connected by dashed ' +
      'vertical alignment lines, the lowest screen outlined in orange-red, dimension arrows down both sides',
  },
  {
    id: 'discharge',
    size: SQUARE,
    subject:
      'a large outlined isometric doorway standing alone on a ruled ground plane, ' +
      `${FIGURE} walking away from it along a long dashed path that continues past the frame, ` +
      'the empty ground beyond the doorway marked with an orange-red dimension arrow measuring the gap',
  },
  {
    id: 'ninety-days',
    size: SQUARE,
    subject:
      'a steep descending curve as the single dominant element, plunging from the top left down to ' +
      'the bottom right of the frame, drawn in orange-red, plotted over a faint isometric grid plane ' +
      'ruled with fine tick marks, two tall dashed vertical guides bracketing the steepest part of ' +
      `the fall, ${FIGURE} standing small at the top of the curve where it begins`,
  },
  {
    id: 'two-people',
    size: LANDSCAPE,
    subject:
      `two figures, each ${FIGURE}, standing apart on separate small isometric platforms, ` +
      'joined by a long dashed connector line with small outlined nodes along it, ' +
      'one node drawn in orange-red, dimension arrows measuring the distance between the platforms',
  },
  {
    id: 'phone-layers',
    size: PORTRAIT,
    subject:
      'a single outlined smartphone shown in exploded isometric view, its screen separated into ' +
      'five thin floating layers stacked above the body, each layer a plain outlined rectangle with ' +
      'small slot windows, dashed alignment lines through all layers, the middle layer in orange-red',
  },
  {
    id: 'shield',
    size: SQUARE,
    subject:
      `${FIGURE} standing at the centre of seven concentric outlined isometric plates that ` +
      'surround the figure like nested shells, each plate perforated with small circular ports, ' +
      'the outermost plate drawn in orange-red, radial dimension arrows measuring each shell',
  },
  {
    id: 'voice',
    size: SQUARE,
    subject:
      `${FIGURE} seated on a low outlined isometric block, a thin symmetrical waveform arc of ` +
      'vertical tick lines rising from beside the figure and curving overhead, ' +
      'the tallest ticks drawn in orange-red, dashed guide lines framing the arc',
  },
  {
    id: 'pathway',
    size: SQUARE,
    subject:
      'a stepped isometric path of thin outlined platforms ascending from left to right, ' +
      'each step separated by dashed risers and marked with a small outlined circle, ' +
      `one circle drawn in orange-red, ${FIGURE} climbing the third step, dimension arrows along the rise`,
  },
  {
    id: 'console',
    size: LANDSCAPE,
    subject:
      'a wide outlined isometric desk console panel ruled into a grid of thin rectangular member ' +
      'cards, three cards drawn in orange-red outline, a stack of floating cards lifting off the ' +
      `panel on dashed lines, ${FIGURE} standing beside the panel looking at it`,
  },
  {
    id: 'cohort',
    size: LANDSCAPE,
    subject:
      'an isometric ground plane ruled into a grid of thin outlined slots, twelve figures each ' +
      `${FIGURE} standing in the slots, four of the figures and their slots drawn in orange-red, ` +
      'long dashed paths running from the grid toward a small outlined tray at the right edge',
  },
  {
    id: 'two-routes',
    size: LANDSCAPE,
    subject:
      'a wide letter Y laid flat in isometric perspective as two separate raised roadways meeting at ' +
      'one outlined platform in the centre right of the frame, the upper roadway carrying a single ' +
      `file line of six small figures each ${FIGURE}, the lower roadway carrying one plain outlined ` +
      'isometric office building, a large orange-red arrow running along each roadway toward the ' +
      'meeting platform, dimension arrows measuring the width of both roadways',
  },
  {
    id: 'growth',
    size: LANDSCAPE,
    subject:
      'a row of seven thin outlined vertical bars of increasing height standing on an isometric base ' +
      'plane, ascending steeply from left to right, the tallest bar on the right drawn in orange-red, ' +
      'a dashed projection line continuing the rise up past the top right corner of the frame, ' +
      'dimension arrows measuring the height of the first and last bar',
  },
  {
    id: 'retreat',
    size: LANDSCAPE,
    subject:
      'a low outlined isometric villa terrace with a flat roof and open colonnade standing on a ' +
      'ruled coastal ledge, a single outlined olive tree beside it, three small figures each ' +
      `${FIGURE} seated in a circle on the terrace, the circle drawn in orange-red, ` +
      'dashed contour lines describing the slope down to a ruled sea plane',
  },
  {
    id: 'map',
    clean: true,
    size: LANDSCAPE,
    subject:
      'a plain outlined isometric plane holding a simplified continental coastline drawn as thin ' +
      'contour lines, four tall outlined pin markers standing on it, the leftmost pin in orange-red, ' +
      'long dashed arcs connecting the pins in sequence, dimension arrows across the plane edge',
  },
  {
    id: 'evidence',
    clean: true,
    size: PORTRAIT,
    subject:
      'a tall exploded stack of four plain outlined rectangular trays floating one above another in ' +
      'isometric view, no grid and no perforation, a fifth tray sliding out sideways from the bottom ' +
      'of the stack and drawn in orange-red, a single dashed vertical axis through the centre',
  },
  {
    id: 'team',
    size: LANDSCAPE,
    subject:
      `three figures each ${FIGURE} standing on three separate thin outlined isometric platforms ` +
      'at different heights, joined by dashed connector lines forming a triangle, ' +
      'the central connector drawn in orange-red, dimension arrows measuring the height of each platform',
  },
  {
    id: 'ask',
    size: LANDSCAPE,
    clean: true,
    subject:
      'three thin outlined isometric platforms standing in a row and rising in height from left ' +
      'to right, one plain orange-red arrow curving up over all three from the low end to the high ' +
      'end, a single outlined cube resting on the tallest platform, dashed vertical guides dropping ' +
      'from each platform to a plain ground plane',
  },
  {
    id: 'appendix',
    size: LANDSCAPE,
    clean: true,
    subject:
      'a wide shallow open tray seen in isometric view holding a long row of thin upright index ' +
      'cards standing on edge like files, one card near the middle taller than the rest and lifted ' +
      'clear of the row, that card drawn in orange-red, the tray drawn as plain unmeasured outlines',
  },
  {
    id: 'compare',
    size: LANDSCAPE,
    clean: true,
    subject:
      'four thin outlined isometric platforms standing apart in a row, the three on the left low and ' +
      'plain, the one on the right taller and drawn in orange-red with a small outlined cube on top ' +
      'of it, a wide dashed bracket spanning the empty gap between the low three and the tall one',
  },
  {
    id: 'risks',
    size: LANDSCAPE,
    clean: true,
    subject:
      `${FIGURE} walking across a long thin outlined beam that spans a gap between two isometric ` +
      'ledges, the far ledge drawn in orange-red, dashed guide lines dropping from the beam into ' +
      'the empty space below it',
  },
  {
    id: 'sources',
    size: SQUARE,
    clean: true,
    subject:
      'five separate sheets of paper overlapping in a loose fan, floating in empty space with ' +
      'nothing behind them, each sheet a simple outlined rectangle with a few plain horizontal ' +
      'rules across it, the front sheet drawn in orange-red, one plain circular magnifier outline ' +
      'with a straight handle resting across the fan, surrounded by empty black'
  },
  {
    id: 'roadmap',
    size: LANDSCAPE,
    clean: true,
    subject:
      'three outlined isometric milestone blocks standing in a row on a long ruled ground plane and ' +
      'growing in size from left to right, a small flag on top of each block, the third block and ' +
      'its flag drawn in orange-red, one continuous dashed path running along the ground from the ' +
      'first block past the third and off the right edge',
  },
  {
    id: 'gambling',
    size: LANDSCAPE,
    clean: true,
    subject:
      'a single outlined smartphone lying flat in isometric view on a plain ground plane, a row of ' +
      'seven thin outlined vertical bars of increasing height standing up out of its screen and ' +
      'ascending steeply from left to right, the tallest bar on the right drawn in orange-red, a ' +
      'dashed projection line continuing the rise up past the top right corner of the frame',
  },
  {
    id: 'market',
    size: LANDSCAPE,
    clean: true,
    subject:
      'three concentric outlined isometric rectangular plates lying flat one inside another on a ' +
      'ruled ground plane, each plate smaller than the one around it, the smallest innermost plate ' +
      'drawn in orange-red, thin dashed vertical lines rising from the corners of every plate, ' +
      'wide empty space around the outermost plate',
  },
  {
    id: 'scale-uk',
    size: SQUARE,
    clean: true,
    tint: 'uk',
    subject:
      'one small outlined isometric platform floating in empty space with nothing behind it, ' +
      `a tight cluster of nine figures each ${FIGURE} standing close together on the platform, ` +
      'one of the figures drawn in orange-red, a single dashed circle enclosing the cluster, ' +
      'surrounded by empty black',
  },
  {
    id: 'scale-europe',
    size: SQUARE,
    clean: true,
    tint: 'europe',
    subject:
      'five separate outlined isometric platforms arranged in a wide shallow arc across the frame ' +
      `and floating in empty space, three or four figures each ${FIGURE} standing on each platform, ` +
      'the centre platform drawn in orange-red, thin dashed connector lines linking every platform ' +
      'to its neighbour, surrounded by empty black',
  },
  {
    id: 'scale-world',
    size: SQUARE,
    clean: true,
    tint: 'world',
    subject:
      'a wireframe sphere drawn only as thin outlined latitude and longitude lines, floating in ' +
      `empty space with nothing behind it, six small figures each ${FIGURE} standing spaced apart ` +
      'along the upper curve of the sphere, one meridian line drawn in orange-red, ' +
      'surrounded by empty black',
  },
  {
    id: 'pipeline',
    size: LANDSCAPE,
    clean: true,
    subject:
      'four plain outlined shallow open trays floating in a row one behind another in isometric view '
      + 'with nothing at all behind them, the first tray holding a loose scatter of many small plain '
      + 'cubes, each tray after it holding fewer cubes than the one before, the last tray holding a '
      + 'single cube, one thin straight line passing through all four trays and outlined in '
      + 'orange-red, wide empty black space above and below the row',
  },
  {
    id: 'bands',
    size: LANDSCAPE,
    clean: true,
    subject:
      'a plain outlined isometric doorway standing alone at the far left of the frame with nothing at '
      + 'all behind it, six plain outlined flat slabs floating in a row to the right of the doorway '
      + 'and set further and further apart as they go right, every slab the same size and the same '
      + 'height, the slab nearest the doorway outlined in orange-red, surrounded by empty black',
  },
  {
    id: 'fellowship',
    size: SQUARE,
    clean: true,
    subject:
      'twelve plain simple chairs, each drawn only as a flat seat, one straight upright back and four '
      + 'straight thin legs with no pattern and no detail, arranged in a wide circle seen in isometric '
      + `view and floating with nothing behind them, four figures each ${FIGURE} seated on four of the `
      + 'chairs and the other eight chairs empty, one chair outlined in orange-red, the middle of the '
      + 'circle completely empty, surrounded by empty black',
  },
  {
    id: 'five-things',
    size: LANDSCAPE,
    clean: true,
    subject:
      'a loose scattered cloud of two dozen small plain outlined rectangular cards and rounded ' +
      'speech bubbles tumbling in from the left at random angles, funnelling along thin dashed ' +
      'guide lines through one narrow gap, and emerging on the right as a neat exploded vertical ' +
      'stack of exactly five plain slabs floating one above another in isometric view, each of the ' +
      'five slabs outlined in orange-red, no ground plane and no grid beneath anything, ' +
      'floating in empty space with nothing behind them, surrounded by empty black',  },
];

/**
 * Palette, with a project override.
 *
 * The generation colours are never the shipped ones, so a project adopting this
 * pipeline only has to say what its own ink and accent are. `_art/palette.json`
 * holds the same shape as PAINT and is merged over it, one mode at a time.
 */
export function loadPalette(artDir) {
  const file = path.join(artDir, 'palette.json');
  if (!existsSync(file)) return { paint: PAINT, source: 'built in' };
  const override = JSON.parse(readFileSync(file, 'utf-8'));
  return { paint: { ...PAINT, ...override }, source: '_art/palette.json' };
}
