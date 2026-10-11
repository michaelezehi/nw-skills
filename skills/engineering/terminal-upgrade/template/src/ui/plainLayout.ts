/**
 * Row budget for the plain deck: the boxed header (or one line of it), the service
 * cards (or a pill row), the LATEST panel, the error tray, the log pane and the footer.
 * The sum is always exactly the screen height. When rows run short LATEST gives first,
 * then the header folds to one line, then the cards fold to pills, then the tray.
 */
import { CLOCK_ROWS } from './glyphs.ts';
import { logPaneRows, pillPlan, MAX_TRAY_LINES, MIN_CARD_WIDTH } from './layout.ts';

export interface PlainLayoutInput {
  columns: number;
  rows: number;
  /** App services; watch packages fold into the header. */
  services: number;
  errors: number;
  logs: boolean;
}

export interface PlainLayout {
  columns: number;
  rows: number;
  /** Rows the header takes: the boxed clock, one line, or none. */
  header: number;
  /** Rows the service strip takes: cards with their rules, or pill rows. */
  services: number;
  /** Width of one card; 0 when the strip is pills. */
  cardWidth: number;
  pillsPerRow: number;
  pillWidth: number;
  /** Rows of the LATEST panel, rules included. An open view (error card, key sheet) gets the same rows. */
  latest: number;
  tray: number;
  logPane: number;
  footer: number;
}

/** Two body rows and two rules. */
export const PLAIN_CARD_ROWS = 4;
export const BOXED_HEADER_ROWS = CLOCK_ROWS + 2;
/** LATEST keeps a rule, one line and a rule before anything above it folds. */
const MIN_LATEST = 3;

export function computePlainLayout(input: PlainLayoutInput): PlainLayout {
  const { columns, rows } = input;
  const footer = 1;
  const logPane = logPaneRows(rows, input.logs);
  const avail = rows - logPane - footer;
  const pills = pillPlan(columns, input.services);
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

  return { columns, rows, header, services, cardWidth, pillsPerRow: pills.perRow, pillWidth: pills.width, latest, tray, logPane, footer };
}
