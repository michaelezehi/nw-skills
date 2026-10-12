/**
 * The log pane under the dashboard: a rule naming every service with the logged one in
 * yellow, then the tail of that service's raw lines from the supervisor's ring buffer.
 * Follows live output unless scrolled or paused, in which case it holds a frozen copy.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import type { DeckControls, ServiceState } from '../types.ts';
import { EmptyRow, Blank } from './Panel.tsx';
import { box } from './glyphs.ts';
import { useTone } from './theme.ts';
import { cellWidth, truncateEnd } from './format.ts';

export interface LogPaneProps {
  services: ServiceState[];
  selectedIndex: number;
  controls: DeckControls;
  columns: number;
  rows: number;
  /** Lines scrolled up from the tail. 0 follows live output. */
  scroll: number;
  paused: boolean;
  /** Receives the furthest this pane can scroll, so the reducer can clamp to it. */
  scrollMax?: { current: number };
  /** Receives the lines on screen, so `y` can copy exactly what is shown. */
  window?: { current: readonly string[] };
  /** Wraps `file:line:col` references in terminal hyperlinks for the logged service. */
  link?: (serviceId: string, line: string) => string;
}

/**
 * The service's raw lines. Live, it re-renders on every new line. Frozen (paused or
 * scrolled up), it holds a copy taken at the moment it froze, so the pane stops moving
 * and the scroll offset does not drift while the ring buffer rotates.
 */
export function useRawLines(controls: DeckControls, id: string, frozen: boolean): readonly string[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (frozen) return;
    return controls.onRaw(id, () => setTick((t) => t + 1));
  }, [controls, id, frozen]);
  const snapshot = useRef<{ id: string; lines: readonly string[] } | null>(null);
  if (!frozen) snapshot.current = null;
  else if (snapshot.current?.id !== id) snapshot.current = { id, lines: [...controls.rawLines(id)] };
  return snapshot.current?.lines ?? controls.rawLines(id);
}

const ERRORISH = /\b(error|failed|exception|cannot|unhandled)\b/i;

export function isErrorish(line: string): boolean {
  return ERRORISH.test(line);
}

export function LogPane({ services, selectedIndex, controls, columns, rows, scroll, paused, scrollMax, window, link }: LogPaneProps) {
  const tone = useTone();
  const service = services[Math.min(selectedIndex, services.length - 1)];
  const visible = Math.max(0, rows - 1);
  const lines = useRawLines(controls, service?.id ?? '', paused || scroll > 0);
  if (scrollMax) scrollMax.current = Math.max(0, lines.length - visible);
  if (!service || rows < 2) return null;
  const end = Math.max(0, lines.length - scroll);
  const start = Math.max(0, end - visible);
  const shown = lines.slice(start, end);
  if (window) window.current = shown;
  const position = lines.length === 0 ? '' : scroll > 0 ? `${start + 1} to ${end} of ${lines.length}` : `${lines.length} lines · live`;
  const right = [paused ? 'paused' : '', position].filter(Boolean).join(' · ');

  return (
    <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
      <LogRule services={services} selectedIndex={selectedIndex} columns={columns} right={right} rightColor={scroll > 0 || paused ? tone.activity : tone.muted} />
      {shown.length === 0 ? (
        <>
          <Blank count={Math.floor((visible - 1) / 2)} />
          <EmptyRow width={columns} glyph="○" glyphColor={tone.accent} text="nothing logged yet" />
        </>
      ) : (
        shown.map((line, i) => (
          <Text key={start + i} wrap="truncate">
            {' '}
            <Text color={isErrorish(line) ? tone.error : tone.text}>{linked(truncateEnd(line.replace(/\t/g, '  '), columns - 1), service.id, link)}</Text>
          </Text>
        ))
      )}
    </Box>
  );
}

const linked = (text: string, id: string, link?: (serviceId: string, line: string) => string): string => (link ? link(id, text) : text);

const OUTPUT = 'OUTPUT';

/** `── OUTPUT   web   admin   docs   api ───────── 312 lines · live ──` across the full width. */
function LogRule({ services, selectedIndex, columns, right, rightColor }: { services: ServiceState[]; selectedIndex: number; columns: number; right: string; rightColor: string }) {
  const tone = useTone();
  const names = services.map((s) => s.label.toLowerCase());
  const namesWidth = cellWidth(OUTPUT) + names.reduce((sum, n) => sum + cellWidth(n), 0) + 3 * names.length;
  // "── " + names + " " + fill + (" " + right + " ──" | "──")
  let rightLabel = right;
  let fill = columns - 3 - namesWidth - 1 - (rightLabel ? cellWidth(rightLabel) + 4 : 2);
  if (fill < 0 && rightLabel) {
    rightLabel = '';
    fill = columns - 3 - namesWidth - 1 - 2;
  }
  return (
    <Text wrap="truncate">
      <Text color={tone.line}>{box.h}{box.h} </Text>
      <Text color={tone.text} bold>
        {OUTPUT}
      </Text>
      {names.map((name, i) => (
        <Text key={name} color={i === selectedIndex ? tone.accent : tone.muted} bold={i === selectedIndex}>
          {'   '}
          {name}
        </Text>
      ))}
      <Text color={tone.line}> {box.h.repeat(Math.max(0, fill))}</Text>
      {rightLabel ? <Text color={rightColor}> {rightLabel}</Text> : null}
      <Text color={tone.line}>{rightLabel ? ` ${box.h}${box.h}` : `${box.h}${box.h}`}</Text>
    </Text>
  );
}
