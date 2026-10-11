/**
 * Devdeck palette. Six tokens, truecolor hex passed straight to Ink `color` /
 * `backgroundColor`. The active set comes from ThemeContext: components call `useTone()`,
 * helpers take a `Tone` argument. `DEFAULT_TONE` is Brand, for code that runs outside React.
 */
import { createContext, use } from 'react';
import { DEFAULT_PRESET, PRESETS, presetNameFor, type Colors } from '../themeFile.ts';

/**
 * accent: running, healthy, focused, selected (the old yellow).
 * activity: compiling, hot reload, mutations, slow calls, highlights (the old amber).
 * text: main text and numbers. muted: labels and secondary text.
 * line: outlines, rules and dim glyphs. error: errors only.
 */
export type Tone = Colors & {
  /** Spectrum's colours; absent in every other preset, so each helper below falls back to a token. */
  hues?: readonly string[];
  /** Service id to its colour, assigned in service order. */
  serviceHues?: Readonly<Record<string, string>>;
};

export type Stat = 'memory' | 'cpu' | 'convex' | 'calls' | 'watchers' | 'query' | 'http';
const STAT_HUE: Record<Stat, number> = { memory: 1, cpu: 2, convex: 3, calls: 4, watchers: 5, query: 1, http: 5 };

/** The palette with Spectrum's hues attached when these colours are Spectrum's. */
export function withHues(colors: Colors, serviceOrder: readonly string[]): Tone {
  const hues = PRESETS.find((p) => p.name === presetNameFor(colors))?.hues;
  if (!hues || hues.length === 0) return colors;
  return { ...colors, hues, serviceHues: Object.fromEntries(serviceOrder.map((id, i) => [id, hues[i % hues.length]!])) };
}

/** A stat's own colour under Spectrum, else `fallback`. */
export function statHue(tone: Tone, stat: Stat, fallback: string): string {
  return tone.hues?.[STAT_HUE[stat] % tone.hues.length] ?? fallback;
}

/** A service's own colour under Spectrum, else `fallback`. */
export function serviceHue(tone: Tone, id: string, fallback: string): string {
  return tone.serviceHues?.[id] ?? fallback;
}

export const DEFAULT_TONE: Tone = { ...DEFAULT_PRESET.colors };

export const ThemeContext = createContext<Tone>(DEFAULT_TONE);
export const ThemeProvider = ThemeContext.Provider;

/** The active palette. Memoised panels re-render when it changes because they subscribe here. */
export function useTone(): Tone {
  return use(ThemeContext);
}

/** Dark or light label for text set on a filled badge of `background`. */
export function labelOn(background: string): string {
  return luminance(background) > 0.35 ? '#1c1b19' : '#f5f4ee';
}

/** Relative luminance per WCAG, 0 to 1. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Letter-spaced caps label, the `R A D I A T O R S` style from the reference panels. */
export function spaced(label: string): string {
  return label.toUpperCase().split('').join(' ');
}

/** Breakpoints. Width tiers decide the whole layout. */
export const FULL_COLS = 120;
export const MEDIUM_COLS = 80;

/** A fresh hot reload shows its bolt in the accent for this long, then settles to activity. */
export const HOT_MS = 4000;
/** How long the notice card stays up. */
export const NOTICE_MS = 4000;
/** Notices show at most once per this interval; the newest pending one wins. */
export const NOTICE_GAP_MS = 8000;
/** Calls slower than this show in the activity colour. */
export const SLOW_CALL_MS = 500;
