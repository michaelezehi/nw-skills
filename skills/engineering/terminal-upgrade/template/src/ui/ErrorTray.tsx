/**
 * Errors never dump into the view. The tray lists one line per error; the selected
 * error opens full screen (ErrorView.tsx), with node_modules frames folded here into
 * "N more frames".
 */
import { memo } from 'react';
import { Box, Text } from 'ink';
import type { DevError } from '../types.ts';
import { Row } from './Panel.tsx';
import { useTone } from './theme.ts';
import { formatClock, padEnd, padStart, truncateEnd, cellWidth } from './format.ts';
import { glyph } from './sprites.ts';

export interface TrayProps {
  errors: readonly DevError[];
  rows: number;
  columns: number;
  focused: boolean;
  selectedIndex: number;
}

/** The first newest-first error the tray shows, so the selection stays in view. */
export function trayStart(count: number, rows: number, selectedIndex: number): number {
  return Math.max(0, Math.min(selectedIndex - rows + 1, count - rows));
}

/** Collapsed lines, one per error, newest first. */
export const ErrorTray = memo(function ErrorTray({ errors, rows, columns, focused, selectedIndex }: TrayProps) {
  const tone = useTone();
  if (rows <= 0) return null;
  const list = [...errors].reverse();
  const start = trayStart(list.length, rows, selectedIndex);
  const shown = list.slice(start, start + rows);
  const timeWidth = 5;
  const serviceWidth = 7;
  const titleWidth = Math.max(8, columns - 1 - 2 - 2 - serviceWidth - 1 - 2 - timeWidth - 1);
  return (
    <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
      {shown.map((error, i) => {
        const index = start + i;
        const selected = focused && index === selectedIndex;
        return (
          <Row key={error.id}>
            <Text color={tone.accent}>{selected ? ' ›' : '  '}</Text>
            <Text color={tone.error}> {glyph.crack} </Text>
            <Text color={tone.muted}>{padEnd(error.service, serviceWidth)} </Text>
            <Text color={selected ? tone.accent : tone.text}>{padEnd(truncateEnd(error.title, titleWidth), titleWidth)}</Text>
            <Text color={tone.muted}>  {padStart(formatClock(error.at), timeWidth)}</Text>
          </Row>
        );
      })}
    </Box>
  );
});

const FRAME = /^\s+at\s/;

export interface CardLine {
  kind: 'text' | 'frame' | 'fold';
  text: string;
}

/** Fold runs of node_modules stack frames into one "N more frames" line. */
export function foldFrames(body: readonly string[]): CardLine[] {
  const out: CardLine[] = [];
  let folded = 0;
  const flush = () => {
    if (folded > 0) out.push({ kind: 'fold', text: `${folded} more frame${folded === 1 ? '' : 's'}` });
    folded = 0;
  };
  for (const line of body) {
    if (FRAME.test(line)) {
      if (line.includes('node_modules') || line.includes('node:internal')) {
        folded += 1;
        continue;
      }
      flush();
      out.push({ kind: 'frame', text: line });
      continue;
    }
    flush();
    out.push({ kind: 'text', text: line });
  }
  flush();
  return out;
}

export const COPY_ALL_CHIP = '[ ⧉ Copy all ]';
const CHIP_GAP = '  ';
const ARROW = '  ›  ';

export interface SummaryPlan {
  head: string;
  /** The Copy all chip's cells from the summary's left edge, when it fits. */
  chip?: { x0: number; x1: number };
  /** The newest error, when it reads whole after the chip. */
  detail?: string;
}

const summaryHead = (count: number): string => ` ◆ ${count} error${count === 1 ? '' : 's'}`;

/** One past the Copy all chip's last cell when `count` errors are open: the summary width it needs. */
export const chipEnd = (count: number): number => cellWidth(summaryHead(count)) + cellWidth(CHIP_GAP) + cellWidth(COPY_ALL_CHIP);

/** The summary's pieces for `width` cells: the count, then the chip, then the newest error. A narrow summary drops the error first, then the chip. */
export function planSummary(errors: readonly DevError[], width: number): SummaryPlan {
  const latest = errors[errors.length - 1]!;
  const head = summaryHead(errors.length);
  const x1 = chipEnd(errors.length);
  const x0 = x1 - cellWidth(COPY_ALL_CHIP);
  if (x1 > width) return { head };
  const detail = `${latest.service}: ${latest.title}`;
  // The newest error's title reads whole or not at all.
  return x1 + cellWidth(ARROW) + cellWidth(detail) <= width ? { head, chip: { x0, x1 }, detail } : { head, chip: { x0, x1 } };
}

/** The footer's left half: a count in red and the Copy all chip, or a small yellow mark when all is clear. */
export function ErrorSummary({ errors, width }: { errors: readonly DevError[]; width: number }) {
  const tone = useTone();
  if (errors.length === 0) {
    return (
      <Text wrap="truncate">
        <Text color={tone.accent}> ✓</Text>
        <Text color={tone.muted}> no errors, all clear</Text>
      </Text>
    );
  }
  const plan = planSummary(errors, width);
  return (
    <Text wrap="truncate">
      <Text color={tone.error}>{plan.head}</Text>
      {plan.chip ? (
        <>
          <Text>{CHIP_GAP}</Text>
          <Text color={tone.accent} bold>
            {COPY_ALL_CHIP}
          </Text>
        </>
      ) : null}
      {plan.detail ? (
        <>
          <Text color={tone.error}>{ARROW}</Text>
          <Text color={tone.text}>{plan.detail}</Text>
        </>
      ) : null}
    </Text>
  );
}
