/**
 * Row budget for the plain deck: the boxed header (or one line of it), the service
 * cards (or a pill row), the region under them, the error tray and the footer. The sum
 * is always exactly the screen height. The region holds LATEST or the log pane; in the
 * quiet state the cards take it on the grid from grid.ts. When rows run short the
 * region gives first, then the header folds to one line, then the cards fold to pills,
 * then the tray.
 */
import { CLOCK_ROWS } from './glyphs.ts';
import { pillPlan, wantsQuiet, MAX_TRAY_LINES, MIN_CARD_WIDTH, type View } from './layout.ts';
import { gridPlan, gridRows, stripColumns, stripWidths, MIN_BIG_ROWS, type GridPlan } from './grid.ts';
import type { Activity } from './deckState.ts';
import { growFromGrid, hogBlock, panelGrowth, HOG_MIN_REGION } from './hogLayout.ts';

export interface PlainLayoutInput {
  columns: number;
  rows: number;
  /** App services; watch packages fold into the header. */
  services: number;
  errors: number;
  view: View;
  activity?: Activity;
  /** Hogs in the store: they take the panel or the strip at the bottom. */
  hogs?: number;
}

export interface PlainLayout {
  columns: number;
  rows: number;
  /** Rows the header takes: the boxed clock, one line, or none. */
  header: number;
  /** Rows the service strip takes: cards with their rules, pill rows, or the quiet grid. */
  services: number;
  /** Width of one card; 0 when the strip is pills or the quiet grid. */
  cardWidth: number;
  /** Card widths per row when the strip is cards: one row, or balanced rows when one would crowd them. */
  cardRows?: number[][];
  pillsPerRow: number;
  pillWidth: number;
  /** Rows of the region under the cards: LATEST, the log pane, or an open view. 0 in the quiet state. */
  latest: number;
  tray: number;
  /** Rows of the hogs block above the tray: 0, the one-line strip, or the panel. */
  hogRows: number;
  /** The hogs block is the panel, not the strip. */
  hogPanel: boolean;
  footer: number;
  /** The quiet grid, when the cards have the region. */
  grid?: GridPlan;
}

/** Two body rows and two rules. */
export const PLAIN_CARD_ROWS = 4;
export const BOXED_HEADER_ROWS = CLOCK_ROWS + 2;
/** LATEST keeps a rule, one line and a rule before anything above it folds. */
const MIN_LATEST = 3;

function quietPlainLayout(input: PlainLayoutInput, pills: { width: number; perRow: number }): PlainLayout | undefined {
  const { columns, rows } = input;
  const footer = 1;
  const need = gridRows(input.services, columns) * MIN_BIG_ROWS;
  let header = BOXED_HEADER_ROWS;
  let tray = Math.min(input.errors, MAX_TRAY_LINES);
  const region = () => rows - header - tray - footer;
  if (region() < need) header = 1;
  while (region() < need && tray > 1) tray -= 1;
  if (region() < need) return undefined;
  const services = region();
  return { columns, rows, header, services, cardWidth: 0, pillsPerRow: pills.perRow, pillWidth: pills.width, latest: 0, tray, hogRows: 0, hogPanel: false, footer, grid: gridPlan(input.services, columns, services) };
}

/** The plain deck's rows, hogs reserved the same way as computeLayout does. */
export function computePlainLayout(input: PlainLayoutInput): PlainLayout {
  const block = hogBlock(input);
  if (block === 'none') return plainDeckLayout(input);
  const base = plainDeckLayout({ ...input, rows: input.rows - 1 });
  const out: PlainLayout = { ...base, rows: input.rows, hogRows: 1 };
  if (block !== 'panel') return out;
  const hogs = input.hogs ?? 0;
  if (base.grid) {
    const grown = growFromGrid(hogs, base.services, input.services, input.columns);
    if (grown.taken === 0) return out;
    return { ...out, services: grown.services, grid: grown.grid, hogRows: 1 + grown.taken, hogPanel: true };
  }
  const taken = panelGrowth(hogs, base.latest - HOG_MIN_REGION);
  if (taken === 0) return out;
  return { ...out, latest: base.latest - taken, hogRows: 1 + taken, hogPanel: true };
}

function plainDeckLayout(input: PlainLayoutInput): PlainLayout {
  const { columns, rows } = input;
  const footer = 1;
  const pills = pillPlan(columns, input.services);
  if (wantsQuiet(input)) {
    const quiet = quietPlainLayout(input, pills);
    if (quiet) return quiet;
  }
  const avail = rows - footer;
  const pillRows = Math.ceil(input.services / pills.perRow);
  let perRow = stripColumns(input.services, columns);
  const cardRowCount = () => Math.ceil(input.services / Math.max(1, perRow));
  let cardWidth = input.services > 0 ? Math.floor(columns / Math.max(1, perRow)) : 0;
  if (cardWidth < MIN_CARD_WIDTH) cardWidth = 0;

  let header = BOXED_HEADER_ROWS;
  let services = cardWidth > 0 ? cardRowCount() * PLAIN_CARD_ROWS : pillRows;
  let tray = Math.min(input.errors, MAX_TRAY_LINES);
  const latestOf = () => avail - header - services - tray;

  // Wrapped cards that crowd out LATEST go back to one row while they stay readable.
  if (latestOf() < MIN_LATEST && cardWidth > 0 && cardRowCount() > 1) {
    perRow = Math.max(1, input.services);
    cardWidth = Math.floor(columns / perRow);
    if (cardWidth < MIN_CARD_WIDTH) cardWidth = 0;
    services = cardWidth > 0 ? PLAIN_CARD_ROWS : pillRows;
  }
  if (latestOf() < MIN_LATEST) header = 1;
  if (latestOf() < MIN_LATEST && cardWidth > 0) {
    cardWidth = 0;
    services = pillRows;
  }
  while (latestOf() < MIN_LATEST && tray > 1) tray -= 1;
  // Very short screens: no tray, then fewer service rows, then no header, so the footer stays.
  while (latestOf() < 0 && tray > 0) tray -= 1;
  while (latestOf() < 0 && services > 0) services -= 1;
  if (latestOf() < 0) header = 0;
  const latest = Math.max(0, latestOf());

  const cardRows = cardWidth > 0 ? stripWidths(input.services, columns, perRow) : undefined;
  return { columns, rows, header, services, cardWidth, cardRows, pillsPerRow: pills.perRow, pillWidth: pills.width, latest, tray, hogRows: 0, hogPanel: false, footer };
}
