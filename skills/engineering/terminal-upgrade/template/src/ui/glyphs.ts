/** Box characters, ring gauges, capsule bars, sparklines and the block digit font. */

export const box = {
  tl: '╭',
  tr: '╮',
  bl: '╰',
  br: '╯',
  h: '─',
  v: '│',
} as const;

export const capsule = { left: '▕', right: '▏', fill: '█', empty: '▁' } as const;

/** 5-step ring for compact spots. */
export const RING_STEPS = ['○', '◔', '◑', '◕', '●'] as const;

/** 0..100 into one of the five ring glyphs. */
export function ring(percent: number): string {
  const p = clamp(percent, 0, 100);
  const step = Math.round((p / 100) * (RING_STEPS.length - 1));
  return RING_STEPS[step]!;
}

/**
 * 3 by 3 braille ring for the hero gauge. Eight segments light up clockwise
 * from the top as the percentage climbs. The centre cell stays empty.
 */
const RING_FILLED = ['⣤', '⣄', '⣿', '⠋', '⠛', '⠙', '⣿', '⣠'] as const;
const RING_EMPTY = ['⠤', '⢄', '⢸', '⠜', '⠤', '⠣', '⡇', '⡠'] as const;
/** Segment index laid out on a 3x3 grid, row by row. null is the centre. */
const RING_GRID: Array<number | null> = [7, 0, 1, 6, null, 2, 5, 4, 3];

export interface BrailleCell {
  glyph: string;
  on: boolean;
}

/** Three rows of three cells; `on` marks a lit segment. */
export function brailleRing(percent: number): BrailleCell[][] {
  const lit = Math.round((clamp(percent, 0, 100) / 100) * 8);
  const rows: BrailleCell[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: BrailleCell[] = [];
    for (let c = 0; c < 3; c++) {
      const seg = RING_GRID[r * 3 + c]!;
      if (seg === null) {
        row.push({ glyph: ' ', on: false });
        continue;
      }
      const on = seg < lit;
      row.push({ glyph: on ? RING_FILLED[seg]! : RING_EMPTY[seg]!, on });
    }
    rows.push(row);
  }
  return rows;
}

/** `▕███▁▁▁▏` with `inner` cells between the caps. Returns the three parts so they can be coloured. */
export function capsuleBar(percent: number, inner: number): { filled: string; empty: string } {
  const width = Math.max(0, inner);
  const fill = Math.round((clamp(percent, 0, 100) / 100) * width);
  return { filled: capsule.fill.repeat(fill), empty: capsule.empty.repeat(width - fill) };
}

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/** Half-block sparkline over the last `width` samples, scaled to the window's own max. */
export function sparkline(samples: readonly number[], width: number): string {
  if (width <= 0) return '';
  const tail = samples.slice(-width);
  if (tail.length === 0) return ' '.repeat(width);
  const max = Math.max(...tail, 1);
  const min = Math.min(...tail);
  const span = Math.max(max - min, 1);
  const cells = tail.map((v) => {
    const level = max === min ? 3 : Math.round(((v - min) / span) * (SPARK.length - 1));
    return SPARK[level]!;
  });
  return ' '.repeat(width - cells.length) + cells.join('');
}

/** 5-row block font, each digit three cells wide. The colon is one cell. */
const DIGITS: Record<string, readonly string[]> = {
  '0': ['███', '█ █', '█ █', '█ █', '███'],
  '1': [' █ ', '██ ', ' █ ', ' █ ', '███'],
  '2': ['███', '  █', '███', '█  ', '███'],
  '3': ['███', '  █', '███', '  █', '███'],
  '4': ['█ █', '█ █', '███', '  █', '  █'],
  '5': ['███', '█  ', '███', '  █', '███'],
  '6': ['███', '█  ', '███', '█ █', '███'],
  '7': ['███', '  █', '  █', '  █', '  █'],
  '8': ['███', '█ █', '███', '█ █', '███'],
  '9': ['███', '█ █', '███', '  █', '███'],
  ':': [' ', '█', ' ', '█', ' '],
  ' ': [' ', ' ', ' ', ' ', ' '],
};

export const CLOCK_ROWS = 5;

export interface ClockCell {
  text: string;
  colon: boolean;
}

/** Each row is a list of cells (one per character of `text`) so colons can be coloured separately. */
export function blockDigits(text: string): ClockCell[][] {
  const rows: ClockCell[][] = [];
  for (let r = 0; r < CLOCK_ROWS; r++) {
    const row: ClockCell[] = [];
    for (const ch of text) {
      const glyph = DIGITS[ch] ?? DIGITS[' ']!;
      row.push({ text: glyph[r]!, colon: ch === ':' });
    }
    rows.push(row);
  }
  return rows;
}

/** Width in cells of a block-digit string, with one space between characters. */
export function blockDigitsWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += (DIGITS[ch] ?? DIGITS[' ']!)[0]!.length + 1;
  return Math.max(0, width - 1);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
