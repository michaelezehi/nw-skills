/**
 * The plain deck's one panel: notable items newest first, each on one row of time,
 * glyph or badge, name and duration. Nothing is cut: a row that cannot fit in full
 * loses its time column, then the row is left out and the next one takes its place.
 */
import { memo } from 'react';
import { Text } from 'ink';
import type { ConvexCall, DevEvent } from '../types.ts';
import { Panel, Row, EmptyRow, Blank, panelInner } from './Panel.tsx';
import { useTone, SLOW_CALL_MS, type Tone } from './theme.ts';
import { cellWidth, formatClockSeconds, formatMs, padEnd, padStart } from './format.ts';
import { badgeFor } from './ConvexCalls.tsx';
import { lookFor } from './Timeline.tsx';
import { latestRows, type LatestRow } from './latest.ts';

export interface LatestProps {
  events: readonly DevEvent[];
  calls: readonly ConvexCall[];
  width: number;
  rows: number;
  now: number;
}

interface Segment {
  text: string;
  color: string;
}

interface Line {
  glyph: Segment;
  bold: boolean;
  body: Segment[];
  ms: string;
  msColor: string;
}

const TIME_W = 8;
const SERVICE_W = 7;
const MS_W = 6;
/** Time, two cells, the glyph, two cells, the body, one cell, the duration. */
const FIXED_W = TIME_W + 2 + 1 + 2 + 1 + MS_W;

const width = (segments: Segment[]): number => segments.reduce((sum, s) => sum + cellWidth(s.text), 0);

/** `padEnd` that never cuts: a long service id simply runs on. */
const column = (text: string, w: number): string => (cellWidth(text) > w ? text : padEnd(text, w));

function lineFor(row: LatestRow, now: number, tone: Tone): Line {
  const { item } = row;
  const times: Segment[] = row.count > 1 ? [{ text: ` ×${row.count}`, color: tone.muted }] : [];
  if (item.type === 'event') {
    const { event } = item;
    const look = lookFor(event, now, tone);
    const failed = event.kind === 'error' || event.kind === 'exit' || (event.status !== undefined && event.status >= 400);
    const slow = event.ms !== undefined && event.ms >= SLOW_CALL_MS;
    return {
      glyph: { text: look.glyph, color: look.color },
      bold: false,
      body: [{ text: `${column(event.service, SERVICE_W)} `, color: tone.muted }, { text: event.text, color: failed ? tone.error : tone.text }, ...times],
      ms: formatMs(event.ms),
      msColor: failed ? tone.error : slow ? tone.activity : tone.muted,
    };
  }
  const { call } = item;
  const badge = badgeFor(call.type, tone);
  const body: Segment[] = [{ text: call.fn, color: call.ok ? tone.text : tone.error }];
  if (!call.ok) body.push({ text: ` ✕ ${call.error ?? 'failed'}`, color: tone.error });
  return {
    glyph: { text: badge.letter, color: badge.color },
    bold: true,
    body: [...body, ...times],
    ms: formatMs(call.ms),
    msColor: !call.ok ? tone.error : call.ms >= SLOW_CALL_MS ? tone.activity : tone.muted,
  };
}

export const Latest = memo(function Latest({ events, calls, width: panelWidth, rows, now }: LatestProps) {
  const tone = useTone();
  const inner = panelInner(panelWidth);
  const visible = Math.max(0, rows - 2);
  const lines: Array<{ key: string; at: number; line: Line; withTime: boolean }> = [];
  for (const row of latestRows(events, calls)) {
    if (lines.length >= visible) break;
    const line = lineFor(row, now, tone);
    const bodyWidth = width(line.body);
    if (bodyWidth + FIXED_W <= inner) lines.push({ key: row.key, at: row.item.at, line, withTime: true });
    else if (bodyWidth + FIXED_W - TIME_W - 2 <= inner) lines.push({ key: row.key, at: row.item.at, line, withTime: false });
  }

  return (
    <Panel title="LATEST" width={panelWidth} rows={rows}>
      {lines.length === 0 ? (
        <>
          <Blank count={Math.floor((visible - 1) / 2)} />
          <EmptyRow width={inner} glyph="○" glyphColor={tone.accent} text="quiet so far" />
        </>
      ) : (
        lines.map(({ key, at, line, withTime }) => {
          const used = (withTime ? TIME_W + 2 : 0) + 1 + 2 + width(line.body);
          return (
            <Row key={key}>
              {withTime ? <Text color={tone.muted}>{padStart(formatClockSeconds(at), TIME_W)}  </Text> : null}
              <Text color={line.glyph.color} bold={line.bold}>
                {line.glyph.text}
              </Text>
              <Text>{'  '}</Text>
              {line.body.map((s, i) => (
                <Text key={i} color={s.color}>
                  {s.text}
                </Text>
              ))}
              <Text color={line.msColor}>
                {' '.repeat(Math.max(1, inner - used - MS_W))}
                {padStart(line.ms, MS_W)}
              </Text>
            </Row>
          );
        })
      )}
    </Panel>
  );
});
