// The band's six-cell sprite: a 6x2 pixel drawing packed into one row of half
// blocks for a terminal Raster. Each kind has four frames; frame 0 is its rest.
import type { ActivityKind, Palette } from '../types'

import { rgbOf } from './palette'

export const SPRITE_COLS = 6

/** The terminal's own colour, not a palette one. */
const DEFAULT = 0x01000000

// '#' the kind's colour, '+' a text-coloured highlight, '.' empty; two rows each.
const FRAMES: Record<ActivityKind, string[][]> = {
  reload: [
    ['..###.', '.###..'],
    ['+.###.', '.###.+'],
    ['..+##.', '.##+..'],
    ['.+###.', '.###+.'],
  ],
  mutation: [
    ['..#...', '......'],
    ['.+#+..', '..+...'],
    ['...#..', '.+...#'],
    ['#....+', '...#..'],
  ],
  error: [
    ['..##..', '..##..'],
    ['.####.', '..##..'],
    ['######', '.####.'],
    ['.####.', '..##..'],
  ],
}

const TOKEN: Record<ActivityKind, keyof Palette> = { reload: 'activity', mutation: 'accent', error: 'error' }

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

/**
 * The Raster cells for one frame. `kind` null is the idle sprite: the
 * mutation spark at rest, in the muted colour.
 */
export function spriteCells(kind: ActivityKind | null, frame: number, palette: Palette): string {
  const rows = kind === null ? FRAMES.mutation[0]! : FRAMES[kind][frame % 4]!
  const tint = rgbOf(kind === null ? palette.muted : palette[TOKEN[kind]])
  const highlight = rgbOf(palette.text)
  const pixel = (ch: string | undefined): number => (ch === '#' ? tint : ch === '+' ? highlight : -1)
  const words = new Uint32Array(SPRITE_COLS * 3)

  for (let x = 0; x < SPRITE_COLS; x++) {
    const top = pixel(rows[0]?.[x])
    const bottom = pixel(rows[1]?.[x])
    let cell: [number, number, number] = [0x20, DEFAULT, DEFAULT]
    if (top >= 0 && bottom >= 0) cell = top === bottom ? [0x2588, top, DEFAULT] : [0x2580, top, bottom]
    else if (top >= 0) cell = [0x2580, top, DEFAULT]
    else if (bottom >= 0) cell = [0x2584, bottom, DEFAULT]
    words.set(cell, x * 3)
  }
  return base64(new Uint8Array(words.buffer))
}
