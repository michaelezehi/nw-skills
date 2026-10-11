/**
 * The saved palette: `$XDG_CONFIG_HOME/devdeck/theme.json`, else `~/.config/devdeck/theme.json`.
 * `colors` is always the fully resolved palette, so a reader needs no preset table; `preset`
 * names where it started, or "custom" once any token was overridden. Written atomically.
 * The Claude mod reads the same file, so the shape here is a contract.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TOKENS = ['accent', 'activity', 'text', 'muted', 'line', 'error'] as const;
export type Token = (typeof TOKENS)[number];
export type Colors = Record<Token, string>;

export interface Theme {
  version: 1;
  /** A preset name, or "custom" once any token differs from it. */
  preset: string;
  colors: Colors;
}

export interface Preset {
  name: string;
  label: string;
  colors: Colors;
  /** Spectrum only: a colour per stat and per service, on top of the six tokens. */
  hues?: readonly string[];
}

/**
 * Each preset reads on a near-black terminal and on a dark teal one; Paper is for light
 * terminals. Spectrum keeps Brand's tokens and adds a hue per stat and per service, so
 * memory, cpu, Convex and calls each read in their own colour; red stays for errors.
 */
export const PRESETS: readonly Preset[] = [
  { name: 'brand', label: 'Brand', colors: { accent: '#fde047', activity: '#f5a524', text: '#ecebe4', muted: '#8a887f', line: '#3d3c38', error: '#f87171' } },
  { name: 'ember', label: 'Ember', colors: { accent: '#fb923c', activity: '#e8a060', text: '#f3ece2', muted: '#9a8f82', line: '#46403a', error: '#ff7b7b' } },
  { name: 'mint', label: 'Mint', colors: { accent: '#4ade80', activity: '#2dd4bf', text: '#e8f0ea', muted: '#8a9a90', line: '#3a4540', error: '#ff7b7b' } },
  { name: 'glacier', label: 'Glacier', colors: { accent: '#67e8f9', activity: '#7cb4ff', text: '#e6eef5', muted: '#8c9aa8', line: '#3a444e', error: '#ff7b7b' } },
  { name: 'rose', label: 'Rose', colors: { accent: '#f9a8d4', activity: '#ffb199', text: '#f5ebee', muted: '#9c8f94', line: '#473c41', error: '#ff6b6b' } },
  { name: 'mono', label: 'Mono', colors: { accent: '#ecebe4', activity: '#b5b3a8', text: '#ecebe4', muted: '#8a887f', line: '#3d3c38', error: '#f87171' } },
  { name: 'paper', label: 'Paper', colors: { accent: '#9a4a00', activity: '#1d6f8a', text: '#1c1b19', muted: '#6b6960', line: '#c9c7bd', error: '#b91c1c' } },
  {
    name: 'spectrum',
    label: 'Spectrum',
    colors: { accent: '#fde047', activity: '#fb923c', text: '#ecebe4', muted: '#8a887f', line: '#3d3c38', error: '#f87171' },
    hues: ['#fde047', '#67e8f9', '#4ade80', '#fb923c', '#f9a8d4', '#7cb4ff', '#2dd4bf', '#fcd34d'],
  },
];

export const DEFAULT_PRESET = PRESETS[0]!;

const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

/** A theme for a preset by name; Brand when the name is unknown. */
export function presetTheme(name: string): Theme {
  const preset = PRESETS.find((p) => p.name === name) ?? DEFAULT_PRESET;
  return { version: 1, preset: preset.name, colors: { ...preset.colors } };
}

/** The preset whose colours these are, else "custom". */
export function presetNameFor(colors: Colors): string {
  const match = PRESETS.find((p) => TOKENS.every((t) => p.colors[t] === colors[t]));
  return match ? match.name : 'custom';
}

export function themePath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim() !== '' ? env.XDG_CONFIG_HOME : join(env.HOME ?? homedir(), '.config');
  return join(base, 'devdeck', 'theme.json');
}

/** Every value checked as `#rrggbb`; a bad or missing one falls back to Brand for that token. */
export function normalizeTheme(raw: unknown): Theme {
  const brand = DEFAULT_PRESET.colors;
  const input = raw && typeof raw === 'object' ? (raw as { preset?: unknown; colors?: unknown }) : {};
  const rawColors = input.colors && typeof input.colors === 'object' ? (input.colors as Record<string, unknown>) : {};
  const colors = {} as Colors;
  for (const token of TOKENS) {
    const value = rawColors[token];
    colors[token] = isHex(value) ? value.toLowerCase() : brand[token];
  }
  const preset = typeof input.preset === 'string' && input.preset !== '' ? input.preset : presetNameFor(colors);
  const known = PRESETS.find((p) => p.name === preset);
  // A preset name that does not match its own colours is stale: say what the colours really are.
  const resolved = known && TOKENS.every((t) => known.colors[t] === colors[t]) ? preset : presetNameFor(colors);
  return { version: 1, preset: resolved, colors };
}

/** The saved theme, or Brand when the file is missing or unreadable. Never throws. */
export function readTheme(env: NodeJS.ProcessEnv = process.env): Theme {
  try {
    const text = readFileSync(themePath(env), 'utf8');
    return normalizeTheme(JSON.parse(text));
  } catch {
    return presetTheme(DEFAULT_PRESET.name);
  }
}

/** Write to a temp file beside the target, then rename, so a reader never sees a half-written file. */
export function writeTheme(theme: Theme, env: NodeJS.ProcessEnv = process.env): void {
  const path = themePath(env);
  const dir = join(path, '..');
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const text = `${JSON.stringify(normalizeTheme(theme), null, 2)}\n`;
  writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o644 });
  renameSync(tmp, path);
}
