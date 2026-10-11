/**
 * Status glyphs. The only moving thing on the deck is the spinner of a service that is
 * starting or compiling, stepped by the shared 400ms frame clock. Everything else is a
 * fixed glyph. A fresh hot reload shows its bolt in the accent for HOT_MS, then activity.
 */
import type { ServiceStatus } from '../types.ts';
import { HOT_MS, type Tone } from './theme.ts';

export const glyph = {
  bolt: '↯',
  push: '↑',
  dot: '●',
  spark: '✦',
  crack: '◆',
  sleep: 'z',
  restart: '↻',
} as const;

const SPINNER = ['◐', '◓', '◑', '◒'] as const;

/** The spinner glyph for the global frame counter. */
export function spinnerFrame(frame: number): string {
  return SPINNER[frame % SPINNER.length]!;
}

/** True within HOT_MS of `at`: fresh enough to show in the accent. */
export function isHot(at: number | undefined, now: number): boolean {
  return at !== undefined && now - at < HOT_MS;
}

export function hotColor(at: number | undefined, now: number, tone: Tone): string {
  return isHot(at, now) ? tone.accent : tone.activity;
}

export interface StatusLook {
  glyph: string;
  color: string;
  word: string;
  animated: boolean;
}

/** A starting or compiling spinner stops after this long and rests, so a stuck service costs nothing. */
export const SPIN_MAX_MS = 30_000;

/** Glyph, colour and word for a service status. `spinning` false rests the spinner on its static glyph. */
export function statusLook(status: ServiceStatus, frame: number, spinning: boolean, tone: Tone): StatusLook {
  switch (status) {
    case 'ready':
      return { glyph: glyph.dot, color: tone.accent, word: 'ready', animated: false };
    case 'compiling':
      return { glyph: spinning ? spinnerFrame(frame) : SPINNER[0], color: tone.activity, word: 'compiling', animated: spinning };
    case 'starting':
      return { glyph: spinning ? spinnerFrame(frame) : SPINNER[0], color: tone.muted, word: 'starting', animated: spinning };
    case 'error':
      return { glyph: glyph.crack, color: tone.error, word: 'error', animated: false };
    case 'crashed':
      return { glyph: glyph.crack, color: tone.error, word: 'crashed', animated: false };
    case 'stopped':
      return { glyph: glyph.sleep, color: tone.muted, word: 'stopped', animated: false };
  }
}
