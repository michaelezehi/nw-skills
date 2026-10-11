/** What happened, newest first: time, glyph, service, text, duration. Info lines sit dimmed. */
import { memo } from 'react';
import { Text } from 'ink';
import type { DevEvent, DevEventKind } from '../types.ts';
import { Panel, Row, EmptyRow, Blank, panelInner } from './Panel.tsx';
import { useTone, SLOW_CALL_MS, type Tone } from './theme.ts';
import { formatClockSeconds, formatMs, padEnd, padStart, truncateEnd } from './format.ts';
import { glyph, hotColor } from './sprites.ts';

interface Look {
  glyph: string;
  color: string;
}

export function lookFor(event: DevEvent, now: number, tone: Tone): Look {
  const kind: DevEventKind = event.kind;
  switch (kind) {
    case 'ready':
      return { glyph: glyph.dot, color: tone.accent };
    case 'reload':
      return { glyph: glyph.bolt, color: hotColor(event.at, now, tone) };
    case 'compile':
      return { glyph: '◐', color: tone.activity };
    case 'request':
      return { glyph: '→', color: event.status !== undefined && event.status >= 400 ? tone.error : tone.muted };
    case 'push':
      return { glyph: glyph.push, color: tone.activity };
    case 'error':
      return { glyph: glyph.crack, color: tone.error };
    case 'recovered':
      return { glyph: '✓', color: tone.accent };
    case 'exit':
      return { glyph: '×', color: tone.error };
    case 'restart':
      return { glyph: glyph.restart, color: tone.activity };
    case 'info':
      return { glyph: '·', color: tone.muted };
  }
}

export interface TimelineProps {
  events: readonly DevEvent[];
  paused: boolean;
  width: number;
  rows: number;
  focused: boolean;
  selectedIndex: number;
  /** Render time; decides whether a reload bolt is still hot. */
  now: number;
}

const TIME_WIDTH = 8;
const SERVICE_WIDTH = 7;
const MS_WIDTH = 6;

export const Timeline = memo(function Timeline({ events, paused, width, rows, focused, selectedIndex, now }: TimelineProps) {
  const tone = useTone();
  const inner = panelInner(width);
  const visible = Math.max(0, rows - 2);
  const list = [...events].reverse();
  const start = Math.max(0, Math.min(selectedIndex - visible + 1, list.length - visible));
  const shown = list.slice(start, start + visible);
  const textWidth = Math.max(8, inner - 2 - TIME_WIDTH - 1 - 1 - 1 - SERVICE_WIDTH - 1 - 1 - MS_WIDTH);

  return (
    <Panel title="TIMELINE" right={paused ? 'paused' : undefined} rightColor={tone.activity} width={width} rows={rows} focused={focused}>
      {shown.length === 0 ? (
        <>
          <Blank count={Math.floor((visible - 1) / 2)} />
          <EmptyRow width={inner} glyph="○" glyphColor={tone.accent} text="quiet so far" />
        </>
      ) : (
        shown.map((event, i) => {
          const index = start + i;
          const selected = focused && index === selectedIndex;
          const look = lookFor(event, now, tone);
          const slow = event.ms !== undefined && event.ms >= SLOW_CALL_MS;
          const failed = event.kind === 'error' || event.kind === 'exit' || (event.status !== undefined && event.status >= 400);
          return (
            <Row key={event.id}>
              <Text color={tone.accent}>{selected ? '› ' : '  '}</Text>
              <Text color={tone.muted}>{padStart(formatClockSeconds(event.at), TIME_WIDTH)} </Text>
              <Text color={look.color}>{look.glyph} </Text>
              <Text color={tone.muted}>{padEnd(event.service, SERVICE_WIDTH)} </Text>
              <Text color={selected ? tone.accent : failed ? tone.error : event.kind === 'info' ? tone.muted : tone.text}>{padEnd(truncateEnd(event.text, textWidth), textWidth)}</Text>
              <Text color={slow ? tone.activity : tone.muted}> {padStart(formatMs(event.ms), MS_WIDTH)}</Text>
            </Row>
          );
        })
      )}
    </Panel>
  );
});
