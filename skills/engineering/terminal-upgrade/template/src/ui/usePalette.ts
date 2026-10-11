/**
 * The palette session: the saved theme, the live preview while the view is open, and the
 * keys the view takes before the deck sees them. Enter writes the file; Esc and x close
 * through the deck reducer, which drops the preview because the view is no longer open.
 */
import { useReducer, useRef, useState } from 'react';
import { PRESETS, writeTheme, type Theme } from '../themeFile.ts';
import type { Tone } from './theme.ts';
import { initialPalette, reducePalette, type PaletteAction, type PaletteState } from './paletteState.ts';

export interface PaletteKey {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  backspace?: boolean;
  delete?: boolean;
}

export interface PaletteSession {
  state: PaletteState;
  saved: Theme;
  /** The colours the deck wears right now: the preview while open, else what is saved. */
  toneFor(open: boolean): Tone;
  /** Start a session from the saved theme. */
  open(): void;
  /**
   * Handle a key while the view is open. Returns the saved theme's label when Enter saved
   * it, true when the key was consumed, false when the deck should have it.
   */
  handleKey(input: string, key: PaletteKey): boolean | string;
}

export function usePalette(initial: Theme): PaletteSession {
  const [saved, setSaved] = useState(initial);
  const [state, dispatch] = useReducer(reducePalette, initial, initialPalette);
  // Keys can land several to a tick, before React re-renders; `latest` keeps the handler honest.
  const latest = useRef(state);
  latest.current = state;
  const apply = (action: PaletteAction) => {
    latest.current = reducePalette(latest.current, action);
    dispatch(action);
  };

  const save = (): string => {
    const theme = latest.current.preview;
    writeTheme(theme);
    setSaved(theme);
    apply({ type: 'saved', theme });
    return PRESETS.find((p) => p.name === theme.preset)?.label ?? 'custom';
  };

  const handleKey = (input: string, key: PaletteKey): boolean | string => {
    if (latest.current.edit) {
      if (key.escape) apply({ type: 'hexCancel' });
      else if (key.return) apply({ type: 'hexAccept' });
      else if (key.backspace || key.delete) apply({ type: 'hexBackspace' });
      else if (input.length === 1) apply({ type: 'hexChar', char: input });
      return true;
    }
    if (key.upArrow || input === 'k') apply({ type: 'up' });
    else if (key.downArrow || input === 'j') apply({ type: 'down' });
    else if (key.leftArrow) apply({ type: 'left' });
    else if (key.rightArrow) apply({ type: 'right' });
    else if (key.return) return save();
    else if (input === 'r') apply({ type: 'reset' });
    else if (input === '#') apply({ type: 'hexStart' });
    else return false;
    return true;
  };

  return {
    state,
    saved,
    toneFor: (open) => (open ? state.preview.colors : saved.colors),
    open: () => apply({ type: 'open', theme: saved }),
    handleKey,
  };
}
