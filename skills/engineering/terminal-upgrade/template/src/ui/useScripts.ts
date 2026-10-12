/**
 * Keys for the open script palette: typing filters, the arrows move, Enter runs the pick as
 * a card and closes the palette. Esc is left to the deck, which closes the view.
 */
import { useState } from 'react';
import type { Key } from 'ink';
import type { DeckControls, ScriptEntry } from '../types.ts';
import { filterScripts } from '../scripts.ts';

export interface ScriptPalette {
  entries: ScriptEntry[];
  query: string;
  index: number;
  handleKey(input: string, key: Key): boolean;
}

export function useScripts(open: boolean, controls: DeckControls, onRan: (name: string, id: string | undefined) => void): ScriptPalette {
  const [state, setState] = useState<{ open: boolean; query: string; index: number; all: ScriptEntry[] }>({ open: false, query: '', index: 0, all: [] });
  // Reopening starts fresh and reads package.json again, so a script added since shows up.
  const current = state.open === open ? state : { open, query: '', index: 0, all: open ? controls.scripts() : [] };
  if (current !== state) setState(current);
  const entries = filterScripts(current.all, current.query);
  const index = Math.min(current.index, Math.max(0, entries.length - 1));

  const handleKey = (input: string, key: Key): boolean => {
    if (!open || key.escape) return false;
    const set = (patch: Partial<typeof current>) => setState({ ...current, ...patch });
    if (key.upArrow) return (set({ index: Math.max(0, index - 1) }), true);
    if (key.downArrow) return (set({ index: Math.min(entries.length - 1, index + 1) }), true);
    if (key.return) {
      const pick = entries[index];
      if (pick) onRan(pick.name, controls.runScript(pick.name));
      return true;
    }
    if (key.backspace || key.delete) return (set({ query: current.query.slice(0, -1), index: 0 }), true);
    const text = key.ctrl || key.meta ? '' : input.replace(/[\u0000-\u001f\u007f]/g, '');
    if (text) return (set({ query: current.query + text, index: 0 }), true);
    return false;
  };

  return { entries, query: current.query, index, handleKey };
}
