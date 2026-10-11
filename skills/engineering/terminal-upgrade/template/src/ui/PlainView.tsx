/**
 * The calm default: the verbose deck's frame with less in it. The boxed header with
 * the clock and three stats, one two-row card per service, and under them the region:
 * LATEST, a short feed of notable things, or the log pane, or an open view. In the
 * quiet state the region is gone and the cards grow to explain themselves. Nothing on
 * it is ever cut short; what cannot fit in full is left out.
 */
import type { ReactNode } from 'react';
import { Box } from 'ink';
import type { ConvexCall, DeckMeta, DevError, DevEvent, ServiceState } from '../types.ts';
import { ErrorTray } from './ErrorTray.tsx';
import { PlainHeader } from './PlainHeader.tsx';
import { PlainStrip } from './PlainCards.tsx';
import { QuietGrid } from './QuietCards.tsx';
import { Latest } from './Latest.tsx';
import type { PlainLayout } from './plainLayout.ts';

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
  /** The cards hold the focus, so the selected one shows it. */
  focused: boolean;
  errorsFocused: boolean;
  errorIndex: number;
  frame: number;
  spinning: ReadonlySet<string>;
  now: number;
  /** The log pane or an open view (error card, palette) drawn in place of LATEST. */
  view: ReactNode | null;
}

export function PlainView(props: PlainViewProps) {
  const { layout, apps, view, now } = props;
  const height = layout.rows - layout.footer;
  return (
    <Box flexDirection="column" width={layout.columns} height={height} overflow="hidden">
      {layout.header > 0 ? (
        <PlainHeader
          meta={props.meta}
          watchers={props.watchers}
          totalMemMb={props.totalMemMb}
          totalCpu={props.totalCpu}
          callCount={props.callCount}
          callErrorCount={props.callErrorCount}
          now={now}
          columns={layout.columns}
          rows={layout.header}
        />
      ) : null}
      {layout.grid ? (
        <QuietGrid apps={apps} grid={layout.grid} errors={props.errors} columns={layout.columns} selectedIndex={props.selectedIndex} focused={props.focused} frame={props.frame} spinning={props.spinning} now={now} detail={false} />
      ) : (
        <PlainStrip apps={apps} layout={layout} selectedIndex={props.selectedIndex} focused={props.focused} frame={props.frame} spinning={props.spinning} now={now} />
      )}
      {layout.latest < 1 ? null : (view ?? <Latest events={props.events} calls={props.calls} width={layout.columns} rows={layout.latest} now={now} />)}
      <ErrorTray errors={props.errors} rows={layout.tray} columns={layout.columns} focused={props.errorsFocused} selectedIndex={props.errorIndex} />
    </Box>
  );
}
