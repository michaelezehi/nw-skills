/**
 * Pure layout arithmetic. Given the terminal size and what is on screen, decide the
 * width tier and the exact row count of every region so the frame never exceeds the screen.
 * The region under the cards holds the feed or the logs; in the quiet state it goes to
 * the cards themselves, laid out on the grid from grid.ts.
 */
import { FULL_COLS, MEDIUM_COLS } from './theme.ts';
import { CLOCK_ROWS } from './glyphs.ts';
import { gridPlan, gridRows, stripColumns, stripWidths, MIN_BIG_ROWS, type GridPlan } from './grid.ts';
import type { Activity } from './deckState.ts';
import { growFromGrid, hogBlock, panelGrowth, HOG_MIN_REGION } from './hogLayout.ts';

export type Tier = 'full' | 'medium' | 'narrow';

export type View = 'deck' | 'error' | 'keys' | 'palette' | 'hogs' | 'scripts';

export interface LayoutInput {
  columns: number;
  rows: number;
  services: number;
  errors: number;
  view: View;
  /** Feed by default. Logs keeps the feed's rows for the log pane; quiet gives them to the cards. */
  activity?: Activity;
  /** Hogs in the store: they take the panel or the strip at the bottom. */
  hogs?: number;
}

export interface Layout {
  tier: Tier;
  columns: number;
  rows: number;
  /** Rows the header takes, borders included. */
  header: number;
  /** Rows the service strip takes, borders included. Cards, pill rows, or the quiet grid. */
  services: number;
  /** Rows for the middle region (calls + timeline, the logs, or the error or keys view). */
  middle: number;
  /** Rows of collapsed error lines in the tray. */
  tray: number;
  /** Rows of the hogs block above the tray: 0, the one-line strip, or the panel. */
  hogRows: number;
  /** The hogs block is the panel, not the strip. */
  hogPanel: boolean;
  /** Always one row: the key hints and the error summary. */
  footer: number;
  /** Pills per row in the medium and narrow tiers. */
  pillsPerRow: number;
  /** Width of one pill: wide with the port, or compact so every service fits one row. */
  pillWidth: number;
  /** Width of one card in the full tier; 0 when the strip is pills. */
  cardWidth: number;
  /** Card widths per row when the strip is cards: one row, or balanced rows when one would crowd them. */
  cardRows?: number[][];
  /** The quiet grid, when the cards have the region. */
  grid?: GridPlan;
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

export function tierFor(columns: number): Tier {
  if (columns >= FULL_COLS) return 'full';
  if (columns >= MEDIUM_COLS) return 'medium';
  return 'narrow';
}

/** The quiet state draws its big cards only on the deck itself; an open view needs the region. */
export function wantsQuiet(input: { activity?: Activity; view: View; services: number }): boolean {
  return input.activity === 'quiet' && input.view === 'deck' && input.services > 0;
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

/**
 * The quiet layout: header, the grid, the tray, the footer. The header folds to a line
 * and the tray gives up lines before a card row drops under MIN_BIG_ROWS; undefined when
 * even that is not enough, and the feed layout stands in.
 */
function quietLayout(input: LayoutInput, tier: Tier, pills: { width: number; perRow: number }): Layout | undefined {
  const { columns, rows, view } = input;
  const footer = 1;
  const need = gridRows(input.services, columns) * MIN_BIG_ROWS;
  let header = tier === 'full' ? CLOCK_ROWS + 2 : tier === 'medium' ? 3 : 1;
  let tray = Math.min(input.errors, MAX_TRAY_LINES);
  const region = () => rows - header - tray - footer;
  if (region() < need && tier === 'full') header = 3;
  while (region() < need && tray > 1) tray -= 1;
  if (region() < need) return undefined;
  const services = region();
  return { tier, columns, rows, header, services, middle: 0, tray, hogRows: 0, hogPanel: false, footer, pillsPerRow: pills.perRow, pillWidth: pills.width, cardWidth: 0, grid: gridPlan(input.services, columns, services), view };
}

/**
 * The deck's rows. With hogs, the layout is made one row shorter for the strip, then
 * the strip grows into the panel from the region's spare rows when the panel is allowed.
 */
export function computeLayout(input: LayoutInput): Layout {
  const block = hogBlock(input);
  if (block === 'none') return deckLayout(input);
  const base = deckLayout({ ...input, rows: input.rows - 1 });
  const out: Layout = { ...base, rows: input.rows, hogRows: 1 };
  if (block !== 'panel') return out;
  const hogs = input.hogs ?? 0;
  if (base.grid) {
    const grown = growFromGrid(hogs, base.services, input.services, input.columns);
    if (grown.taken === 0) return out;
    return { ...out, services: grown.services, grid: grown.grid, hogRows: 1 + grown.taken, hogPanel: true };
  }
  const taken = panelGrowth(hogs, base.middle - HOG_MIN_REGION);
  if (taken === 0) return out;
  return { ...out, middle: base.middle - taken, hogRows: 1 + taken, hogPanel: true };
}

function deckLayout(input: LayoutInput): Layout {
  const { columns, rows, view } = input;
  const tier = tierFor(columns);
  const footer = 1;
  const pills = pillPlan(columns, input.services);
  if (wantsQuiet(input)) {
    const quiet = quietLayout(input, tier, pills);
    if (quiet) return quiet;
  }
  let tray = input.errors > 0 ? Math.min(input.errors, MAX_TRAY_LINES) : 0;

  let header: number;
  let services: number;
  let pillsPerRow = pills.perRow;
  let cardWidth = 0;
  let perRow = stripColumns(input.services, columns);
  const pillRows = Math.ceil(input.services / pillsPerRow);
  const cardRowCount = () => Math.ceil(input.services / Math.max(1, perRow));

  if (tier === 'full') {
    header = CLOCK_ROWS + 2;
    cardWidth = Math.floor(columns / Math.max(1, perRow));
    if (cardWidth < MIN_CARD_WIDTH) cardWidth = 0;
    services = cardWidth > 0 ? cardRowCount() * (CARD_INNER_ROWS + 2) : pillRows;
    if (cardWidth > 0) pillsPerRow = 1;
  } else {
    header = tier === 'medium' ? 3 : 1;
    services = pillRows;
  }

  let middle = rows - header - services - tray - footer;

  // Short terminals: drop the clock first, then collapse the cards into pills,
  // so the middle region keeps at least three rows.
  if (middle < 3 && tier === 'full') {
    header = 3;
    middle = rows - header - services - tray - footer;
  }
  // Wrapped cards that crowd out the region go back to one row while they stay readable.
  if (middle < 3 && tier === 'full' && cardWidth > 0 && cardRowCount() > 1) {
    perRow = Math.max(1, input.services);
    cardWidth = Math.floor(columns / perRow);
    if (cardWidth < MIN_CARD_WIDTH) {
      cardWidth = 0;
      pillsPerRow = pills.perRow;
    }
    services = cardWidth > 0 ? CARD_INNER_ROWS + 2 : pillRows;
    middle = rows - header - services - tray - footer;
  }
  if (middle < 3 && tier === 'full' && cardWidth > 0) {
    pillsPerRow = pills.perRow;
    services = pillRows;
    cardWidth = 0;
    middle = rows - header - services - tray - footer;
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

  const cardRows = cardWidth > 0 ? stripWidths(input.services, columns, perRow) : undefined;
  return { tier, columns, rows, header, services, middle, tray, hogRows: 0, hogPanel: false, footer, pillsPerRow, pillWidth: pills.width, cardWidth, cardRows, view };
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
