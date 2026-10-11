/**
 * Devdeck's Ink root. Picks the plain or verbose dashboard, lays the regions out to the
 * exact terminal size, routes keys to the UI reducer, and asks the supervisor (through
 * DeckControls) for anything that touches a process. The region under the cards holds
 * the feed, the log pane or an open view, whichever the activity state and the view
 * say. Never exits on its own: q and Ctrl-C call controls.quit(). The palette wraps
 * everything in ThemeContext.
 */
import { useMemo, useReducer, useRef } from 'react';
import { Box, render, useInput, useWindowSize, type RenderOptions } from 'ink';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { DeckStore } from '../store.ts';
import type { DeckControls, ServiceState } from '../types.ts';
import { readTheme, type Theme } from '../themeFile.ts';
import { copyText } from '../clipboard.ts';
import { EXIT_SIGINT } from '../config.ts';
import { HOT_MS, ThemeProvider } from './theme.ts';
import { computeLayout } from './layout.ts';
import { computePlainLayout } from './plainLayout.ts';
import { useFrame, useWakeAt } from './useFrame.ts';
import { useSpinning } from './spin.ts';
import { useLocalNotice, useNotice } from './useNotice.ts';
import { filterCalls } from './ConvexCalls.tsx';
import { ErrorCard } from './ErrorTray.tsx';
import { Notice } from './Notice.tsx';
import { KeySheet } from './KeySheet.tsx';
import { Palette } from './Palette.tsx';
import { LogPane } from './LogPane.tsx';
import { Footer } from './Footer.tsx';
import { PlainView } from './PlainView.tsx';
import { VerboseView } from './VerboseView.tsx';
import { usePalette } from './usePalette.ts';
import { linkRefs } from './links.ts';
import { allErrorsPayload, copiedNotice, errorPayload, logPayload, COPY_FAILED, type CopyPayload } from './copyText.ts';
import { actionForKey, indexOfId, initialUi, reduceUi, type Focus, type UiAction, type UiContext } from './deckState.ts';

export interface DeckHandle {
  waitUntilExit(): Promise<void>;
  unmount(): void;
}

export interface DeckOptions extends Partial<RenderOptions> {
  /** The theme to start from; read from the theme file when omitted. */
  theme?: Theme;
  /** Service id to its dir relative to the repo root, for clickable file paths. */
  serviceDirs?: Record<string, string>;
}

/** Mount the deck on the alternate screen. Extra render options exist for tests. */
export function renderDeck(store: DeckStore, controls: DeckControls, options: DeckOptions = {}): DeckHandle {
  const { theme, serviceDirs = {}, ...renderOptions } = options;
  const instance = render(<Deck store={store} controls={controls} theme={theme ?? readTheme()} serviceDirs={serviceDirs} />, {
    exitOnCtrlC: false,
    alternateScreen: true,
    patchConsole: true,
    ...renderOptions,
  });
  return {
    waitUntilExit: () => instance.waitUntilExit().then(() => undefined),
    unmount: () => instance.unmount(),
  };
}

const ids = (list: readonly { id: number }[]): number[] => list.map((item) => item.id).reverse();

function Deck({ store, controls, theme, serviceDirs }: { store: DeckStore; controls: DeckControls; theme: Theme; serviceDirs: Record<string, string> }) {
  // Data slices only, compared shallowly; the per-second uptime ticks inside the title.
  const state = useStore(
    store,
    useShallow((s) => ({
      meta: s.meta,
      order: s.order,
      services: s.services,
      events: s.events,
      errors: s.errors,
      calls: s.calls,
      callCount: s.callCount,
      callErrorCount: s.callErrorCount,
    })),
  );
  const { columns, rows } = useWindowSize();
  const now = Date.now();

  const all = useMemo(() => state.order.map((id) => state.services[id]).filter((s): s is ServiceState => Boolean(s)), [state.order, state.services]);
  const apps = useMemo(() => all.filter((s) => s.kind !== 'watch'), [all]);
  const watchers = useMemo(() => all.filter((s) => s.kind === 'watch'), [all]);

  const [ui, dispatch] = useReducer(
    (current: typeof initialUi, input: { action: UiAction; ctx: UiContext }) => reduceUi(current, input.action, input.ctx),
    initialUi,
  );
  const palette = usePalette(theme);
  const paletteOpen = ui.view === 'palette';
  const tone = palette.toneFor(paletteOpen);

  // Pausing freezes the feeds at the moment of the key press.
  const frozen = useRef<{ calls: typeof state.calls; events: typeof state.events } | null>(null);
  if (ui.paused && !frozen.current) frozen.current = { calls: state.calls, events: state.events };
  if (!ui.paused && frozen.current) frozen.current = null;
  const calls = frozen.current?.calls ?? state.calls;
  const events = frozen.current?.events ?? state.events;
  const errors = state.errors;

  const plain = ui.mode === 'plain';
  const layout = computeLayout({ columns, rows, services: apps.length, errors: errors.length, view: ui.view, activity: ui.activity });
  const plainLayout = computePlainLayout({ columns, rows, services: apps.length, errors: errors.length, view: ui.view, activity: ui.activity });
  const panels = useMemo<Focus[]>(() => {
    const list: Focus[] = ['services'];
    if (!plain && layout.tier !== 'narrow') list.push('calls', 'timeline');
    if (errors.length > 0) list.push('errors');
    return list;
  }, [plain, layout.tier, errors.length]);

  // Newest-first ids: the selection follows an item by id, so new arrivals do not move it.
  const callIds = useMemo(() => ids(filterCalls(calls, ui.filter)), [calls, ui.filter]);
  const eventIds = useMemo(() => ids(events), [events]);
  const errorIds = useMemo(() => ids(errors), [errors]);
  const scrollMax = useRef(0);
  const logScrollMax = useRef(0);
  const logWindow = useRef<readonly string[]>([]);
  const viewRows = plain ? plainLayout.latest : layout.middle;
  const ctx: UiContext = {
    panels,
    services: apps.length,
    calls: callIds,
    events: eventIds,
    errors: errorIds,
    page: Math.max(1, viewRows - 2),
    // The open view and the log pane write their limits while rendering; read again at the key press.
    scrollMax: 0,
    logScrollMax: 0,
  };
  const serviceIndex = Math.min(ui.serviceIndex, Math.max(0, apps.length - 1));
  const callIndex = indexOfId(callIds, ui.callId);
  const eventIndex = indexOfId(eventIds, ui.eventId);
  const errorIndex = indexOfId(errorIds, ui.errorId);
  const selectedService = apps[serviceIndex];
  const selectedError = errors.find((e) => e.id === errorIds[errorIndex]);
  const focus: Focus = panels.includes(ui.focus) ? ui.focus : 'services';

  const eventNotice = useNotice(state.events);
  const [localNotice, showNotice] = useLocalNotice();
  const notice = localNotice ?? eventNotice;

  // The only motion is the spinner of a starting or compiling service; the clock runs for it alone.
  const spinning = useSpinning(apps, now);
  const frame = useFrame(spinning.size > 0);
  // A hot reload settles from the accent to the activity colour once, on time, without a clock.
  const hotUntil = apps.reduce<number | undefined>((until, s) => {
    const at = s.lastReload ? s.lastReload.at + HOT_MS : undefined;
    return at !== undefined && at > now && (until === undefined || at > until) ? at : until;
  }, undefined);
  useWakeAt(hotUntil);

  /** What `y` copies: the open error, the log window, or the selected tray error. */
  const copyPayload = (all: boolean): CopyPayload | undefined => {
    if (all) return allErrorsPayload(errors);
    if (ui.view === 'error' && selectedError) return errorPayload(selectedError);
    if (ui.view === 'deck' && ui.activity === 'logs' && viewRows > 1 && selectedService) return logPayload(selectedService.id, logWindow.current);
    if (ui.view === 'deck' && selectedError) return errorPayload(selectedError);
    return undefined;
  };
  const copy = (all: boolean) => {
    const payload = copyPayload(all);
    if (!payload) return showNotice({ kind: 'failed', service: '', text: COPY_FAILED });
    void copyText(payload.text).then((result) => {
      if (result === 'failed') showNotice({ kind: 'failed', service: '', text: COPY_FAILED });
      else showNotice({ kind: 'copied', service: '', text: copiedNotice(payload) });
    });
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      controls.quit(EXIT_SIGINT);
      return;
    }
    if (paletteOpen) {
      const taken = palette.handleKey(input, key);
      if (typeof taken === 'string') return showNotice({ kind: 'saved', service: '', text: `Palette saved · ${taken}` });
      if (taken) return;
    }
    const action = actionForKey(input, key);
    if (!action) return;
    if (action === 'quit') return controls.quit();
    if (action === 'restart') return selectedService && controls.restart(selectedService.id);
    if (action === 'open') return selectedService && controls.open(selectedService.id);
    if (action === 'copy' || action === 'copyAll') return copy(action === 'copyAll');
    if (action === 'palette' && !paletteOpen) palette.open();
    dispatch({ action, ctx: { ...ctx, scrollMax: scrollMax.current, logScrollMax: logScrollMax.current } });
  });

  const totalMemMb = all.reduce((sum, s) => sum + s.memMb, 0);
  const totalCpu = all.reduce((sum, s) => sum + s.cpu, 0);
  const root = state.meta.root;
  const linkFor = (serviceId: string, text: string) => linkRefs(text, root, serviceDirs[serviceId]);

  scrollMax.current = 0;
  logScrollMax.current = 0;
  const view = (() => {
    if (viewRows < 2) return null;
    if (ui.view === 'palette') return <Palette state={palette.state} width={columns} rows={viewRows} />;
    if (ui.view === 'error' && selectedError) {
      return <ErrorCard error={selectedError} width={columns} rows={viewRows} offset={ui.scroll} scrollMax={scrollMax} link={(text) => linkFor(selectedError.service, text)} />;
    }
    // The logs take the feed's rows; the feed is back one `l` or an escape later.
    if (ui.activity === 'logs' && selectedService) {
      return <LogPane services={apps} selectedIndex={serviceIndex} controls={controls} columns={columns} rows={viewRows} scroll={ui.logScroll} paused={ui.paused} scrollMax={logScrollMax} window={logWindow} link={linkFor} />;
    }
    return null;
  })();

  const shared = { meta: state.meta, apps, watchers, events, calls, errors, callCount: state.callCount, callErrorCount: state.callErrorCount, totalMemMb, totalCpu, errorIndex, frame, spinning, now, view };

  return (
    <ThemeProvider value={tone}>
      <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
        {ui.view === 'keys' ? (
          // Help takes the whole screen above the footer, so no layout ever squeezes it out.
          <KeySheet width={columns} rows={Math.max(1, rows - 1)} />
        ) : plain ? (
          <PlainView {...shared} layout={plainLayout} selectedIndex={serviceIndex} focused={focus === 'services'} errorsFocused={focus === 'errors'} />
        ) : (
          <VerboseView {...shared} layout={layout} focus={focus} serviceIndex={serviceIndex} callIndex={callIndex} eventIndex={eventIndex} filter={ui.filter} paused={ui.paused} collapsed={ui.collapsed} />
        )}
        <Footer errors={errors} columns={columns} mode={ui.mode} activity={ui.activity} view={ui.view} />
        {notice ? <Notice notice={notice} columns={columns} /> : null}
      </Box>
    </ThemeProvider>
  );
}
