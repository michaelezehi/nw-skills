/**
 * string-width's answer, found faster for what the deck draws. Ink measures every line it
 * writes with string-width, which segments graphemes and runs emoji regexes on each one;
 * the deck's borders, sparklines and status glyphs are all non-ASCII, so every line takes
 * that path, and a profile put a quarter of each frame there. This module answers from a
 * table for the ranges the deck uses, skips SGR and OSC escapes with the regex string-width
 * strips them with, and hands anything else, and any call with an option set, to
 * string-width itself, so the answer is string-width's by construction. The build script
 * aliases string-width to this file inside the bundle; under tsx Ink keeps its own.
 */
import stringWidth from 'string-width';

export interface WidthOptions {
  ambiguousIsNarrow?: boolean;
  countAnsiEscapeCodes?: boolean;
}

/**
 * Code point ranges that are one cell each, and never join a wider cluster: ASCII,
 * Latin-1 bar the soft hyphen, general punctuation bar the bidi controls, arrows, the
 * stopwatch, box drawing, blocks and shapes bar the two square emoji, the symbols and
 * dingbats that show as text, the vector cross, and the miscellaneous arrows. The
 * textWidth test checks every code point here against string-width.
 */
export const ONE_CELL: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0xac], [0xae, 0x24f],
  [0x2010, 0x2029], [0x202f, 0x205e],
  [0x2190, 0x21ff],
  [0x23f1, 0x23f1],
  [0x2500, 0x25fc], [0x25ff, 0x25ff],
  [0x2600, 0x2613], [0x2616, 0x262f], [0x2638, 0x2647], [0x2654, 0x267e], [0x2680, 0x2689], [0x2690, 0x2692], [0x2694, 0x26a0],
  [0x26a2, 0x26a9], [0x26ac, 0x26bc], [0x26bf, 0x26c3], [0x26c6, 0x26cd], [0x26cf, 0x26d3], [0x26d5, 0x26e9], [0x26eb, 0x26f1],
  [0x26f4, 0x26f4], [0x26f6, 0x26f9], [0x26fb, 0x26fc], [0x26fe, 0x2704], [0x2706, 0x2709], [0x270c, 0x2727], [0x2729, 0x274b],
  [0x274d, 0x274d], [0x274f, 0x2752], [0x2756, 0x2756], [0x2758, 0x2794], [0x2798, 0x27af], [0x27b1, 0x27be],
  [0x2a2f, 0x2a2f],
  [0x2b00, 0x2b1a], [0x2b1d, 0x2b4f], [0x2b51, 0x2b54], [0x2b56, 0x2bff],
];

/** Control characters print nothing; tab too, as string-width has it. */
export const ZERO_CELL: ReadonlyArray<readonly [number, number]> = [[0x00, 0x1f], [0x7f, 0x7f]];

/** Cells per code unit plus one: 0 is not in the table, ask string-width. */
const TABLE = new Uint8Array(0x10000);
for (const [from, to] of ZERO_CELL) TABLE.fill(1, from, to + 1);
for (const [from, to] of ONE_CELL) TABLE.fill(2, from, to + 1);

const ESC = 0x1b;
const CSI_C1 = 0x9b;
const OSC_C1 = 0x9d;
/** ansi-regex 6.2.2, as strip-ansi inside string-width uses it, anchored at the escape. */
const ESCAPE = /(?:(?:\u001B\]|\u009D)[^\u0007\u001B\u009C\u009D]*(?:\u0007|\u001B\|\u009C))|[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]/y;

/** The terminal cell width of `text`, as string-width 8 reports it. */
export default function textWidth(text: string, options?: WidthOptions): number {
  if (options !== undefined && (options.ambiguousIsNarrow === false || options.countAnsiEscapeCodes === true)) return stringWidth(text, options);
  if (typeof text !== 'string' || text.length === 0) return 0;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === ESC || code === CSI_C1 || code === OSC_C1) {
      ESCAPE.lastIndex = i;
      const match = ESCAPE.exec(text);
      // A lone escape, or a form the regex does not take, is string-width's to count.
      if (!match) return stringWidth(text, options);
      i += match[0].length - 1;
      continue;
    }
    const cells = TABLE[code]!;
    if (cells === 0) return stringWidth(text, options);
    width += cells - 1;
  }
  return width;
}
