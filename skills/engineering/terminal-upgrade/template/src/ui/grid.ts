/**
 * The quiet state's card grid. With no feed and no logs the service cards take the
 * whole region, so the question is how many to a row. Two rows is the aim from four
 * services up: five is 3 + 2, six is 3 + 3, seven is 4 + 3, four is 2 + 2. A row loses
 * a column when a card would be narrower than readable, or when the last row would be
 * more than one card short of the others. The last row's cards stretch to the full
 * width, and every row ends exactly at the edge.
 */

export interface GridPlan {
  /** Card widths per row, top to bottom. Each row sums to the full width. */
  widths: number[][];
  /** Rows each card row gets, top to bottom. Sums to the height. */
  heights: number[];
}

/** A card narrower than this cannot hold `memory   812 MB  ▕████▁▁▁▁▏` with its label. */
export const MIN_BIG_CARD = 33;
/** Rule, status row, memory row, rule: the least a big card is worth drawing at. */
export const MIN_BIG_ROWS = 4;

/** Columns for `count` cards across `columns` cells. */
export function gridColumns(count: number, columns: number): number {
  if (count <= 1) return 1;
  const most = count <= 3 ? count : Math.ceil(count / 2);
  for (let c = most; c > 1; c--) {
    if (Math.floor(columns / c) < MIN_BIG_CARD) continue;
    const rows = Math.ceil(count / c);
    const last = count - (rows - 1) * c;
    if (rows > 1 && last < c - 1) continue;
    return c;
  }
  return 1;
}

export function gridRows(count: number, columns: number): number {
  return count <= 0 ? 0 : Math.ceil(count / gridColumns(count, columns));
}

/** `total` split into `parts` whole numbers, the remainder going to the first ones. */
export function share(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const each = Math.floor(total / parts);
  const extra = total - each * parts;
  return Array.from({ length: parts }, (_, i) => each + (i < extra ? 1 : 0));
}

export function gridPlan(count: number, columns: number, height: number): GridPlan {
  if (count <= 0 || height <= 0) return { widths: [], heights: [] };
  const perRow = gridColumns(count, columns);
  const rows = Math.ceil(count / perRow);
  const widths: number[][] = [];
  for (let i = 0; i < count; i += perRow) widths.push(share(columns, Math.min(perRow, count - i)));
  return { widths, heights: share(height, rows) };
}
