/**
 * Where the memory hogs sit in the row budget. They take a block at the bottom of the
 * deck, above the error tray: the full panel when the region under the cards has rows
 * to spare, else one strip row. Both layouts reserve the strip row first, by laying
 * out one row shorter, then grow the block into the region's spare rows, so every
 * region still sums to the exact screen height.
 */
import type { Activity } from './deckState.ts';
import type { View } from './layout.ts';
import { gridPlan, gridRows, MIN_BIG_ROWS, type GridPlan } from './grid.ts';

/** The panel's rows need this width for name, memory and the buttons; narrower is the strip. */
export const HOG_PANEL_MIN_COLS = 60;
/** The feed, LATEST or the logs keep at least this many rows when the panel grows. */
export const HOG_MIN_REGION = 6;
/** The most hogs the panel grows to show; `m` lists them all. */
export const HOG_PANEL_MAX = 5;
/** Rule, one hog, rule. */
export const HOG_PANEL_MIN_ROWS = 3;
/** Below this the screen holds no hog rows at all; the footer and cards come first. */
export const HOG_MIN_SCREEN_ROWS = 8;

export type HogBlock = 'none' | 'strip' | 'panel';

export interface HogInput {
  /** Hogs in the store; 0 or absent draws no block. */
  hogs?: number;
  view: View;
  activity?: Activity;
  columns: number;
  rows: number;
}

/** What the screen can hold: nothing, the strip, or room to try the panel. */
export function hogBlock(input: HogInput): HogBlock {
  if (!input.hogs || input.hogs <= 0) return 'none';
  // The hog view lists them all; the help sheet covers the screen.
  if (input.view === 'hogs' || input.view === 'keys') return 'none';
  if (input.rows < HOG_MIN_SCREEN_ROWS) return 'none';
  if (input.view === 'deck' && input.activity !== 'logs' && input.columns >= HOG_PANEL_MIN_COLS) return 'panel';
  return 'strip';
}

/** Rows the hogs block takes, and whether it is the panel. */
export interface HogRows {
  hogRows: number;
  hogPanel: boolean;
}

/**
 * Grow a strip into the panel from a region of `region` rows (the feed, or the quiet
 * grid's rows above its minimum). Returns the rows taken from the region.
 */
export function panelGrowth(hogs: number, spare: number): number {
  // Each hog after the first brings its separator row; the full list is one `m` away.
  const shown = Math.min(hogs, HOG_PANEL_MAX);
  const extra = Math.min(2 * shown - 1 + 2 - 1, spare);
  return extra + 1 >= HOG_PANEL_MIN_ROWS ? extra : 0;
}

/** The quiet grid gives up the rows above its minimum; returns its new height and plan. */
export function growFromGrid(hogs: number, services: number, count: number, columns: number): { taken: number; services: number; grid: GridPlan } {
  const spare = services - gridRows(count, columns) * MIN_BIG_ROWS;
  const taken = panelGrowth(hogs, spare);
  return { taken, services: services - taken, grid: gridPlan(count, columns, services - taken) };
}
