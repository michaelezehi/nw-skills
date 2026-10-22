/**
 * Where the memory hogs and the agent sessions sit in the row budget. They take a block
 * at the bottom of the deck, above the error tray: the MEMORY HOGS and AGENT SESSIONS
 * panels stacked when the region under the cards has rows to spare, else one strip row. Both layouts reserve the strip row first, by laying
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
  /** Hogs in the store; with no agent sessions either, no block. */
  hogs?: number;
  /** Agent sessions in the store: their own panel under the hogs. */
  agents?: number;
  view: View;
  activity?: Activity;
  columns: number;
  rows: number;
}

/** What the screen can hold: nothing, the strip, or room to try the panel. */
export function hogBlock(input: HogInput): HogBlock {
  if ((input.hogs ?? 0) + (input.agents ?? 0) <= 0) return 'none';
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

/** Rows one panel of `items` wants: its top rule, each row after the first with its separator, its bottom rule. */
const panelWant = (items: number): number => (items > 0 ? 2 * Math.min(items, HOG_PANEL_MAX) + 1 : 0);

/**
 * Grow a strip into the panels from a region of `region` rows (the feed, or the quiet
 * grid's rows above its minimum). Returns the rows taken from the region, beyond the
 * strip row; 0 when the region cannot hold every panel at its minimum.
 */
export function panelGrowth(hogs: number, spare: number, agents = 0): number {
  const panels = (hogs > 0 ? 1 : 0) + (agents > 0 ? 1 : 0);
  // The full lists are one `m` away.
  const extra = Math.min(panelWant(hogs) + panelWant(agents) - 1, spare);
  return extra + 1 >= HOG_PANEL_MIN_ROWS * panels ? extra : 0;
}

/** Share the block's rows between the hogs panel and the agent sessions panel, each at least HOG_PANEL_MIN_ROWS when both show. */
export function splitBlock(rows: number, hogs: number, agents: number): { hogs: number; agents: number } {
  if (agents <= 0) return { hogs: rows, agents: 0 };
  if (hogs <= 0) return { hogs: 0, agents: rows };
  const hogsWant = panelWant(hogs);
  if (hogsWant + panelWant(agents) <= rows) return { hogs: hogsWant, agents: rows - hogsWant };
  const top = Math.max(HOG_PANEL_MIN_ROWS, Math.min(hogsWant, Math.ceil(rows / 2), rows - HOG_PANEL_MIN_ROWS));
  return { hogs: top, agents: rows - top };
}

/** The quiet grid gives up the rows above its minimum; returns its new height and plan. */
export function growFromGrid(hogs: number, services: number, count: number, columns: number, agents = 0): { taken: number; services: number; grid: GridPlan } {
  const spare = services - gridRows(count, columns) * MIN_BIG_ROWS;
  const taken = panelGrowth(hogs, spare, agents);
  return { taken, services: services - taken, grid: gridPlan(count, columns, services - taken) };
}
