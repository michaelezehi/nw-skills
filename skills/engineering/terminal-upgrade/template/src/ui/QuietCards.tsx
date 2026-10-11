/**
 * The quiet state's service cards: with no feed and no logs under them, each card has
 * the room to explain itself, label then value, memory with a bar and a plain gloss,
 * cpu, uptime, reloads and restarts. The grid from grid.ts decides the rows; the last
 * row's cards stretch to the full width. A row is as tall as its fullest card, not the
 * screen, and a thin rule sits before each fact so the card reads as a list.
 */
import { Box, Text } from 'ink';
import type { DevError, ServiceState } from '../types.ts';
import { Panel, Row, Blank, panelInner } from './Panel.tsx';
import { useTone, serviceHue, type Tone } from './theme.ts';
import { statusLook, type StatusLook } from './sprites.ts';
import { osc8 } from './links.ts';
import { fitLabel } from './PlainCards.tsx';
import { MIN_BIG_ROWS, type GridPlan } from './grid.ts';
import { fitLines, quietLines, width, type CardLine, type Segment } from './quietLines.ts';

export interface QuietGridProps {
  apps: ServiceState[];
  grid: GridPlan;
  errors: readonly DevError[];
  columns: number;
  selectedIndex: number;
  focused: boolean;
  frame: number;
  spinning: ReadonlySet<string>;
  now: number;
  /** Verbose adds the memory trend. */
  detail: boolean;
}

function Segments({ segments }: { segments: readonly Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (
        <Text key={i} color={s.color} bold={s.bold} dimColor={s.dim}>
          {s.href ? osc8(s.href, s.text) : s.text}
        </Text>
      ))}
    </>
  );
}

/** One row: the left segments, then the right ones against the edge when both fit. */
function LineRow({ line, inner }: { line: CardLine; inner: number }) {
  const leftWidth = width(line.left);
  const right = line.right && leftWidth + 1 + width(line.right) <= inner ? line.right : [];
  const pad = inner - leftWidth - width(right);
  return (
    <Row>
      <Segments segments={line.left} />
      {right.length > 0 ? <Text>{' '.repeat(Math.max(0, pad))}</Text> : null}
      <Segments segments={right} />
    </Row>
  );
}

interface BigCardProps {
  service: ServiceState;
  maxMemMb: number;
  error?: DevError;
  width: number;
  rows: number;
  selected: boolean;
  focused: boolean;
  frame: number;
  spinning: boolean;
  now: number;
  detail: boolean;
  /** The tallest head in this card's row. */
  headRows: number;
}

/** Rows a card's lines take, rules included: the head (padded to `headRows`), then each fact group behind a separator. */
export function naturalRows(lines: readonly CardLine[], headRows: number): number {
  const body = lines.filter((l) => !l.head);
  return 2 + headRows + body.length + body.filter(opensGroup).length;
}

/** A fact with its own label starts a group; a gloss under it does not. */
function opensGroup(line: CardLine): boolean {
  return (line.left[0]?.text.trim() ?? '') !== '';
}

function cardLines(service: ServiceState, inner: number, maxMemMb: number, error: DevError | undefined, now: number, detail: boolean, look: StatusLook, tone: Tone): CardLine[] {
  return quietLines({ service, look, maxMemMb, error, now, width: inner, detail, tone });
}

function BigCard({ service, maxMemMb, error, width: cardWidth, rows, headRows, selected, focused, frame, spinning, now, detail }: BigCardProps) {
  const tone = useTone();
  const inner = panelInner(cardWidth);
  const look = statusLook(service.status, frame, spinning, tone);
  const content = Math.max(0, rows - 2);
  const lines = fitLines(cardLines(service, inner, maxMemMb, error, now, detail, look, tone), content);
  const head = lines.filter((l) => l.head);
  const body = lines.filter((l) => !l.head);
  const spare = content - lines.length;
  // Pad the head to the row's tallest, so neighbours' facts start on the same row.
  const reserve = Math.min(Math.max(0, headRows - head.length), spare);
  // A thin rule before each fact group when every group can have one.
  const ruled = body.filter(opensGroup).length <= spare - reserve;
  const rule = '┈'.repeat(inner);
  return (
    <Panel title={fitLabel(service, cardWidth - 6)} width={cardWidth} rows={rows} focused={focused && selected} titleColor={selected ? tone.accent : serviceHue(tone, service.id, tone.text)}>
      {head.map((line, i) => (
        <LineRow key={`h${i}`} line={line} inner={inner} />
      ))}
      <Blank count={reserve} />
      {body.map((line, i) => (
        <Box key={`b${i}`} flexDirection="column">
          {ruled && opensGroup(line) ? <Row color={tone.line}>{rule}</Row> : null}
          <LineRow line={line} inner={inner} />
        </Box>
      ))}
    </Panel>
  );
}

export function QuietGrid({ apps, grid, errors, columns, selectedIndex, focused, frame, spinning, now, detail }: QuietGridProps) {
  const tone = useTone();
  const maxMemMb = apps.reduce((max, s) => Math.max(max, s.memMb), 0);
  const height = grid.heights.reduce((sum, h) => sum + h, 0);
  const newest = [...errors].reverse();
  const errorOf = (id: string) => newest.find((e) => e.service === id);
  // Each card row is as tall as its fullest card, never more than its share of the screen.
  let start = 0;
  const fit = grid.widths.map((row, r) => {
    const sets = row.map((cardWidth, c) => {
      const service = apps[start + c];
      if (!service) return [];
      const look = statusLook(service.status, frame, spinning.has(service.id), tone);
      return cardLines(service, panelInner(cardWidth), maxMemMb, errorOf(service.id), now, detail, look, tone);
    });
    start += row.length;
    const headRows = Math.max(1, ...sets.map((lines) => lines.filter((l) => l.head).length));
    const natural = Math.max(MIN_BIG_ROWS, ...sets.map((lines) => naturalRows(lines, headRows)));
    return { headRows, rows: Math.min(grid.heights[r]!, natural) };
  });
  let offset = 0;
  return (
    <Box flexDirection="column" width={columns} height={height} overflow="hidden">
      {grid.widths.map((row, r) => {
        const start = offset;
        offset += row.length;
        return (
          <Box key={r} flexDirection="row" width={columns} height={fit[r]!.rows} overflow="hidden">
            {row.map((cardWidth, c) => {
              const service = apps[start + c];
              if (!service) return <Box key={c} width={cardWidth} />;
              return (
                <BigCard
                  key={service.id}
                  service={service}
                  maxMemMb={maxMemMb}
                  error={errorOf(service.id)}
                  width={cardWidth}
                  rows={fit[r]!.rows}
                  headRows={fit[r]!.headRows}
                  selected={start + c === selectedIndex}
                  focused={focused}
                  frame={spinning.has(service.id) ? frame : 0}
                  spinning={spinning.has(service.id)}
                  now={now}
                  detail={detail}
                />
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
