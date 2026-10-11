/**
 * Live feed of Convex function calls. Newest at the top. Badges Q M A H in their own
 * tones, the function name truncated from the left so the export stays visible,
 * durations right aligned, slow calls in amber and failures in red.
 */
import { memo } from 'react';
import { Text } from 'ink';
import type { ConvexCall, UdfType } from '../types.ts';
import { Panel, Row, EmptyRow, Blank, panelInner } from './Panel.tsx';
import { useTone, labelOn, statHue, SLOW_CALL_MS, type Tone } from './theme.ts';
import { formatClockSeconds, formatMs, padEnd, padStart, truncateStart } from './format.ts';
import { glyph } from './sprites.ts';

export type CallFilter = 'all' | 'Query' | 'Mutation' | 'Action' | 'errors';

export const CALL_FILTERS: CallFilter[] = ['all', 'Query', 'Mutation', 'Action', 'errors'];

export function nextFilter(current: CallFilter): CallFilter {
  const i = CALL_FILTERS.indexOf(current);
  return CALL_FILTERS[(i + 1) % CALL_FILTERS.length]!;
}

export function filterCalls(calls: readonly ConvexCall[], filter: CallFilter): ConvexCall[] {
  switch (filter) {
    case 'all':
      return [...calls];
    case 'errors':
      return calls.filter((c) => !c.ok);
    default:
      return calls.filter((c) => c.type === filter);
  }
}

export const BADGE_LETTER: Record<UdfType, string> = { Query: 'Q', Mutation: 'M', Action: 'A', HttpAction: 'H' };

export interface Badge {
  letter: string;
  /** Fill behind the letter. M is the accent, A the activity colour, Q and H the line neutral. */
  background: string;
  /** The letter on that fill. */
  label: string;
  /** The letter alone, with no fill, in the plain view. */
  color: string;
}

export function badgeFor(type: UdfType, tone: Tone): Badge {
  const letter = BADGE_LETTER[type];
  switch (type) {
    case 'Mutation':
      return { letter, background: tone.accent, label: labelOn(tone.accent), color: tone.accent };
    case 'Action':
      return { letter, background: tone.activity, label: labelOn(tone.activity), color: tone.activity };
    case 'Query': {
      const hue = statHue(tone, 'query', '');
      return hue ? { letter, background: hue, label: labelOn(hue), color: hue } : { letter, background: tone.line, label: tone.text, color: tone.text };
    }
    case 'HttpAction': {
      const hue = statHue(tone, 'http', '');
      return hue ? { letter, background: hue, label: labelOn(hue), color: hue } : { letter, background: tone.line, label: tone.muted, color: tone.muted };
    }
  }
}

export function filterLabel(filter: CallFilter): string {
  switch (filter) {
    case 'all':
      return 'all';
    case 'errors':
      return 'errors only';
    default:
      return `${BADGE_LETTER[filter]} only`;
  }
}

export interface ConvexCallsProps {
  calls: readonly ConvexCall[];
  filter: CallFilter;
  paused: boolean;
  width: number;
  rows: number;
  focused: boolean;
  selectedIndex: number;
}

const MS_WIDTH = 6;
const TIME_WIDTH = 8;

export const ConvexCalls = memo(function ConvexCalls({ calls, filter, paused, width, rows, focused, selectedIndex }: ConvexCallsProps) {
  const tone = useTone();
  const inner = panelInner(width);
  const visible = Math.max(0, rows - 2);
  const list = filterCalls(calls, filter).reverse();
  const start = Math.max(0, Math.min(selectedIndex - visible + 1, list.length - visible));
  const shown = list.slice(start, start + visible);
  const tight = inner < 48;
  const nameWidth = Math.max(8, inner - 2 - 3 - 1 - MS_WIDTH - 2 - 1 - (tight ? 0 : TIME_WIDTH + 1));
  const right = [paused ? 'paused' : '', filter === 'all' ? '' : filterLabel(filter)].filter(Boolean).join(' · ');

  return (
    <Panel title="CONVEX CALLS" right={right || undefined} rightColor={paused ? tone.activity : tone.muted} width={width} rows={rows} focused={focused}>
      {shown.length === 0 && filter !== 'all' ? (
        <>
          <Blank count={Math.floor((visible - 1) / 2)} />
          <EmptyRow width={inner} glyph="◌" glyphColor={tone.accent} text="nothing matches this filter" />
        </>
      ) : (
        shown.map((call, i) => {
          const index = start + i;
          const selected = focused && index === selectedIndex;
          const badge = badgeFor(call.type, tone);
          const slow = call.ms >= SLOW_CALL_MS;
          const msColor = !call.ok ? tone.error : slow ? tone.activity : tone.text;
          const mark = !call.ok ? '✕' : call.cached ? '◌' : call.type === 'Mutation' ? glyph.spark : glyph.dot;
          const markColor = !call.ok ? tone.error : call.cached ? tone.muted : call.type === 'Mutation' ? tone.activity : tone.accent;
          return (
            <Row key={call.id}>
              <Text color={tone.accent}>{selected ? '› ' : '  '}</Text>
              <Text color={badge.label} backgroundColor={badge.background} bold>
                {` ${badge.letter} `}
              </Text>
              <Text color={selected ? tone.accent : call.ok ? tone.text : tone.error}> {padEnd(truncateStart(call.fn, nameWidth), nameWidth)}</Text>
              <Text color={msColor}> {padStart(formatMs(call.ms), MS_WIDTH)}</Text>
              <Text color={markColor}> {mark}</Text>
              {tight ? null : <Text color={tone.muted}> {padStart(formatClockSeconds(call.at), TIME_WIDTH)}</Text>}
            </Row>
          );
        })
      )}
    </Panel>
  );
});
