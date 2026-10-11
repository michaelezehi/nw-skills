/**
 * Row budget for the plain view: title, a gap, one row per service, the watchers row,
 * a gap, the LATEST heading, as many LATEST rows as fit, the error tray, the log pane
 * and the footer. The sum is always exactly the screen height.
 */
import { logPaneRows, MAX_TRAY_LINES } from './layout.ts';

export interface PlainLayoutInput {
  columns: number;
  rows: number;
  /** App services; watchers share one row. */
  services: number;
  errors: number;
  logs: boolean;
}

export interface PlainLayout {
  columns: number;
  rows: number;
  title: number;
  gapTop: number;
  services: number;
  watchers: number;
  gapMid: number;
  heading: number;
  latest: number;
  tray: number;
  logPane: number;
  footer: number;
  /** Rows an open view (error card, key sheet) gets in place of everything between the title and the tray. */
  view: number;
}

type Part = 'title' | 'gapTop' | 'services' | 'watchers' | 'gapMid' | 'heading' | 'tray';

export function computePlainLayout(input: PlainLayoutInput): PlainLayout {
  const { columns, rows } = input;
  const footer = 1;
  const logPane = logPaneRows(rows, input.logs);
  const parts: Record<Part, number> = {
    title: 1,
    gapTop: 1,
    services: input.services,
    watchers: 1,
    gapMid: 1,
    heading: 1,
    tray: Math.min(input.errors, MAX_TRAY_LINES),
  };
  let latest = rows - logPane - footer - Object.values(parts).reduce((a, b) => a + b, 0);
  const give = (part: Part, floor: number) => {
    while (latest < floor && parts[part] > 0) {
      parts[part] -= 1;
      latest += 1;
    }
  };
  // Keep three LATEST rows before spending the gaps; then give up the rest, least useful first.
  give('gapMid', 3);
  give('gapTop', 3);
  for (const part of ['heading', 'watchers', 'tray', 'services', 'title'] as const) give(part, 0);
  if (latest < 0) latest = 0;
  // A heading with nothing under it is noise; the row reads better as one more LATEST line.
  if (latest === 0 && parts.heading > 0) {
    parts.heading = 0;
    latest = 1;
  }
  const view = parts.gapTop + parts.services + parts.watchers + parts.gapMid + parts.heading + latest;
  return { columns, rows, ...parts, latest, logPane, footer, view };
}
