/**
 * Pure layout arithmetic. Given the terminal size and what is on screen, decide the
 * width tier and the exact row count of every region so the frame never exceeds the screen.
 */
import { FULL_COLS, MEDIUM_COLS } from './theme.ts';
import { CLOCK_ROWS } from './glyphs.ts';

export type Tier = 'full' | 'medium' | 'narrow';

export type View = 'deck' | 'error' | 'keys' | 'palette';

export interface LayoutInput {
  columns: number;
  rows: number;
  services: number;
  errors: number;
  view: View;
  /** The log pane is open under the dashboard. */
  logs?: boolean;
}

export interface Layout {
  tier: Tier;
  columns: number;
  rows: number;
  /** Rows the header takes, borders included. */
  header: number;
  /** Rows the service strip takes, borders included. Cards or pill rows. */
  services: number;
  /** Rows for the middle region (calls + timeline, or the error or keys view). */
  middle: number;
  /** Rows of collapsed error lines in the tray. */
  tray: number;
  /** Rows of the log pane under the dashboard; 0 when hidden. */
  logPane: number;
  /** Always one row: the key hints and the error summary. */
  footer: number;
  /** Pills per row in the medium and narrow tiers. */
  pillsPerRow: number;
  /** Width of one pill: wide with the port, or compact so every service fits one row. */
  pillWidth: number;
  /** Width of one card in the full tier; 0 when the strip is pills. */
  cardWidth: number;
  view: View;
}

export const CARD_INNER_ROWS = 4;
/** Narrower cards cannot hold their rows; the strip falls back to pills. */
export const MIN_CARD_WIDTH = 22;
export const MAX_TRAY_LINES = 3;
/** `▕ ● ADMIN   :3010  1.1G ▏` */
export const PILL_WIDTH = 25;
/** `▕ ● ADMIN   1.1G ▏`, without the port, so five pills fit a 96-column row. */
export const PILL_COMPACT_WIDTH = 18;
/** The log pane takes this share of the screen, never fewer than MIN_LOG_PANE rows. */
export const LOG_PANE_SHARE = 0.45;
export const MIN_LOG_PANE = 6;
/** The dashboard keeps at least this many rows; below it the log pane does not open. */
const MIN_DASHBOARD = 8;

export function tierFor(columns: number): Tier {
  if (columns >= FULL_COLS) return 'full';
  if (columns >= MEDIUM_COLS) return 'medium';
  return 'narrow';
}

/** Rows the log pane gets on a screen of `rows`; 0 when hidden or the screen is too short. */
export function logPaneRows(rows: number, logs: boolean): number {
  if (!logs) return 0;
  const pane = Math.max(MIN_LOG_PANE, Math.round(rows * LOG_PANE_SHARE));
  return rows - pane >= MIN_DASHBOARD ? pane : 0;
}

/**
 * Pill width and pills per row: one row of wide pills, else one row of compact pills,
 * else whichever width needs the fewest rows (wide on a tie).
 */
export function pillPlan(columns: number, services: number): { width: number; perRow: number } {
  const widths = [PILL_WIDTH, PILL_COMPACT_WIDTH];
  for (const width of widths) {
    if (services * (width + 1) + 1 <= columns) return { width, perRow: Math.max(1, services) };
  }
  const plans = widths.map((width) => ({ width, perRow: Math.max(1, Math.floor((columns - 1) / (width + 1))) }));
  return plans.reduce((best, plan) => (Math.ceil(services / plan.perRow) < Math.ceil(services / best.perRow) ? plan : best));
}

export function computeLayout(input: LayoutInput): Layout {
  const { columns, rows, view } = input;
  const tier = tierFor(columns);
  const footer = 1;
  const logPane = logPaneRows(rows, input.logs ?? false);
  const avail = rows - logPane;
  let tray = input.errors > 0 ? Math.min(input.errors, MAX_TRAY_LINES) : 0;

  let header: number;
  let services: number;
  const pills = pillPlan(columns, input.services);
  let pillsPerRow = pills.perRow;
  let cardWidth = 0;
  const pillRows = Math.ceil(input.services / pillsPerRow);

  if (tier === 'full') {
    header = CLOCK_ROWS + 2;
    cardWidth = Math.floor(columns / Math.max(1, input.services));
    if (cardWidth < MIN_CARD_WIDTH) cardWidth = 0;
    services = cardWidth > 0 ? CARD_INNER_ROWS + 2 : pillRows;
    if (cardWidth > 0) pillsPerRow = 1;
  } else {
    header = tier === 'medium' ? 3 : 1;
    services = pillRows;
  }

  let middle = avail - header - services - tray - footer;

  // Short terminals: drop the clock first, then collapse the cards into pills,
  // so the middle region keeps at least three rows.
  if (middle < 3 && tier === 'full') {
    header = 3;
    middle = avail - header - services - tray - footer;
  }
  if (middle < 3 && tier === 'full' && cardWidth > 0) {
    pillsPerRow = pills.perRow;
    services = pillRows;
    cardWidth = 0;
    middle = avail - header - services - tray - footer;
  }
  // Very short terminals: give up tray lines, then service rows, so the footer stays on screen.
  while (middle < 0 && tray > 1) {
    tray -= 1;
    middle += 1;
  }
  while (middle < 0 && services > 1) {
    services -= 1;
    middle += 1;
  }
  if (middle < 0 && tray > 0) {
    tray -= 1;
    middle += 1;
  }
  if (middle < 0 && services > 0) {
    services -= 1;
    middle += 1;
  }
  if (middle < 0) middle = 0;

  return { tier, columns, rows, header, services, middle, tray, logPane, footer, pillsPerRow, pillWidth: pills.width, cardWidth, view };
}

/** Split a middle region of `width` cells into two side-by-side panels with a 1-cell gutter. */
export function splitColumns(width: number): { left: number; right: number } {
  const usable = width - 1;
  const left = Math.ceil(usable / 2);
  return { left, right: usable - left };
}

/** A panel's body needs at least one row for its empty state. */
const MIN_PANEL_ROWS = 3;

/**
 * Split `rows` into two stacked panels sized to their content: `topItems` and `bottomItems`
 * rows of content, plus two rules each. When both fit, the leftover goes to the fuller one;
 * when they do not, each keeps at least half, and the shortfall lands on the one that needs more.
 */
export function splitRows(rows: number, topItems = Infinity, bottomItems = Infinity): { top: number; bottom: number } {
  const half = Math.ceil(rows / 2);
  const topWant = Math.max(MIN_PANEL_ROWS, topItems + 2);
  const bottomWant = Math.max(MIN_PANEL_ROWS, bottomItems + 2);
  if (topWant + bottomWant <= rows) {
    const leftover = rows - topWant - bottomWant;
    return topItems >= bottomItems ? { top: topWant + leftover, bottom: bottomWant } : { top: topWant, bottom: bottomWant + leftover };
  }
  const top = Math.max(Math.min(topWant, half), rows - bottomWant, Math.min(MIN_PANEL_ROWS, half));
  return { top, bottom: rows - top };
}
