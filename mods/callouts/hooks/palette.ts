// The colours callouts draw with: the palette picked in Devdeck, read from its theme.json,
// each token checked on its own. A copy of the devdeck mod's reader, so neither needs the other.
import type { Palette } from '../types'

export const DEFAULT_PALETTE: Palette = {
  accent: '#fde047',
  activity: '#f5a524',
  text: '#ecebe4',
  muted: '#8a887f',
  line: '#3d3c38',
  error: '#f87171',
}

/** Text on the accent fill: near black, so yellow cards read at a glance. */
export const INK = '#1c1b19'

const TOKENS = Object.keys(DEFAULT_PALETTE) as (keyof Palette)[]
const HEX = /^#[0-9a-fA-F]{6}$/
const THEME_FILE = 'devdeck/theme.json'

export function themePath(xdgConfigHome: string | undefined, home: string | undefined): string | null {
  if (xdgConfigHome?.startsWith('/')) return `${xdgConfigHome.replace(/\/+$/, '')}/${THEME_FILE}`
  if (home?.startsWith('/')) return `${home.replace(/\/+$/, '')}/.config/${THEME_FILE}`
  return null
}

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
