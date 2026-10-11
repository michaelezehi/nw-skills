/**
 * One card per service in the full tier: status glyph, port, runtime line, memory
 * capsule bar, sparkline and the last reload. Narrow tiers draw the same service as a
 * one-line capsule pill. Watch packages never get a card; the header chip has them.
 */
import { memo } from 'react';
import { Box, Text } from 'ink';
import type { ServiceState } from '../types.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { useTone } from './theme.ts';
import { capsule, capsuleBar, sparkline } from './glyphs.ts';
import { formatClock, formatMb, formatMbShort, formatMs, padEnd, padStart, truncateEnd, cellWidth } from './format.ts';
import { glyph, hotColor, isHot, statusLook } from './sprites.ts';
import { PILL_WIDTH } from './layout.ts';

export interface ServiceCardProps {
  service: ServiceState;
  /** Largest memMb across services, for relative bars. */
  maxMemMb: number;
  width: number;
  rows: number;
  selected: boolean;
  focused: boolean;
  frame: number;
  /** False once a starting or compiling spinner has run its course; see spin.ts. */
  spinning?: boolean;
  /** Defaults to the render time. */
  now?: number;
}

export function shortLabel(service: ServiceState): string {
  return (service.label.split(' ')[0] ?? service.label).toUpperCase();
}

export function reloadGlyph(service: ServiceState): string {
  return service.kind === 'convex' ? glyph.push : glyph.bolt;
}

/**
 * "Next.js 16.3.0 · turbopack" reads as "Next 16.3 · turbo". A row too narrow for that
 * drops the bundler, then the version, rather than cutting the text.
 */
export function displayRuntime(runtime: string, width = Infinity): string {
  const short = runtime
    .replace(/^Next\.js\b/, 'Next')
    .replace(/\b(\d+\.\d+)\.\d+\b/, '$1')
    .replace(/\bturbopack\b/i, 'turbo');
  const options = [short, short.split(' · ')[0]!, short.split(' ')[0]!];
  return options.find((option) => cellWidth(option) <= width) ?? '';
}

export const ServiceCard = memo(function ServiceCard({ service, maxMemMb, width, rows, selected, focused, frame, spinning = true, now = Date.now() }: ServiceCardProps) {
  const tone = useTone();
  const inner = panelInner(width);
  const look = statusLook(service.status, frame, spinning, tone);
  const port = service.port ? `:${service.port}` : '';
  const title = service.label.toUpperCase();
  const stopped = service.status === 'stopped' || service.status === 'crashed';

  // Row 0: status glyph and word, port right aligned.
  const statusWidth = Math.max(0, inner - 2 - cellWidth(port));

  // Row 1: runtime, or the route being compiled; cpu right aligned.
  const cpu = service.cpu > 0 ? `${Math.round(service.cpu)}%` : '';
  const runtimeWidth = Math.max(0, inner - cellWidth(cpu) - (cpu ? 1 : 0));
  const runtimeText =
    service.status === 'compiling' && service.detail
      ? service.detail
      : service.runtime
        ? displayRuntime(service.runtime, runtimeWidth)
        : stopped
          ? `exit ${service.exitCode ?? '?'}`
          : '';

  // Row 2: capsule bar and memory.
  const memText = formatMb(service.memMb);
  const barInner = Math.max(2, inner - 2 - 1 - 7);
  const bar = capsuleBar(maxMemMb > 0 ? (service.memMb / maxMemMb) * 100 : 0, barInner);

  // Row 3: sparkline, then the last reload or start time.
  const reload = service.lastReload;
  const tail = reload
    ? `${reload.ms !== undefined ? formatMs(reload.ms) : service.kind === 'convex' ? 'push' : 'reload'} · ${formatClock(reload.at)}`
    : service.startedAt
      ? `started ${formatClock(service.startedAt)}`
      : '';
  const tailGlyph = reload ? reloadGlyph(service) : glyph.restart;
  const sparkWidth = Math.max(0, Math.min(12, inner - cellWidth(tail) - 3));

  return (
    <Panel title={title} width={width} rows={rows} focused={focused && selected} titleColor={selected ? tone.accent : tone.text}>
      <Row>
        <Text color={look.color}>{look.glyph} </Text>
        <Text color={look.color}>{padEnd(look.word, statusWidth)}</Text>
        <Text color={tone.muted}>{port}</Text>
      </Row>
      <Row>
        <Text color={service.status === 'compiling' ? tone.activity : tone.muted}>{padEnd(truncateEnd(runtimeText, runtimeWidth), runtimeWidth)}</Text>
        {cpu ? <Text color={tone.text}> {cpu}</Text> : null}
      </Row>
      <Row>
        <Text color={tone.line}>{capsule.left}</Text>
        <Text color={service.memMb / Math.max(1, maxMemMb) > 0.85 ? tone.activity : tone.accent}>{bar.filled}</Text>
        <Text color={tone.line}>{bar.empty}</Text>
        <Text color={tone.line}>{capsule.right}</Text>
        <Text color={tone.text}>{padStart(memText, 7)}</Text>
      </Row>
      <Row>
        <Text color={tone.activity} dimColor={!isHot(reload?.at, now)}>
          {sparkline(service.memHistory, sparkWidth)}
        </Text>
        <Text color={hotColor(reload?.at, now, tone)}> {tailGlyph} </Text>
        <Text color={tone.text}>{tail}</Text>
      </Row>
    </Panel>
  );
});

export interface PillProps {
  service: ServiceState;
  selected: boolean;
  focused: boolean;
  frame: number;
  spinning?: boolean;
  /** PILL_WIDTH with the port, or PILL_COMPACT_WIDTH without it. */
  width?: number;
}

/** `▕ ● ADMIN   :3010  1.1G ▏`, exactly `width` cells; compact drops the port. */
export function ServicePill({ service, selected, focused, frame, spinning = true, width = PILL_WIDTH }: PillProps) {
  const tone = useTone();
  const look = statusLook(service.status, frame, spinning, tone);
  const cap = selected ? (focused ? tone.accent : tone.text) : tone.line;
  const compact = width < PILL_WIDTH;
  const label = padEnd(shortLabel(service), compact ? 6 : 7);
  const port = padEnd(service.port ? `:${service.port}` : '', 5);
  const mem = padStart(formatMbShort(service.memMb), 5);
  return (
    <Box width={width} height={1} marginRight={1} overflow="hidden">
      <Text wrap="truncate">
        <Text color={cap}>{capsule.left}</Text>
        <Text color={look.color}> {look.glyph} </Text>
        <Text color={selected ? tone.accent : tone.text} bold={selected}>
          {label}
        </Text>
        {compact ? null : <Text color={tone.muted}> {port}</Text>}
        <Text color={tone.text}> {mem} </Text>
        <Text color={cap}>{capsule.right}</Text>
      </Text>
    </Box>
  );
}

export interface PillStripProps {
  services: ServiceState[];
  perRow: number;
  pillWidth?: number;
  rows: number;
  columns: number;
  selectedIndex: number;
  focused: boolean;
  frame: number;
  /** Ids whose spinner still runs; every service spins when omitted. */
  spinning?: ReadonlySet<string>;
}

export function PillStrip({ services, perRow, pillWidth = PILL_WIDTH, rows, columns, selectedIndex, focused, frame, spinning }: PillStripProps) {
  const lines: ServiceState[][] = [];
  for (let i = 0; i < services.length; i += perRow) lines.push(services.slice(i, i + perRow));
  return (
    <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
      {lines.map((line, r) => (
        <Box key={r} flexDirection="row" height={1} paddingLeft={1} overflow="hidden">
          {line.map((service, c) => (
            <ServicePill
              key={service.id}
              service={service}
              selected={r * perRow + c === selectedIndex}
              focused={focused}
              frame={frame}
              spinning={spinning ? spinning.has(service.id) : true}
              width={pillWidth}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}
