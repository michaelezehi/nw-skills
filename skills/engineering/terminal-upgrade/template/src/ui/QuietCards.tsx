/**
 * The quiet state's service cards: with no feed and no logs under them, each card has
 * the room to explain itself, label then value, memory with a bar and a plain gloss,
 * cpu, uptime, reloads and restarts. The grid from grid.ts decides the rows; the last
 * row's cards stretch to the full width. Content starts at the top of the card, with a gap
 * after the status group and, when every fact can have one, a row of air between facts.
 */
import { Box, Text } from 'ink';
import type { DevError, ServiceState } from '../types.ts';
import { Panel, Row, Blank, panelInner } from './Panel.tsx';
import { useTone } from './theme.ts';
import { statusLook } from './sprites.ts';
import { osc8 } from './links.ts';
import { fitLabel } from './PlainCards.tsx';
import type { GridPlan } from './grid.ts';
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
}

function BigCard({ service, maxMemMb, error, width: cardWidth, rows, selected, focused, frame, spinning, now, detail }: BigCardProps) {
  const tone = useTone();
  const inner = panelInner(cardWidth);
  const look = statusLook(service.status, frame, spinning, tone);
  const content = Math.max(0, rows - 2);
  const lines = fitLines(quietLines({ service, look, maxMemMb, error, now, width: inner, detail, tone }), content);
  const head = lines.filter((l) => l.head);
  const body = lines.filter((l) => !l.head);
  const spare = content - lines.length;
  // A card with only its status line keeps the second head row blank, so the facts start
  // on the same row as a neighbour that is compiling or erroring; then one row of air.
  const reserve = spare >= 2 && head.length === 1 ? 1 : 0;
  const gap = body.length > 0 && head.length > 0 && spare - reserve > 0 ? 1 : 0;
  // A row of air before each fact (a gloss stays with its fact) when the card has room for
  // all of them, so a tall card reads evenly instead of leaving its bottom half empty.
  const opens = body.map((line, i) => i > 0 && (line.left[0]?.text.trim() ?? '') !== '');
  const airy = opens.filter(Boolean).length <= spare - reserve - gap;
  return (
    <Panel title={fitLabel(service, cardWidth - 6)} width={cardWidth} rows={rows} focused={focused && selected} titleColor={selected ? tone.accent : tone.text}>
      {head.map((line, i) => (
        <LineRow key={`h${i}`} line={line} inner={inner} />
      ))}
      <Blank count={reserve + gap} />
      {body.map((line, i) => (
        <Box key={`b${i}`} flexDirection="column">
          {airy && opens[i] ? <Blank count={1} /> : null}
          <LineRow line={line} inner={inner} />
        </Box>
      ))}
    </Panel>
  );
}

export function QuietGrid({ apps, grid, errors, columns, selectedIndex, focused, frame, spinning, now, detail }: QuietGridProps) {
  const maxMemMb = apps.reduce((max, s) => Math.max(max, s.memMb), 0);
  const height = grid.heights.reduce((sum, h) => sum + h, 0);
  const newest = [...errors].reverse();
  let offset = 0;
  return (
    <Box flexDirection="column" width={columns} height={height} overflow="hidden">
      {grid.widths.map((row, r) => {
        const start = offset;
        offset += row.length;
        return (
          <Box key={r} flexDirection="row" width={columns} height={grid.heights[r]} overflow="hidden">
            {row.map((cardWidth, c) => {
              const service = apps[start + c];
              if (!service) return <Box key={c} width={cardWidth} />;
              return (
                <BigCard
                  key={service.id}
                  service={service}
                  maxMemMb={maxMemMb}
                  error={newest.find((e) => e.service === service.id)}
                  width={cardWidth}
                  rows={grid.heights[r]!}
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
