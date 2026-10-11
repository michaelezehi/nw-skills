/**
 * The plain deck's header: the verbose hero's rule and frame, carrying only the
 * block-digit clock and three stats, memory, cpu and calls. A failing watcher adds a
 * red fourth. Nothing is cut: a stat that cannot fit in full is left out, the rule's
 * right label goes before the title, and a title too long for the rule drops its suffix.
 * Short on rows, the same facts sit on one line.
 */
import { Box, Text } from 'ink';
import type { DeckMeta, ServiceState } from '../types.ts';
import { Panel, Row } from './Panel.tsx';
import { useTone, spaced, FULL_COLS, type Tone } from './theme.ts';
import { blockDigitsWidth, CLOCK_ROWS } from './glyphs.ts';
import { cellWidth, formatCount, formatMb, formatUptime } from './format.ts';
import { Stat, UptimeClock, cpuPercentOf, deckTitle, nodeLabel, watcherSummary } from './Header.tsx';
import { useSecond } from './useFrame.ts';

export interface PlainHeaderProps {
  meta: DeckMeta;
  watchers: ServiceState[];
  totalMemMb: number;
  totalCpu: number;
  callCount: number;
  callErrorCount: number;
  now: number;
  columns: number;
  /** BOXED_HEADER_ROWS for the clock, anything less for the one-line form. */
  rows: number;
}

interface Segment {
  text: string;
  color: string;
}

interface StatSpec {
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
  subColor?: string;
}

const width = (segments: Segment[]): number => segments.reduce((sum, s) => sum + cellWidth(s.text), 0);

/** The deck title whole, or without ` · DEV`, or `DEV`: whichever fits `room`. */
export function fitTitle(meta: Pick<DeckMeta, 'title'>, room: number): string {
  const full = deckTitle(meta);
  if (cellWidth(full) <= room) return full;
  const bare = full.replace(/ · DEV$/, '');
  return cellWidth(bare) <= room ? bare : 'DEV';
}

function statSpecs(props: PlainHeaderProps, tone: Tone): StatSpec[] {
  const specs: StatSpec[] = [
    { label: 'memory', value: formatMb(props.totalMemMb), valueColor: tone.text },
    { label: 'cpu', value: `${Math.round(cpuPercentOf(props.totalCpu))}%`, valueColor: tone.text },
    {
      label: 'calls',
      value: formatCount(props.callCount),
      valueColor: tone.text,
      sub: props.callErrorCount > 0 ? `${formatCount(props.callErrorCount)} failed` : undefined,
      subColor: tone.error,
    },
  ];
  const watch = watcherSummary(props.watchers, tone);
  if (watch.names) {
    specs.push({ label: 'watchers', value: watch.text, valueColor: tone.error, sub: cellWidth(watch.names) <= 15 ? watch.names : undefined, subColor: tone.error });
  }
  return specs;
}

/** Stats left to right, each as wide as its widest line, stopping at the first that does not fit. */
function fitStats(specs: StatSpec[], room: number, gap: number): Array<StatSpec & { width: number }> {
  const out: Array<StatSpec & { width: number }> = [];
  let used = 0;
  for (const spec of specs) {
    const w = Math.max(cellWidth(spaced(spec.label)), cellWidth(spec.value), spec.sub ? cellWidth(spec.sub) : 0);
    const need = (out.length > 0 ? gap : 0) + w;
    if (used + need > room) break;
    out.push({ ...spec, width: w });
    used += need;
  }
  return out;
}

export function PlainHeader(props: PlainHeaderProps) {
  const tone = useTone();
  const { meta, columns, rows } = props;
  if (rows < CLOCK_ROWS + 2) return <PlainHeaderLine {...props} />;
  const title = fitTitle(meta, columns - 6);
  const branch = [meta.branch, nodeLabel(meta.node)].filter(Boolean).join(' · ');
  const right = branch && cellWidth(branch) + 3 <= columns - cellWidth(title) - 6 ? branch : undefined;
  const clockWidth = blockDigitsWidth(formatUptime(props.now - meta.startedAt));
  const gap = columns >= FULL_COLS ? 6 : 4;
  const stats = fitStats(statSpecs(props, tone), columns - 4 - clockWidth - gap, gap);
  return (
    <Panel title={title} right={right} width={columns} rows={rows} titleColor={tone.accent}>
      <Box flexDirection="row" height={CLOCK_ROWS} overflow="hidden">
        <UptimeClock startedAt={meta.startedAt} />
        <Box width={gap} />
        {stats.map((stat, i) => (
          <Stat key={stat.label} label={stat.label} width={stat.width} gap={gap} last={i === stats.length - 1}>
            <Text> </Text>
            <Row color={stat.valueColor}>{stat.value}</Row>
            {stat.sub ? <Row color={stat.subColor}>{stat.sub}</Row> : null}
          </Stat>
        ))}
      </Box>
    </Panel>
  );
}

/** ` TITLE   branch · node 24            up 03:45:19   2.9 GB   cpu 7%   139 calls · 1 failed` */
function PlainHeaderLine(props: PlainHeaderProps) {
  const tone = useTone();
  useSecond();
  const { meta, columns } = props;
  const title = ` ${fitTitle(meta, columns - 1)}`;
  const room = columns - cellWidth(title) - 1;
  const watch = watcherSummary(props.watchers, tone);
  // Each stat ranks by how much it would hurt to lose; the least important goes first.
  const groups: Array<{ rank: number; segments: Segment[] }> = [
    { rank: 2, segments: [{ text: 'up ', color: tone.muted }, { text: formatUptime(Date.now() - meta.startedAt), color: tone.text }] },
    { rank: 3, segments: [{ text: formatMb(props.totalMemMb), color: tone.text }] },
    { rank: 5, segments: [{ text: 'cpu ', color: tone.muted }, { text: `${Math.round(cpuPercentOf(props.totalCpu))}%`, color: tone.text }] },
    { rank: 4, segments: [{ text: formatCount(props.callCount), color: tone.text }, { text: ' calls', color: tone.muted }] },
  ];
  if (props.callErrorCount > 0) groups[3]!.segments.push({ text: ' · ', color: tone.muted }, { text: `${formatCount(props.callErrorCount)} failed`, color: tone.error });
  if (watch.names) {
    const failing = watch.text.startsWith('1 ') ? 'watcher failed' : 'watchers failed';
    groups.push({ rank: 1, segments: [{ text: `${watch.glyph} ${watch.text.replace('failed', failing)}`, color: tone.error }] });
  }
  const statsWidth = (list: typeof groups) => list.reduce((sum, g) => sum + width(g.segments), 0) + 3 * Math.max(0, list.length - 1);
  let shown = groups;
  while (shown.length > 0 && statsWidth(shown) + 3 > room) {
    const drop = shown.reduce((worst, g) => (g.rank > worst.rank ? g : worst));
    shown = shown.filter((g) => g !== drop);
  }
  const branch = [meta.branch, nodeLabel(meta.node)].filter(Boolean).join(' · ');
  const statsW = shown.length > 0 ? statsWidth(shown) + 3 : 0;
  const mid = branch && cellWidth(branch) + 3 <= room - statsW ? branch : '';
  const fill = columns - cellWidth(title) - (mid ? 3 + cellWidth(mid) : 0) - (statsW > 0 ? statsW - 3 : 0) - 1;
  return (
    <Box width={columns} height={1} overflow="hidden">
      <Text wrap="truncate">
        <Text color={tone.accent} bold>
          {title}
        </Text>
        {mid ? <Text color={tone.muted}>   {mid}</Text> : null}
        {' '.repeat(Math.max(0, fill))}
        {shown.map((g, i) => (
          <Text key={g.rank}>
            {i > 0 ? '   ' : ''}
            {g.segments.map((s, j) => (
              <Text key={j} color={s.color}>
                {s.text}
              </Text>
            ))}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
