/**
 * The plain deck's service strip: the verbose card frame with two rows, status and
 * port, then memory and the last thing that happened. A field that cannot fit in full
 * is left out rather than cut. Below card width the strip is the shared pill row.
 */
import { Box, Text } from 'ink';
import type { ServiceState } from '../types.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { PillStrip, reloadGlyph, shortLabel } from './ServiceCard.tsx';
import { hotColor, statusLook } from './sprites.ts';
import { useTone, type Tone } from './theme.ts';
import { cellWidth, formatClock, formatMb, formatMs } from './format.ts';
import type { PlainLayout } from './plainLayout.ts';
import { portLink } from './links.ts';

export interface PlainStripProps {
  apps: ServiceState[];
  layout: PlainLayout;
  selectedIndex: number;
  focused: boolean;
  frame: number;
  spinning: ReadonlySet<string>;
  now: number;
}

interface Segment {
  text: string;
  color: string;
}

const width = (segments: Segment[]): number => segments.reduce((sum, s) => sum + cellWidth(s.text), 0);

/**
 * The right side of the memory row: the route compiling, the exit code, the last reload
 * or push, else the start time. The fullest form that fits `room`, or nothing.
 */
export function cardTail(service: ServiceState, now: number, room: number, tone: Tone): Segment[] {
  const options: Segment[][] = [];
  if (service.status === 'compiling' && service.detail) options.push([{ text: service.detail, color: tone.activity }]);
  if (service.status === 'stopped' || service.status === 'crashed') {
    options.push([{ text: `exit ${service.exitCode ?? '?'}`, color: service.status === 'crashed' ? tone.error : tone.muted }]);
  }
  const reload = service.lastReload;
  if (reload) {
    const mark: Segment = { text: `${reloadGlyph(service)} `, color: hotColor(reload.at, now, tone) };
    const ms = reload.ms !== undefined ? formatMs(reload.ms) : '';
    const at = formatClock(reload.at);
    const what = reload.route ?? (service.kind === 'convex' ? 'pushed' : 'reload');
    const texts = reload.route ? [`${what} ${ms || at}`, what, ms || at] : [`${what} ${at}`, what];
    for (const text of texts) options.push([mark, { text, color: tone.text }]);
  }
  if (service.startedAt) options.push([{ text: `started ${formatClock(service.startedAt)}`, color: tone.muted }]);
  return options.find((option) => width(option) <= room) ?? [];
}

/** The label in caps, its first word when the rule is too short for it, else nothing. */
export function fitLabel(service: ServiceState, room: number): string {
  const full = service.label.toUpperCase();
  if (cellWidth(full) <= room) return full;
  const short = shortLabel(service);
  return cellWidth(short) <= room ? short : '';
}

interface CardProps {
  service: ServiceState;
  width: number;
  rows: number;
  selected: boolean;
  focused: boolean;
  frame: number;
  spinning: boolean;
  now: number;
}

function PlainCard({ service, width: cardWidth, rows, selected, focused, frame, spinning, now }: CardProps) {
  const tone = useTone();
  const inner = panelInner(cardWidth);
  const look = statusLook(service.status, frame, spinning, tone);
  const status = `${look.glyph} ${look.word}`;
  const port = service.port ? `:${service.port}` : '';
  const showPort = port !== '' && cellWidth(status) + 1 + cellWidth(port) <= inner;
  const mem = formatMb(service.memMb);
  const tail = cardTail(service, now, inner - cellWidth(mem) - 1, tone);
  return (
    <Panel title={fitLabel(service, cardWidth - 6)} width={cardWidth} rows={rows} focused={focused && selected} titleColor={selected ? tone.accent : tone.text}>
      <Row>
        <Text color={look.color}>{status}</Text>
        {showPort ? <Text color={tone.muted}>{' '.repeat(inner - cellWidth(status) - cellWidth(port))}{portLink(service, port)}</Text> : null}
      </Row>
      <Row>
        <Text color={tone.text}>{mem}</Text>
        <Text>{' '.repeat(Math.max(1, inner - cellWidth(mem) - width(tail)))}</Text>
        {tail.map((s, i) => (
          <Text key={i} color={s.color}>
            {s.text}
          </Text>
        ))}
      </Row>
    </Panel>
  );
}

export function PlainStrip({ apps, layout, selectedIndex, focused, frame, spinning, now }: PlainStripProps) {
  if (layout.services < 1 || apps.length === 0) return null;
  if (layout.cardWidth > 0) {
    return (
      <Box flexDirection="row" width={layout.columns} height={layout.services} overflow="hidden">
        {apps.map((service, i) => (
          <PlainCard
            key={service.id}
            service={service}
            width={i === apps.length - 1 ? layout.columns - layout.cardWidth * (apps.length - 1) : layout.cardWidth}
            rows={layout.services}
            selected={i === selectedIndex}
            focused={focused}
            frame={spinning.has(service.id) ? frame : 0}
            spinning={spinning.has(service.id)}
            now={now}
          />
        ))}
      </Box>
    );
  }
  return (
    <PillStrip services={apps} perRow={layout.pillsPerRow} pillWidth={layout.pillWidth} rows={layout.services} columns={layout.columns} selectedIndex={selectedIndex} focused={focused} frame={frame} spinning={spinning} />
  );
}
