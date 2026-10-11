/**
 * The calm default: a title line, one row per service, the watchers, and LATEST, a
 * short feed of notable things. No boxes; an open view takes the rows under the title.
 */
import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import type { ConvexCall, DeckMeta, DevError, DevEvent, ServiceState } from '../types.ts';
import { useTone, spaced, SLOW_CALL_MS, type Tone } from './theme.ts';
import { Blank } from './Panel.tsx';
import { ErrorTray } from './ErrorTray.tsx';
import { cpuPercentOf, deckTitle, watcherSummary } from './Header.tsx';
import { badgeFor } from './ConvexCalls.tsx';
import { lookFor } from './Timeline.tsx';
import { reloadGlyph } from './ServiceCard.tsx';
import { hotColor, statusLook } from './sprites.ts';
import { useSecond } from './useFrame.ts';
import { latestItems, type LatestItem } from './latest.ts';
import type { PlainLayout } from './plainLayout.ts';
import { cellWidth, formatClock, formatClockSeconds, formatCount, formatMb, formatMs, formatUptime, padEnd, padStart, truncateEnd, truncateStart } from './format.ts';

export interface PlainViewProps {
  meta: DeckMeta;
  apps: ServiceState[];
  watchers: ServiceState[];
  events: readonly DevEvent[];
  calls: readonly ConvexCall[];
  errors: readonly DevError[];
  callCount: number;
  callErrorCount: number;
  totalMemMb: number;
  totalCpu: number;
  layout: PlainLayout;
  selectedIndex: number;
  /** The service rows hold the focus, so the amber mark shows. */
  focused: boolean;
  errorsFocused: boolean;
  errorIndex: number;
  frame: number;
  spinning: ReadonlySet<string>;
  now: number;
  /** An open view (error card, key sheet) drawn in place of the rows. */
  view: ReactNode | null;
}

const LABEL_W = 12;
const PORT_W = 7;
const STATUS_W = 10;
const MEM_W = 7;
/** ` › ● ` + label + port + status + memory + four cells of air. */
const ROW_FIXED = 5 + LABEL_W + PORT_W + STATUS_W + MEM_W + 4;
const TIME_W = 8;
const MS_W = 7;
/** Three cells of indent, the time, three cells, the glyph, two cells, the body, the duration. */
const LATEST_FIXED = 3 + TIME_W + 3 + 1 + 2 + MS_W;
/** On wide screens the duration column stays within reading distance of the text. */
const LATEST_BODY_MAX = 72;

interface Segment {
  text: string;
  color: string;
}

/** Clip segments to `width` cells, keeping the start. */
function clip(segments: Segment[], width: number): Segment[] {
  const out: Segment[] = [];
  let used = 0;
  for (const s of segments) {
    const room = width - used;
    if (room <= 0) break;
    const text = truncateEnd(s.text, room);
    out.push({ text, color: s.color });
    used += cellWidth(text);
  }
  return out;
}

export function PlainView(props: PlainViewProps) {
  const tone = useTone();
  const { layout, apps, view } = props;
  const height = layout.rows - layout.logPane - layout.footer;
  return (
    <Box flexDirection="column" width={layout.columns} height={height} overflow="hidden">
      {layout.title > 0 ? <PlainTitle {...props} /> : null}
      {view ?? (
        <>
          <Blank count={layout.gapTop} />
          {apps.slice(0, layout.services).map((service, i) => (
            <ServiceRow key={service.id} service={service} marked={props.focused && i === props.selectedIndex} {...props} />
          ))}
          {layout.watchers > 0 ? <WatcherRow watchers={props.watchers} /> : null}
          <Blank count={layout.gapMid} />
          {layout.heading > 0 ? <Text color={tone.muted}>   {spaced('latest')}</Text> : null}
          <Box flexDirection="column" height={layout.latest} overflow="hidden">
            {latestItems(props.events, props.calls, layout.latest).map((item) => (
              <LatestRow key={`${item.type}${item.id}`} item={item} columns={layout.columns} now={props.now} />
            ))}
          </Box>
        </>
      )}
      <ErrorTray errors={props.errors} rows={layout.tray} columns={layout.columns} focused={props.errorsFocused} selectedIndex={props.errorIndex} />
    </Box>
  );
}

/** ` <TITLE> · DEV   branch · node 24                up 03:45:19   2.8 GB   cpu 31%` */
function PlainTitle({ meta, totalMemMb, totalCpu, layout }: PlainViewProps) {
  const tone = useTone();
  useSecond();
  const columns = layout.columns;
  const uptime = formatUptime(Date.now() - meta.startedAt);
  const stats: Segment[] = [
    { text: 'up ', color: tone.muted },
    { text: uptime, color: tone.text },
    { text: '   ', color: tone.muted },
    { text: formatMb(totalMemMb), color: tone.text },
    { text: '   cpu ', color: tone.muted },
    { text: `${Math.round(cpuPercentOf(totalCpu))}%`, color: tone.text },
  ];
  const statsWidth = stats.reduce((sum, s) => sum + cellWidth(s.text), 0);
  // A long title gives way to the stats, cut on one line with the usual 3-cell gap before them.
  const title = ` ${truncateEnd(deckTitle(meta), Math.max(3, columns - statsWidth - 5))}`;
  const meta2 = [meta.branch, `node ${meta.node.replace(/^v/, '').split('.')[0]}`].filter(Boolean).join(' · ');
  const room = columns - cellWidth(title) - 3 - statsWidth - 2;
  const mid = room >= 8 ? truncateEnd(meta2, room) : '';
  const gap = Math.max(1, columns - cellWidth(title) - (mid ? 3 + cellWidth(mid) : 0) - statsWidth - 1);
  return (
    <Text wrap="truncate">
      <Text color={tone.accent} bold>
        {title}
      </Text>
      {mid ? <Text color={tone.muted}>   {mid}</Text> : null}
      {' '.repeat(gap)}
      {stats.map((s, i) => (
        <Text key={i} color={s.color}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function tailFor(service: ServiceState, now: number, callCount: number, callErrorCount: number, tone: Tone): Segment[] {
  const reload = service.lastReload;
  if (service.status === 'compiling' && service.detail) return [{ text: service.detail, color: tone.activity }];
  if (service.status === 'stopped' || service.status === 'crashed') return [{ text: `exit ${service.exitCode ?? '?'}`, color: service.status === 'crashed' ? tone.error : tone.muted }];
  if (service.kind === 'convex' && callCount > 0) {
    const parts: Segment[] = [{ text: `${formatCount(callCount)} calls`, color: tone.text }];
    if (callErrorCount > 0) parts.push({ text: ' · ', color: tone.muted }, { text: `${formatCount(callErrorCount)} failed`, color: tone.error });
    return parts;
  }
  if (reload) {
    const what = reload.route ?? (service.kind === 'convex' ? 'pushed' : 'reload');
    const ms = reload.ms !== undefined ? ` ${formatMs(reload.ms)}` : '';
    return [
      { text: `${reloadGlyph(service)} `, color: hotColor(reload.at, now, tone) },
      { text: `${what}${ms}`, color: tone.text },
      { text: ` · ${formatClock(reload.at)}`, color: tone.muted },
    ];
  }
  if (service.startedAt) return [{ text: `started ${formatClock(service.startedAt)}`, color: tone.muted }];
  return [];
}

function ServiceRow({ service, marked, frame, spinning, now, layout, callCount, callErrorCount }: PlainViewProps & { service: ServiceState; marked: boolean }) {
  const tone = useTone();
  const look = statusLook(service.status, frame, spinning.has(service.id), tone);
  const port = service.port ? `:${service.port}` : '';
  const tail = clip(tailFor(service, now, callCount, callErrorCount, tone), Math.max(0, layout.columns - ROW_FIXED));
  return (
    <Text wrap="truncate">
      <Text color={tone.activity}> {marked ? '›' : ' '} </Text>
      <Text color={look.color}>{look.glyph} </Text>
      <Text color={marked ? tone.accent : tone.text} bold={marked}>
        {padEnd(service.label.toLowerCase(), LABEL_W)}
      </Text>
      <Text color={tone.muted}>{padEnd(port, PORT_W)}</Text>
      <Text color={look.color}>{padEnd(look.word, STATUS_W)}</Text>
      <Text color={tone.text}>{padStart(formatMb(service.memMb), MEM_W)}</Text>
      <Text>{'    '}</Text>
      {tail.map((s, i) => (
        <Text key={i} color={s.color}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function WatcherRow({ watchers }: { watchers: ServiceState[] }) {
  const tone = useTone();
  const watch = watcherSummary(watchers, tone);
  return (
    <Text wrap="truncate">
      <Text>{'   '}</Text>
      <Text color={watch.color}>{watch.glyph} </Text>
      <Text color={tone.muted}>{padEnd('watchers', LABEL_W + PORT_W)}</Text>
      <Text color={watch.color}>{padEnd(watch.text, STATUS_W)}</Text>
      {watch.names ? <Text color={tone.error}>{padStart('', MEM_W)}    {watch.names}</Text> : null}
    </Text>
  );
}

function LatestRow({ item, columns, now }: { item: LatestItem; columns: number; now: number }) {
  const tone = useTone();
  const bodyWidth = Math.max(8, Math.min(LATEST_BODY_MAX, columns - LATEST_FIXED));
  let glyph: Segment;
  let body: Segment[];
  let ms: number | undefined;
  let msColor: string = tone.muted;
  if (item.type === 'event') {
    const { event } = item;
    const look = lookFor(event, now, tone);
    const failed = event.kind === 'error' || event.kind === 'exit' || (event.status !== undefined && event.status >= 400);
    glyph = { text: look.glyph, color: look.color };
    body = [
      { text: padEnd(event.service, 8), color: tone.muted },
      { text: event.text, color: failed ? tone.error : tone.text },
    ];
    ms = event.ms;
    if (ms !== undefined && ms >= SLOW_CALL_MS) msColor = tone.activity;
  } else {
    const { call } = item;
    const badge = badgeFor(call.type, tone);
    glyph = { text: badge.letter, color: badge.color };
    const fail = call.ok ? '' : ` ✕ ${call.error ?? 'failed'}`;
    const fnWidth = Math.max(8, bodyWidth - cellWidth(fail));
    body = [{ text: truncateStart(call.fn, fnWidth), color: call.ok ? tone.text : tone.error }];
    if (fail) body.push({ text: fail, color: tone.error });
    ms = call.ms;
    msColor = !call.ok ? tone.error : call.ms >= SLOW_CALL_MS ? tone.activity : tone.muted;
  }
  const shown = clip(body, bodyWidth);
  const used = shown.reduce((sum, s) => sum + cellWidth(s.text), 0);
  return (
    <Text wrap="truncate">
      <Text color={tone.muted}>   {padStart(formatClockSeconds(item.at), TIME_W)}   </Text>
      <Text color={glyph.color} bold={item.type === 'call'}>
        {glyph.text}
      </Text>
      <Text>{'  '}</Text>
      {shown.map((s, i) => (
        <Text key={i} color={s.color}>
          {s.text}
        </Text>
      ))}
      <Text color={msColor}>
        {' '.repeat(Math.max(0, bodyWidth - used))}
        {padStart(formatMs(ms), MS_W)}
      </Text>
    </Text>
  );
}
