// The colours the band, pane and sprite draw with: the palette the person
// picked in Devdeck, read from its theme.json, each token checked on its own.
import type { Palette } from '../types'

/** Devdeck's own brand palette, used for any token the theme file lacks. */
export const DEFAULT_PALETTE: Palette = {
  accent: '#fde047',
  activity: '#f5a524',
  text: '#ecebe4',
  muted: '#8a887f',
  line: '#3d3c38',
  error: '#f87171',
}

const TOKENS = Object.keys(DEFAULT_PALETTE) as (keyof Palette)[]
const HEX = /^#[0-9a-fA-F]{6}$/

/** How often the poll loop reads the theme file again. */
export const THEME_MS = 10_000

const THEME_FILE = 'devdeck/theme.json'

/**
 * Where Devdeck saves the palette: `$XDG_CONFIG_HOME/devdeck/theme.json`, else
 * `~/.config/devdeck/theme.json`. Null without an absolute home to start from.
 */
export function themePath(xdgConfigHome: string | undefined, home: string | undefined): string | null {
  if (xdgConfigHome?.startsWith('/')) return `${xdgConfigHome.replace(/\/+$/, '')}/${THEME_FILE}`
  if (home?.startsWith('/')) return `${home.replace(/\/+$/, '')}/.config/${THEME_FILE}`
  return null
}

/** The palette in a theme file's text; null text, bad JSON or a bad token gives that token's default. */
export function parsePalette(text: string | null): Palette {
  let raw: unknown = null
  try {
    raw = text === null ? null : JSON.parse(text)
  } catch {
    raw = null
  }
  const colors = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).colors : null
  const given = typeof colors === 'object' && colors !== null ? (colors as Record<string, unknown>) : {}
  const out = { ...DEFAULT_PALETTE }
  for (const token of TOKENS) {
    const value = given[token]
    if (typeof value === 'string' && HEX.test(value)) out[token] = value.toLowerCase()
  }
  return out
}

export const samePalette = (a: Palette, b: Palette): boolean => TOKENS.every(token => a[token] === b[token])

/** `#rrggbb` as the 0xRRGGBB number a Raster cell takes. */
export const rgbOf = (hex: string): number => Number.parseInt(hex.slice(1), 16)
