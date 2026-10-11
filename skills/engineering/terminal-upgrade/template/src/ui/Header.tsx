/**
 * The hero strip: title in the rule, block-digit uptime clock, memory and CPU rings,
 * Convex deployment, call count and the watchers chip. Narrow tiers fold it to
 * one line of plain text.
 */
import os from 'node:os';
import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import type { DeckMeta, ServiceState } from '../types.ts';
import { Panel, Row } from './Panel.tsx';
import { useTone, spaced, type Tone } from './theme.ts';
import { blockDigits, blockDigitsWidth, ring, CLOCK_ROWS } from './glyphs.ts';
import { cellWidth, formatCount, formatMb, formatUptime, padEnd, padStart, truncateEnd, truncateStart } from './format.ts';
import { statusLook } from './sprites.ts';
import { useSecond } from './useFrame.ts';
import type { Tier } from './layout.ts';

export interface HeaderProps {
  meta: DeckMeta;
  convex?: ServiceState;
  watchers: ServiceState[];
  totalMemMb: number;
  totalCpu: number;
  callCount: number;
  callErrorCount: number;
  now: number;
  frame: number;
  /** False once the Convex spinner has run its course; see spin.ts. */
  convexSpinning?: boolean;
  tier: Tier;
  columns: number;
  rows: number;
}

const TOTAL_MB = Math.max(1024, Math.round(os.totalmem() / 1024 / 1024));
const CORES = Math.max(1, os.cpus().length);

/** Summed process cpu as a share of every core, capped at 100. */
export function cpuPercentOf(totalCpu: number): number {
  return Math.min(100, totalCpu / CORES);
}

/** `<TITLE> · DEV` from the config title in the meta, or `DEV` alone when there is none. */
export function deckTitle(meta: Pick<DeckMeta, 'title'>): string {
  const title = (meta.title ?? '').trim().toUpperCase();
  return title ? `${title} · DEV` : 'DEV';
}

export function nodeLabel(node: string): string {
  const major = node.replace(/^v/, '').split('.')[0] ?? node;
  return `node ${major}`;
}

export function watcherSummary(watchers: ServiceState[], tone: Tone): { glyph: string; color: string; text: string; names: string } {
  const failing = watchers.filter((w) => w.status === 'error' || w.status === 'crashed');
  if (watchers.length === 0) return { glyph: '○', color: tone.muted, text: 'none', names: '' };
  if (failing.length > 0) {
    return {
      glyph: '◆',
      color: tone.error,
      text: `${failing.length} failed`,
      names: failing.map((w) => w.label).join(', '),
    };
  }
  const settling = watchers.filter((w) => w.status === 'starting' || w.status === 'compiling').length;
  if (settling > 0) return { glyph: '◐', color: tone.activity, text: `${settling} building`, names: '' };
  return { glyph: '●', color: tone.accent, text: `${watchers.length} ok`, names: '' };
}

/** The uptime is the only part of the deck that changes every second, so it alone ticks. */
function useUptime(startedAt: number): string {
  useSecond();
  return formatUptime(Date.now() - startedAt);
}

export function UptimeText({ startedAt, bold = false }: { startedAt: number; bold?: boolean }) {
  const tone = useTone();
  return (
    <Text color={tone.text} bold={bold}>
      {useUptime(startedAt)}
    </Text>
  );
}

export function UptimeClock({ startedAt }: { startedAt: number }) {
  return <Clock text={useUptime(startedAt)} />;
}

export function Header(props: HeaderProps) {
  const tone = useTone();
  const { meta, tier, columns, rows, now } = props;
  const uptime = formatUptime(now - meta.startedAt);
  const right = [meta.branch, nodeLabel(meta.node)].filter(Boolean).join(' · ');
  const memPercent = (props.totalMemMb / TOTAL_MB) * 100;
  const cpuPercent = cpuPercentOf(props.totalCpu);
  const watch = watcherSummary(props.watchers, tone);
  const title = deckTitle(meta);

  if (tier === 'narrow') {
    // The stats keep their room; a long title gives way, cut on one line.
    const statsWidth = cellWidth(`  ${uptime}  mem ${formatMb(props.totalMemMb)}  cpu ${Math.round(cpuPercent)}%  ${watch.glyph} ${watch.text}`);
    return (
      <Box width={columns} height={1} overflow="hidden">
        <Text wrap="truncate">
          <Text color={tone.accent} bold>
            {' '}
            {truncateEnd(title, Math.max(3, columns - 1 - statsWidth))}
          </Text>
          <Text color={tone.text}>  </Text>
          <UptimeText startedAt={meta.startedAt} />
          <Text color={tone.muted}>  mem </Text>
          <Text color={tone.text}>{formatMb(props.totalMemMb)}</Text>
          <Text color={tone.muted}>  cpu </Text>
          <Text color={tone.text}>{Math.round(cpuPercent)}%</Text>
          <Text color={watch.color}>  {watch.glyph} {watch.text}</Text>
        </Text>
      </Box>
    );
  }

  if (rows < CLOCK_ROWS + 2) {
    return (
      <Panel title={title} right={right} width={columns} rows={rows} titleColor={tone.accent}>
        <Row>
          <UptimeText startedAt={meta.startedAt} bold />
          <Text color={tone.muted}> up</Text>
          <Text color={tone.line}>  ·  </Text>
          <Text color={tone.muted}>MEM </Text>
          <Text color={memPercent > 75 ? tone.activity : tone.accent}>{ring(memPercent)} </Text>
          <Text color={tone.text}>{formatMb(props.totalMemMb)}</Text>
          <Text color={tone.line}>  ·  </Text>
          <Text color={tone.muted}>CPU </Text>
          <Text color={cpuPercent > 75 ? tone.activity : tone.accent}>{ring(cpuPercent)} </Text>
          <Text color={tone.text}>{Math.round(cpuPercent)}%</Text>
          <Text color={tone.line}>  ·  </Text>
          <Text color={tone.muted}>CALLS </Text>
          <Text color={tone.text}>{formatCount(props.callCount)}</Text>
          {props.callErrorCount > 0 ? <Text color={tone.error}> {props.callErrorCount} failed</Text> : null}
          <Text color={tone.line}>  ·  </Text>
          <Text color={tone.muted}>WATCHERS </Text>
          <Text color={watch.color}>
            {watch.glyph} {watch.text}
          </Text>
        </Row>
      </Panel>
    );
  }

  // Clock, gap, and the fixed stat columns with their 2-cell margins add up to 89 cells;
  // the Convex column (plus its own margin) takes the rest.
  const inner = columns - 4;
  const convexWidth = Math.max(22, inner - (blockDigitsWidth(uptime) + 3) - (15 + 2) - (10 + 2) - (11 + 2) - 15 - 2);

  return (
    <Panel title={title} right={right} width={columns} rows={rows} titleColor={tone.accent}>
      <Box flexDirection="row" height={CLOCK_ROWS} overflow="hidden">
        <UptimeClock startedAt={meta.startedAt} />
        <Box width={3} />
        <Stat label="memory" width={15}>
          <Text> </Text>
          <Row>
            <Text color={memPercent > 75 ? tone.activity : tone.accent}>{ring(memPercent)} </Text>
            <Text color={tone.text}>{formatMb(props.totalMemMb)}</Text>
          </Row>
          <Row color={tone.muted}>{`${Math.round(memPercent)}% of ${Math.round(TOTAL_MB / 1024)} GB`}</Row>
        </Stat>
        <Stat label="cpu" width={10}>
          <Text> </Text>
          <Row>
            <Text color={cpuPercent > 75 ? tone.activity : tone.accent}>{ring(cpuPercent)} </Text>
            <Text color={tone.text}>{Math.round(cpuPercent)}%</Text>
          </Row>
          <Row color={tone.muted}>{`${CORES} cores`}</Row>
        </Stat>
        <ConvexStat convex={props.convex} deployment={meta.convexDeployment} frame={props.frame} spinning={props.convexSpinning ?? true} width={convexWidth} />
        <Stat label="calls" width={11}>
          <Text> </Text>
          <Row color={tone.text}>{formatCount(props.callCount)}</Row>
          <Row color={props.callErrorCount > 0 ? tone.error : tone.muted}>
            {props.callErrorCount > 0 ? `${formatCount(props.callErrorCount)} failed` : 'none failed'}
          </Row>
        </Stat>
        <Stat label="watchers" width={15} last>
          <Text> </Text>
          <Row>
            <Text color={watch.color}>
              {watch.glyph} {watch.text}
            </Text>
          </Row>
          <Row color={watch.names ? tone.error : tone.muted}>{watch.names || `${props.watchers.length} packages`}</Row>
        </Stat>
      </Box>
    </Panel>
  );
}

/** A labelled column: the spaced caps label over whatever rows the stat draws, `gap` cells before the next one. */
export function Stat({ label, width, gap = 2, last = false, children }: { label: string; width: number; gap?: number; last?: boolean; children: ReactNode }) {
  const tone = useTone();
  return (
    <Box flexDirection="column" width={width} marginRight={last ? 0 : gap} overflow="hidden">
      <Row color={tone.muted}>{spaced(label)}</Row>
      {children}
    </Box>
  );
}

/** The hero number. Digits in paper, colons in amber. */
export function Clock({ text }: { text: string }) {
  const tone = useTone();
  const rows = blockDigits(text);
  const width = blockDigitsWidth(text);
  return (
    <Box flexDirection="column" width={width} overflow="hidden">
      {rows.map((cells, r) => (
        <Text key={r} wrap="truncate">
          {cells.map((cell, i) => (
            <Text key={i} color={cell.colon ? tone.activity : tone.text}>
              {cell.text}
              {i < cells.length - 1 ? ' ' : ''}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}

function ConvexStat(props: { convex?: ServiceState; deployment?: string; frame: number; spinning: boolean; width: number }) {
  const { convex, deployment, frame, width } = props;
  const tone = useTone();
  const inner = width;
  const look = convex ? statusLook(convex.status, frame, props.spinning, tone) : undefined;
  const port = convex?.port ? `:${convex.port}` : '';
  return (
    <Stat label="convex" width={width}>
      <Text> </Text>
      <Row>
        {look ? (
          <>
            <Text color={look.color}>{look.glyph} </Text>
            <Text color={look.color}>{look.word}</Text>
            <Text color={tone.muted}>{padStart(port, Math.max(0, inner - 2 - look.word.length))}</Text>
          </>
        ) : (
          <Text color={tone.muted}>not running</Text>
        )}
      </Row>
      <Row color={tone.muted}>{padEnd(truncateStart(deployment ?? 'local', inner), inner)}</Row>
    </Stat>
  );
}
