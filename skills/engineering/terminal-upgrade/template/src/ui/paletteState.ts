/**
 * Pure state for the palette view. Rows are the presets, then the six tokens. Moving over
 * a preset previews it on the whole deck; the token rows start from the base theme (what
 * was saved, or applied with Enter) so passing through the presets does not pick one by
 * accident. On a token row, left and right walk a curated swatch list and `#` starts a
 * typed hex. The preview only becomes the saved theme on Enter.
 */
import { PRESETS, TOKENS, isHex, presetNameFor, presetTheme, type Theme, type Token } from '../themeFile.ts';

/** About sixteen swatches per token, suited to its job. No purple-dominant ones. */
export const SWATCHES: Record<Token, readonly string[]> = {
  accent: ['#fde047', '#facc15', '#fbbf24', '#fb923c', '#f97316', '#4ade80', '#22c55e', '#a3e635', '#2dd4bf', '#22d3ee', '#67e8f9', '#60a5fa', '#38bdf8', '#f9a8d4', '#f472b6', '#ecebe4'],
  activity: ['#f5a524', '#fbbf24', '#e8a060', '#fb923c', '#f59e0b', '#d4a373', '#2dd4bf', '#14b8a6', '#86efac', '#7cb4ff', '#60a5fa', '#38bdf8', '#ffb199', '#fda4af', '#b5b3a8', '#facc15'],
  text: ['#ecebe4', '#f5f4ee', '#ffffff', '#e6eef5', '#e8f0ea', '#f3ece2', '#f5ebee', '#d6d3cd', '#fef3c7', '#cbd5e1', '#c7d2d4', '#1c1b19', '#262626', '#2b2a26', '#333333', '#0f172a'],
  muted: ['#8a887f', '#9a8f82', '#8a9a90', '#8c9aa8', '#9c8f94', '#a3a3a3', '#94a3b8', '#a8a29e', '#78716c', '#6b7280', '#6b6960', '#7a8b8f', '#b5b3a8', '#a1a1aa', '#57534e', '#737373'],
  line: ['#3d3c38', '#46403a', '#3a4540', '#3a444e', '#473c41', '#2f2e2a', '#44403c', '#334155', '#3f3f46', '#525252', '#1f2937', '#c9c7bd', '#d6d3cd', '#e5e7eb', '#4b5563', '#27272a'],
  error: ['#f87171', '#ff7b7b', '#ff6b6b', '#ef4444', '#fb7185', '#f43f5e', '#dc2626', '#e11d48', '#ff5555', '#ff4d4d', '#fca5a5', '#b91c1c', '#c0392b', '#e74c3c', '#ff3b30', '#d64545'],
};

export interface HexEdit {
  /** What has been typed so far, without the leading `#`. */
  digits: string;
  /** Enter was pressed on something that is not six hex digits. */
  invalid: boolean;
}

export interface PaletteState {
  /** 0 to PRESETS.length - 1 is a preset row, then one row per token. */
  row: number;
  preview: Theme;
  /** What the token rows customise: the saved theme, or the last one applied with Enter. */
  base: Theme;
  edit?: HexEdit;
}

export type PaletteAction =
  | { type: 'open'; theme: Theme }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'reset' }
  | { type: 'saved'; theme: Theme }
  | { type: 'hexStart' }
  | { type: 'hexChar'; char: string }
  | { type: 'hexBackspace' }
  | { type: 'hexCancel' }
  | { type: 'hexAccept' };

export const ROW_COUNT = PRESETS.length + TOKENS.length;

export function tokenAt(row: number): Token | undefined {
  return TOKENS[row - PRESETS.length];
}

export function presetAt(row: number): (typeof PRESETS)[number] | undefined {
  return PRESETS[row];
}

export function initialPalette(theme: Theme): PaletteState {
  const presetRow = PRESETS.findIndex((p) => p.name === theme.preset);
  return { row: presetRow >= 0 ? presetRow : PRESETS.length, preview: theme, base: theme };
}

function withToken(theme: Theme, token: Token, value: string): Theme {
  const colors = { ...theme.colors, [token]: value };
  return { version: 1, preset: presetNameFor(colors), colors };
}

function move(state: PaletteState, step: number): PaletteState {
  const row = Math.max(0, Math.min(ROW_COUNT - 1, state.row + step));
  const preset = presetAt(row);
  const enteringTokens = !preset && presetAt(state.row) !== undefined;
  const preview = preset ? presetTheme(preset.name) : enteringTokens ? state.base : state.preview;
  return { row, preview, base: state.base };
}

function cycle(state: PaletteState, step: number): PaletteState {
  const token = tokenAt(state.row);
  if (!token) return state;
  const list = SWATCHES[token];
  const at = list.indexOf(state.preview.colors[token]);
  const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
  return { ...state, preview: withToken(state.preview, token, list[next]!) };
}

export function reducePalette(state: PaletteState, action: PaletteAction): PaletteState {
  switch (action.type) {
    case 'open':
      return initialPalette(action.theme);
    case 'up':
      return state.edit ? state : move(state, -1);
    case 'down':
      return state.edit ? state : move(state, 1);
    case 'left':
      return state.edit ? state : cycle(state, -1);
    case 'right':
      return state.edit ? state : cycle(state, 1);
    case 'reset':
      return { row: 0, preview: presetTheme('brand'), base: state.base };
    case 'saved':
      return { ...state, preview: action.theme, base: action.theme, edit: undefined };
    case 'hexStart':
      return tokenAt(state.row) ? { ...state, edit: { digits: '', invalid: false } } : state;
    case 'hexChar': {
      if (!state.edit) return state;
      const char = action.char.toLowerCase();
      if (!/^[0-9a-f]$/.test(char) || state.edit.digits.length >= 6) return state;
      return { ...state, edit: { digits: state.edit.digits + char, invalid: false } };
    }
    case 'hexBackspace':
      return state.edit ? { ...state, edit: { digits: state.edit.digits.slice(0, -1), invalid: false } } : state;
    case 'hexCancel':
      return { row: state.row, preview: state.preview, base: state.base };
    case 'hexAccept': {
      const token = tokenAt(state.row);
      if (!state.edit || !token) return state;
      const value = `#${state.edit.digits}`;
      if (!isHex(value)) return { ...state, edit: { ...state.edit, invalid: true } };
      return { row: state.row, preview: withToken(state.preview, token, value), base: state.base };
    }
  }
}
