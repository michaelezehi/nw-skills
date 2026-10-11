/**
 * The full deck: hero header, a card or pill per service, Convex calls beside (or over)
 * the timeline, and the error tray. Either feed panel folds to its title rule; the other
 * takes the freed rows, and with both folded the rest of the region stays blank. The
 * region also takes the log pane or an open view, and in the quiet state the cards
 * grow over it, with the memory trend the plain deck leaves out.
 */
import type { ReactNode } from 'react';
import { Box } from 'ink';
import type { ConvexCall, DeckMeta, DevError, DevEvent, ServiceState } from '../types.ts';
import { splitColumns, splitRows, type Layout } from './layout.ts';
import { Header } from './Header.tsx';
import { ServiceCard, PillStrip } from './ServiceCard.tsx';
import { QuietGrid } from './QuietCards.tsx';
import { ConvexCalls, filterCalls, type CallFilter } from './ConvexCalls.tsx';
import { Timeline } from './Timeline.tsx';
import { ErrorTray } from './ErrorTray.tsx';
import { Rule } from './Panel.tsx';
import { formatClockSeconds, formatCount } from './format.ts';
import type { Focus, Panel as PanelName } from './deckState.ts';

export interface VerboseViewProps {
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
  layout: Layout;
  focus: Focus;
  serviceIndex: number;
  callIndex: number;
  eventIndex: number;
  errorIndex: number;
  filter: CallFilter;
  paused: boolean;
  collapsed: Record<PanelName, boolean>;
  frame: number;
  spinning: ReadonlySet<string>;
  now: number;
  /** The log pane or an open view (error card, palette) drawn in place of the feeds. */
  view: ReactNode | null;
}

export function VerboseView(props: VerboseViewProps) {
  const { layout, apps, watchers, errors, focus, spinning, frame, now } = props;
  const convex = apps.find((s) => s.kind === 'convex');
  const maxMemMb = apps.reduce((max, s) => Math.max(max, s.memMb), 0);
  const height = layout.middle;
  const middle = height < 1 ? <Box height={Math.max(0, height)} /> : (props.view ?? <Feeds {...props} />);

  return (
    <Box flexDirection="column" width={layout.columns} height={layout.rows - layout.footer} overflow="hidden">
      <Header
        meta={props.meta}
        convex={convex}
        watchers={watchers}
        totalMemMb={props.totalMemMb}
        totalCpu={props.totalCpu}
        callCount={props.callCount}
        callErrorCount={props.callErrorCount}
        now={now}
        frame={frame}
        convexSpinning={convex ? spinning.has(convex.id) : true}
        tier={layout.tier}
        columns={layout.columns}
        rows={layout.header}
      />
      {layout.grid ? (
        <QuietGrid apps={apps} grid={layout.grid} errors={errors} columns={layout.columns} selectedIndex={props.serviceIndex} focused={focus === 'services'} frame={frame} spinning={spinning} now={now} detail />
      ) : (
        <ServiceStrip apps={apps} layout={layout} maxMemMb={maxMemMb} selectedIndex={props.serviceIndex} focused={focus === 'services'} frame={frame} spinning={spinning} now={now} />
      )}
      {middle}
      <ErrorTray errors={errors} rows={layout.tray} columns={layout.columns} focused={focus === 'errors'} selectedIndex={props.errorIndex} />
    </Box>
  );
}

/** The calls and timeline panels, open or folded, in the arrangement the tier allows. */
function Feeds(props: VerboseViewProps) {
  const { layout, calls, events, filter, paused, focus, collapsed, now } = props;
  const width = layout.columns;
  const height = layout.middle;
  const callItems = filterCalls(calls, filter).length;
  const callsOpen = (w: number, rows: number) => (
    <ConvexCalls calls={calls} filter={filter} paused={paused} focused={focus === 'calls'} selectedIndex={props.callIndex} width={w} rows={rows} />
  );
  const timelineOpen = (w: number, rows: number) => (
    <Timeline events={events} paused={paused} focused={focus === 'timeline'} selectedIndex={props.eventIndex} width={w} rows={rows} now={now} />
  );
  const callsRule = (
    <Rule title={`CONVEX CALLS · ${formatCount(props.callCount)} calls · ${props.callErrorCount > 0 ? `${formatCount(props.callErrorCount)} failed` : 'none failed'}`} right="c to open" width={width} focused={focus === 'calls'} />
  );
  const last = events[events.length - 1];
  const timelineRule = (
    <Rule title={`TIMELINE · ${formatCount(events.length)} events${last ? ` · last ${formatClockSeconds(last.at)}` : ''}`} right="t to open" width={width} focused={focus === 'timeline'} />
  );

  if (layout.tier === 'narrow') {
    if (collapsed.timeline) return <Column height={height} width={width}>{timelineRule}</Column>;
    return height >= 4 ? timelineOpen(width, height) : <Box height={height} />;
  }
  if (height < 2) return <Box height={height} />;
  if (collapsed.calls && collapsed.timeline) {
    return (
      <Column height={height} width={width}>
        {callsRule}
        {timelineRule}
      </Column>
    );
  }
  if (collapsed.calls) {
    return (
      <Column height={height} width={width}>
        {callsRule}
        {timelineOpen(width, height - 1)}
      </Column>
    );
  }
  if (collapsed.timeline) {
    return (
      <Column height={height} width={width}>
        {callsOpen(width, height - 1)}
        {timelineRule}
      </Column>
    );
  }
  if (layout.tier === 'full') {
    const split = splitColumns(width);
    return (
      <Box flexDirection="row" height={height} width={width} overflow="hidden">
        {callsOpen(split.left, height)}
        <Box width={1} />
        {timelineOpen(split.right, height)}
      </Box>
    );
  }
  const split = splitRows(height, callItems, events.length);
  return (
    <Column height={height} width={width}>
      {callsOpen(width, split.top)}
      {timelineOpen(width, split.bottom)}
    </Column>
  );
}

function Column({ height, width, children }: { height: number; width: number; children: ReactNode }) {
  return (
    <Box flexDirection="column" height={height} width={width} overflow="hidden">
      {children}
    </Box>
  );
}

interface StripProps {
  apps: ServiceState[];
  layout: Layout;
  maxMemMb: number;
  selectedIndex: number;
  focused: boolean;
  frame: number;
  spinning: ReadonlySet<string>;
  now: number;
}

function ServiceStrip({ apps, layout, maxMemMb, selectedIndex, focused, frame, spinning, now }: StripProps) {
  if (layout.services < 1) return null;
  if (layout.cardWidth > 0) {
    return (
      <Box flexDirection="row" width={layout.columns} height={layout.services} overflow="hidden">
        {apps.map((service, i) => (
          <ServiceCard
            key={service.id}
            service={service}
            maxMemMb={maxMemMb}
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
