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
import { gridPlan, gridRows, MIN_BIG_ROWS, type GridPlan } from './grid.ts';
import type { Activity } from './deckState.ts';

export interface PlainLayoutInput {
  columns: number;
  rows: number;
  /** App services; watch packages fold into the header. */
  services: number;
  errors: number;
  view: View;
  activity?: Activity;
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
  pillsPerRow: number;
  pillWidth: number;
  /** Rows of the region under the cards: LATEST, the log pane, or an open view. 0 in the quiet state. */
  latest: number;
  tray: number;
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
  return { columns, rows, header, services, cardWidth: 0, pillsPerRow: pills.perRow, pillWidth: pills.width, latest: 0, tray, footer, grid: gridPlan(input.services, columns, services) };
}

export function computePlainLayout(input: PlainLayoutInput): PlainLayout {
  const { columns, rows } = input;
  const footer = 1;
  const pills = pillPlan(columns, input.services);
  if (wantsQuiet(input)) {
    const quiet = quietPlainLayout(input, pills);
    if (quiet) return quiet;
  }
  const avail = rows - footer;
  const pillRows = Math.ceil(input.services / pills.perRow);
  let cardWidth = input.services > 0 ? Math.floor(columns / input.services) : 0;
  if (cardWidth < MIN_CARD_WIDTH) cardWidth = 0;

  let header = BOXED_HEADER_ROWS;
  let services = cardWidth > 0 ? PLAIN_CARD_ROWS : pillRows;
  let tray = Math.min(input.errors, MAX_TRAY_LINES);
  const latestOf = () => avail - header - services - tray;

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

  return { columns, rows, header, services, cardWidth, pillsPerRow: pills.perRow, pillWidth: pills.width, latest, tray, footer };
}
