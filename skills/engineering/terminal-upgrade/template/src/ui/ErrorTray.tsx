/**
 * Errors never dump into the view. The tray lists one line per error; the selected
 * error opens as a card with the full block: `file:line:col` in amber, `    at` frames
 * dimmed, node_modules frames folded into "N more frames".
 */
import { memo } from 'react';
import { Box, Text } from 'ink';
import type { DevError } from '../types.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { useTone } from './theme.ts';
import { formatClock, padEnd, padStart, truncateEnd, cellWidth, shortFile } from './format.ts';
import { glyph } from './sprites.ts';
import { FILE_REF } from './links.ts';

export interface TrayProps {
  errors: readonly DevError[];
  rows: number;
  columns: number;
  focused: boolean;
  selectedIndex: number;
}

/** Collapsed lines, one per error, newest first. */
export const ErrorTray = memo(function ErrorTray({ errors, rows, columns, focused, selectedIndex }: TrayProps) {
  const tone = useTone();
  if (rows <= 0) return null;
  const list = [...errors].reverse();
  const start = Math.max(0, Math.min(selectedIndex - rows + 1, list.length - rows));
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

export interface ErrorCardProps {
  error: DevError;
  width: number;
  rows: number;
  /** First body line shown; arrows scroll it. */
  offset: number;
  /** Receives the furthest offset this card can scroll, so the reducer can clamp to it. */
  scrollMax?: { current: number };
  /** Wraps every `file:line:col` reference in `text` in a terminal hyperlink; identity when omitted. */
  link?: (text: string) => string;
}

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

/** Split a line into plain and file-reference segments so references can be amber. */
export function highlightRefs(text: string): Array<{ ref: boolean; text: string }> {
  const parts: Array<{ ref: boolean; text: string }> = [];
  let last = 0;
  for (const match of text.matchAll(FILE_REF)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ ref: false, text: text.slice(last, index) });
    parts.push({ ref: true, text: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ ref: false, text: text.slice(last) });
  return parts;
}

export function ErrorCard({ error, width, rows, offset, scrollMax, link }: ErrorCardProps) {
  const tone = useTone();
  const inner = panelInner(width);
  const visible = Math.max(0, rows - 2);
  const lines = foldFrames(error.body);
  const maxOffset = Math.max(0, lines.length - visible);
  if (scrollMax) scrollMax.current = maxOffset;
  const from = Math.min(offset, maxOffset);
  const shown = lines.slice(from, from + visible);
  const more = lines.length - from - shown.length;
  const right = error.file ? shortFile(error.file) : more > 0 ? `${more} more lines` : undefined;
  return (
    <Panel title={`ERROR · ${error.service.toUpperCase()}`} right={right} rightColor={tone.activity} width={width} rows={rows} focused>
      {shown.map((line, i) => {
        if (line.kind === 'fold') {
          return (
            <Row key={i} color={tone.muted}>
              {`      … ${line.text}`}
            </Row>
          );
        }
        if (line.kind === 'frame') {
          return (
            <Row key={i} color={tone.muted}>
              {link ? link(truncateEnd(line.text, inner)) : truncateEnd(line.text, inner)}
            </Row>
          );
        }
        const clipped = truncateEnd(line.text, inner);
        return (
          <Row key={i}>
            {highlightRefs(clipped).map((part, j) => (
              <Text key={j} color={part.ref ? tone.activity : tone.text} bold={part.ref}>
                {part.ref && link ? link(part.text) : part.text}
              </Text>
            ))}
          </Row>
        );
      })}
    </Panel>
  );
}

/** The footer's left half: a count in red, or a small yellow mark when all is clear. */
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
  const latest = errors[errors.length - 1]!;
  const head = ` ◆ ${errors.length} error${errors.length === 1 ? '' : 's'}`;
  const arrow = '  ›  ';
  const detail = `${latest.service}: ${latest.title}`;
  // The newest error's title reads whole or not at all.
  const showDetail = cellWidth(head) + cellWidth(arrow) + cellWidth(detail) <= width;
  return (
    <Text wrap="truncate">
      <Text color={tone.error}>{head}</Text>
      {showDetail ? (
        <>
          <Text color={tone.error}>{arrow}</Text>
          <Text color={tone.text}>{detail}</Text>
        </>
      ) : null}
    </Text>
  );
}
