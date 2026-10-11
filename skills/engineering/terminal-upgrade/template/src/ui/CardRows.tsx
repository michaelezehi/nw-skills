/**
 * The compact card strip laid out as rows: one row when the cards fit comfortably, else
 * balanced rows (3 + 3, 3 + 2) whose last row stretches to the edge. The rows share the
 * strip's height, so a short screen that trimmed the strip still fits exactly.
 */
import type { ReactNode } from 'react';
import { Box } from 'ink';
import { share } from './grid.ts';

export interface CardRowsProps<T> {
  items: readonly T[];
  /** Card widths per row, from the layout. */
  widths: number[][];
  columns: number;
  height: number;
  card: (item: T, index: number, width: number, rows: number) => ReactNode;
}

export function CardRows<T>({ items, widths, columns, height, card }: CardRowsProps<T>) {
  const heights = share(height, widths.length);
  let offset = 0;
  return (
    <Box flexDirection="column" width={columns} height={height} overflow="hidden">
      {widths.map((row, r) => {
        const start = offset;
        offset += row.length;
        return (
          <Box key={r} flexDirection="row" width={columns} height={heights[r]} overflow="hidden">
            {row.map((width, c) => {
              const item = items[start + c];
              return item === undefined ? <Box key={c} width={width} /> : card(item, start + c, width, heights[r]!);
            })}
          </Box>
        );
      })}
    </Box>
  );
}
