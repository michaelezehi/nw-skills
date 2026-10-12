/**
 * The hero strip: title in the rule, block-digit uptime clock, memory and CPU rings,
 * Convex deployment, call count and the watchers chip. Narrow tiers fold it to
 * one line of plain text.
 */
import os from 'node:os';
import { Box, Text } from 'ink';
import type { DeckMeta, ServiceState } from '../types.ts';
import { Panel, Row } from './Panel.tsx';
import { useTone, statHue, type Tone } from './theme.ts';
import { blockDigits, blockDigitsWidth, ring, CLOCK_ROWS } from './glyphs.ts';
import { cellWidth, formatCount, formatMb, formatUptime, truncateEnd } from './format.ts';
import { statusLook } from './sprites.ts';
import { MACHINE_ALARM_PERCENT } from './memAlarm.ts';
import { TileRow, type TileSpec } from './StatTiles.tsx';
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

export const TOTAL_MB = Math.max(1024, Math.round(os.totalmem() / 1024 / 1024));
const CORES = Math.max(1, os.cpus().length);
/** Cells between the clock and the stat tiles. */
export const CLOCK_GAP = 2;

/** Summed process cpu as a share of every core, capped at 100. */
export function cpuPercentOf(totalCpu: number): number {
  return Math.min(100, totalCpu / CORES);
}

/** The mode word, `DEV` unless `devdeck run` named another. */
export const deckMode = (meta: Pick<DeckMeta, 'mode'>): string => (meta.mode ?? '').trim().toUpperCase() || 'DEV';

/** `<TITLE> · <MODE>` from the meta, or the mode alone when there is no title. */
export function deckTitle(meta: Pick<DeckMeta, 'title' | 'mode'>): string {
  const title = (meta.title ?? '').trim().toUpperCase();
  const mode = deckMode(meta);
  return title ? `${title} · ${mode}` : mode;
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
          {props.watchers.length > 0 ? <Text color={watch.color}>  {watch.glyph} {watch.text}</Text> : null}
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
          {props.watchers.length > 0 ? (
            <>
              <Text color={tone.line}>  ·  </Text>
              <Text color={tone.muted}>WATCHERS </Text>
              <Text color={watch.color}>
                {watch.glyph} {watch.text}
              </Text>
            </>
          ) : null}
        </Row>
      </Panel>
    );
  }

  const memTrouble = memPercent >= MACHINE_ALARM_PERCENT;
  const look = props.convex ? statusLook(props.convex.status, props.frame, props.convexSpinning ?? true, tone) : undefined;
  const convexPort = props.convex?.port ? `:${props.convex.port}` : '';
  const tiles: TileSpec[] = [
    {
      label: 'MEMORY',
      tint: memTrouble ? tone.error : statHue(tone, 'memory', tone.muted),
      border: memTrouble ? tone.error : undefined,
      left: [
        { text: `${ring(memPercent)} `, color: memTrouble ? tone.error : memPercent > 75 ? tone.activity : statHue(tone, 'memory', tone.accent) },
        { text: formatMb(props.totalMemMb), color: memTrouble ? tone.error : tone.text },
      ],
      right: { text: `${Math.round(memPercent)}% of ${Math.round(TOTAL_MB / 1024)} GB`, color: tone.muted },
    },
    {
      label: 'CPU',
      tint: statHue(tone, 'cpu', tone.muted),
      left: [
        { text: `${ring(cpuPercent)} `, color: cpuPercent > 75 ? tone.activity : statHue(tone, 'cpu', tone.accent) },
        { text: `${Math.round(cpuPercent)}%`, color: tone.text },
      ],
      right: { text: `${CORES} cores`, color: tone.muted },
    },
    {
      label: 'CONVEX',
      tint: statHue(tone, 'convex', tone.muted),
      left: look
        ? [
            { text: `${look.glyph} ${look.word}`, color: look.color },
            ...(convexPort ? [{ text: ' ', color: tone.muted }, { text: convexPort, color: tone.muted, href: props.convex!.url ?? `http://localhost:${props.convex!.port}` }] : []),
          ]
        : [{ text: 'not running', color: tone.muted }],
      right: { text: meta.convexDeployment ?? 'local', color: tone.muted },
      shrinkRight: true,
    },
    {
      label: 'CALLS',
      tint: statHue(tone, 'calls', tone.muted),
      left: [{ text: formatCount(props.callCount), color: statHue(tone, 'calls', tone.text) }],
      right: props.callErrorCount > 0 ? { text: `${formatCount(props.callErrorCount)} failed`, color: tone.error } : undefined,
    },
  ];
  if (props.watchers.length > 0) {
    tiles.push(
      {
        label: 'WATCHERS',
        tint: statHue(tone, 'watchers', tone.muted),
        left: [{ text: `${watch.glyph} ${watch.text}`, color: watch.color }],
        right: watch.names ? { text: watch.names, color: tone.error } : { text: `${props.watchers.length} packages`, color: tone.muted },
      },
    );
  }
  const room = columns - 4 - blockDigitsWidth(uptime) - CLOCK_GAP;

  return (
    <Panel title={title} right={right} width={columns} rows={rows} titleColor={tone.accent}>
      <Box flexDirection="row" height={CLOCK_ROWS} overflow="hidden">
        <UptimeClock startedAt={meta.startedAt} />
        <Box width={CLOCK_GAP} />
        <TileRow specs={tiles} room={room} grow="CONVEX" />
      </Box>
    </Panel>
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
