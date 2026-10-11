/**
 * The notice card: an outlined line with a timestamp and one short sentence, sitting
 * over the top right of the header after a hot reload, push, error or recovery.
 * Foreground only, so it reads the same on any terminal background.
 */
import { Box, Text } from 'ink';
import type { DevEvent } from '../types.ts';
import { useTone, type Tone } from './theme.ts';
import { formatClockMeridiem, formatMs, truncateEnd, cellWidth } from './format.ts';

export interface NoticeData {
  id: number;
  at: number;
  kind: 'reload' | 'push' | 'error' | 'recovered' | 'saved' | 'copied' | 'failed';
  service: string;
  text: string;
  ms?: number;
}

/** Turn a store event into a notice, or nothing when the event is not worth a card. */
export function noticeFor(event: DevEvent): NoticeData | undefined {
  switch (event.kind) {
    case 'reload':
      return { id: event.id, at: event.at, kind: 'reload', service: event.service, text: event.text.replace(/^compiled /, 'Hot reload · '), ms: event.ms };
    case 'push':
      return { id: event.id, at: event.at, kind: 'push', service: event.service, text: 'Functions pushed' };
    case 'error':
      return { id: event.id, at: event.at, kind: 'error', service: event.service, text: event.text };
    case 'recovered':
      return { id: event.id, at: event.at, kind: 'recovered', service: event.service, text: 'Recovered' };
    default:
      return undefined;
  }
}

function lookFor(kind: NoticeData['kind'], tone: Tone): { glyph: string; color: string } {
  switch (kind) {
    case 'reload':
      return { glyph: '↯', color: tone.activity };
    case 'push':
      return { glyph: '↑', color: tone.activity };
    case 'error':
    case 'failed':
      return { glyph: '◆', color: tone.error };
    case 'recovered':
    case 'copied':
      return { glyph: '✓', color: tone.accent };
    case 'saved':
      return { glyph: '●', color: tone.accent };
  }
}

export interface NoticeProps {
  notice: NoticeData;
  /** Width of the screen; the card hugs the top right. */
  columns: number;
}

export function Notice({ notice, columns }: NoticeProps) {
  const tone = useTone();
  const look = lookFor(notice.kind, tone);
  const stamp = formatClockMeridiem(notice.at);
  const tail = notice.ms !== undefined ? ` · ${formatMs(notice.ms)}` : '';
  const body = `${notice.service ? `${notice.service} ` : ''}${notice.text}${tail}`;
  const maxWidth = Math.max(20, Math.min(64, columns - 6));
  const inner = maxWidth - 4;
  const line = truncateEnd(body, Math.max(4, inner - cellWidth(stamp) - 3));
  const width = Math.min(maxWidth, 4 + cellWidth(stamp) + 3 + cellWidth(line));
  return (
    <Box position="absolute" top={1} right={3} width={width} height={3} borderStyle="round" borderColor={look.color} paddingX={1} overflow="hidden">
      <Text wrap="truncate">
        <Text color={tone.muted}>{stamp}</Text>
        <Text color={look.color}> {look.glyph} </Text>
        <Text color={tone.text}>{line}</Text>
      </Text>
    </Box>
  );
}
