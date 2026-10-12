/**
 * Devdeck's Ink root. Picks the plain or verbose dashboard, lays the regions out to the
 * exact terminal size, routes keys to the UI reducer, and asks the supervisor (through
 * DeckControls) for anything that touches a process. The region under the cards holds
 * the feed, the log pane or an open view, whichever the activity state and the view
 * say. Never exits on its own: q and Ctrl-C call controls.quit(). The palette wraps
 * everything in ThemeContext.
 */
import { useMemo, useReducer, useRef, type ReactNode } from 'react';
import { Box, render, useInput, useWindowSize, type RenderOptions } from 'ink';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { DeckStore } from '../store.ts';
import type { DeckControls, Hog, ServiceState } from '../types.ts';
import { readTheme, type Theme } from '../themeFile.ts';
import { copyText } from '../clipboard.ts';
import { EXIT_SIGINT } from '../config.ts';
import { HOT_MS, ThemeProvider, withHues } from './theme.ts';
import { computeLayout } from './layout.ts';
import { formatSpan } from './format.ts';
import { computePlainLayout } from './plainLayout.ts';
import { settledNow, useFrame, useHeldNow, useWakeAt } from './useFrame.ts';
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
import { actionForKey, indexOfId, initialUi, reduceUi, selectHog, type Focus, type UiAction, type UiContext, type UiState } from './deckState.ts';
import { HogPanel, HogStrip } from './HogPanel.tsx';
import { HogView } from './HogView.tsx';
import { clearNotice } from './hogCopy.ts';
import { panelRegions, planHogPanel, stripRegions, type HitRegion, type HogHit } from './hogPlan.ts';
import { enableMouse, hitTest, isClick, parseMouse } from './mouse.ts';
import { useHogs } from './useHogs.ts';
import { usePrompt } from './usePrompt.ts';
import { planPrompt, promptRegions } from './promptCard.ts';
import { PromptCard } from './PromptCard.tsx';
import { ProgressLine } from './ProgressLine.tsx';
import { ScriptList } from './ScriptList.tsx';
import { useScripts } from './useScripts.ts';

export interface DeckHandle {
  waitUntilExit(): Promise<void>;
  unmount(): void;
}

export interface DeckOptions extends Partial<RenderOptions> {
  /** The theme to start from; read from the theme file when omitted. */
  theme?: Theme;
  /** Service id to its dir relative to the repo root, for clickable file paths. */
  serviceDirs?: Record<string, string>;
  /** Ask the terminal for mouse clicks. Defaults to on for a TTY. */
  mouse?: boolean;
  /** Where the UI starts; `devdeck run` opens on the command's log. */
  initialUi?: Partial<UiState>;
}

/** Mount the deck on the alternate screen. Extra render options exist for tests. */
export function renderDeck(store: DeckStore, controls: DeckControls, options: DeckOptions = {}): DeckHandle {
  const { theme, serviceDirs = {}, mouse, initialUi: startUi, ...renderOptions } = options;
  const instance = render(<Deck store={store} controls={controls} theme={theme ?? readTheme()} serviceDirs={serviceDirs} startUi={startUi} />, {
    exitOnCtrlC: false,
    alternateScreen: true,
    patchConsole: true,
    // Every service line is a store update. 10 frames a second is plenty for a dashboard,
    // and incremental rendering rewrites only the lines that changed.
    maxFps: 10,
    incrementalRendering: true,
    ...renderOptions,
  });
  // Clicks for the hog buttons; turned off again however the deck ends.
  const out = (renderOptions.stdout ?? process.stdout) as { isTTY?: boolean; write(data: string): unknown };
  const mouseOff = (mouse ?? Boolean(out.isTTY)) ? enableMouse(out) : () => undefined;
  void instance.waitUntilExit().then(mouseOff, mouseOff);
  return {
    waitUntilExit: () => instance.waitUntilExit().then(() => undefined),
    unmount: () => {
      instance.unmount();
      mouseOff();
    },
  };
}

const ids = (list: readonly { id: number }[]): number[] => list.map((item) => item.id).reverse();

/** Every time a hot colour hangs on: each card's last reload and each reload in the feed. */
function* hotAts(apps: readonly ServiceState[], events: readonly { kind: string; at: number }[]): Iterable<number | undefined> {
  for (const s of apps) yield s.lastReload?.at;
  for (const e of events) if (e.kind === 'reload') yield e.at;
}

type DeckInput = { action: UiAction; ctx: UiContext } | { hog: number };

function Deck({ store, controls, theme, serviceDirs, startUi }: { store: DeckStore; controls: DeckControls; theme: Theme; serviceDirs: Record<string, string>; startUi?: Partial<UiState> }) {
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
      hogs: s.hogs,
    })),
  );
  const { columns, rows } = useWindowSize();
  const now = Date.now();

  const all = useMemo(() => state.order.map((id) => state.services[id]).filter((s): s is ServiceState => Boolean(s)), [state.order, state.services]);
  const apps = useMemo(() => all.filter((s) => s.kind !== 'watch'), [all]);
  const watchers = useMemo(() => all.filter((s) => s.kind === 'watch'), [all]);

  const [ui, dispatch] = useReducer(
    (current: typeof initialUi, input: DeckInput) => ('hog' in input ? selectHog(current, input.hog) : reduceUi(current, input.action, input.ctx)),
    initialUi,
    (base) => ({ ...base, ...startUi }),
  );
  const palette = usePalette(theme);
  const paletteOpen = ui.view === 'palette';
  const paletteColors = palette.toneFor(paletteOpen);
  const tone = useMemo(() => withHues(paletteColors, state.order), [paletteColors, state.order]);

  // Pausing freezes the feeds at the moment of the key press.
  const frozen = useRef<{ calls: typeof state.calls; events: typeof state.events } | null>(null);
  if (ui.paused && !frozen.current) frozen.current = { calls: state.calls, events: state.events };
  if (!ui.paused && frozen.current) frozen.current = null;
  const calls = frozen.current?.calls ?? state.calls;
  const events = frozen.current?.events ?? state.events;
  const errors = state.errors;

  const plain = ui.mode === 'plain';
  const hogs = state.hogs;
  // Layouts from primitives, kept while those hold, so the grids and strips that take them stay memoised.
  const shownHogs = ui.hogsHidden ? 0 : hogs.length;
  const layout = useMemo(
    () => computeLayout({ columns, rows, services: apps.length, errors: errors.length, view: ui.view, activity: ui.activity, hogs: shownHogs }),
    [columns, rows, apps.length, errors.length, ui.view, ui.activity, shownHogs],
  );
  const plainLayout = useMemo(
    () => computePlainLayout({ columns, rows, services: apps.length, errors: errors.length, view: ui.view, activity: ui.activity, hogs: shownHogs }),
    [columns, rows, apps.length, errors.length, ui.view, ui.activity, shownHogs],
  );
  const hogPanelShown = plain ? plainLayout.hogPanel : layout.hogPanel;
  const panels = useMemo<Focus[]>(() => {
    const list: Focus[] = ['services'];
    if (!plain && layout.tier !== 'narrow') list.push('calls', 'timeline');
    if (hogPanelShown) list.push('hogs');
    if (errors.length > 0) list.push('errors');
    return list;
  }, [plain, layout.tier, hogPanelShown, errors.length]);

  // Newest-first ids: the selection follows an item by id, so new arrivals do not move it.
  const callIds = useMemo(() => ids(filterCalls(calls, ui.filter)), [calls, ui.filter]);
  const eventIds = useMemo(() => ids(events), [events]);
  const errorIds = useMemo(() => ids(errors), [errors]);
  const hogIds = useMemo(() => hogs.map((h) => h.pid), [hogs]);
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
    hogs: hogIds,
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
  const hogIndex = Math.max(0, hogIds.indexOf(ui.hogPid ?? -1));
  const selectedHog: Hog | undefined = hogs[hogIndex];
  /** The hog the keys act on: the hog view's or the focused panel's selection. */
  const hogTarget = ui.view === 'hogs' || (ui.view === 'deck' && focus === 'hogs') ? selectedHog : undefined;

  const eventNotice = useNotice(state.events);
  const [localNotice, showNotice] = useLocalNotice();
  const notice = localNotice ?? eventNotice;
  const hogActions = useHogs(hogs, controls, showNotice, now);
  const scriptPalette = useScripts(ui.view === 'scripts', controls, (name, id) => {
    dispatch({ action: 'close', ctx });
    showNotice(id ? { kind: 'saved', service: '', text: `Running ${name}` } : { kind: 'failed', service: '', text: `${name} is not a script here` });
  });
  const prompter = usePrompt(apps, selectedService, controls, (text) => showNotice({ kind: 'failed', service: '', text }));

  // The only motion is the spinner of a starting or compiling service; the clock runs for it alone.
  const spinning = useSpinning(apps, now);
  const frame = useFrame(spinning.size > 0);
  // A hot reload settles from the accent to the activity colour once, on time, without a clock.
  const hotUntil = apps.reduce<number | undefined>((until, s) => {
    const at = s.lastReload ? s.lastReload.at + HOT_MS : undefined;
    return at !== undefined && at > now && (until === undefined || at > until) ? at : until;
  }, undefined);
  useWakeAt(hotUntil);
  // The cards and feeds draw time only as a hot colour (and the quiet cards as an uptime
  // span), so they take clocks that move when that output would, not on every render.
  const hotNow = settledNow(now, hotAts(apps, events));
  const spanNow = useHeldNow(now, apps.map((s) => (s.startedAt ? formatSpan(now - s.startedAt) : '')).join(' '));

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

  const restartHog = (hog: Hog | undefined) => {
    if (!hog) return;
    if (hog.serviceId) return controls.restart(hog.serviceId);
    showNotice({ kind: 'failed', service: '', text: `${hog.name} is not a devdeck service` });
  };
  const clearHog = (hog: Hog | undefined) => {
    if (!hog?.serviceId) return;
    void controls.clearCache(hog.serviceId).then((mb) => {
      const { ok, text } = clearNotice(hog, mb);
      showNotice({ kind: ok ? 'stopped' : 'failed', service: '', text });
    });
  };
  const onHit = (hit: HogHit | undefined) => {
    if (hit?.kind === 'prompt') return prompter.click(hit.index);
    if (hit?.kind !== 'stop' && hit?.kind !== 'orphans') hogActions.disarm();
    if (!hit) return;
    const hog = 'pid' in hit ? hogs.find((h) => h.pid === hit.pid) : undefined;
    if ('pid' in hit) dispatch({ hog: hit.pid });
    if (hit.kind === 'stop') return hogActions.stop(hog);
    if (hit.kind === 'restart') return restartHog(hog);
    if (hit.kind === 'clear') return clearHog(hog);
    if (hit.kind === 'orphans') return hogActions.stopOrphans();
    if (hit.kind === 'open') dispatch({ action: 'hogs', ctx });
  };

  useInput((input, key) => {
    // Attached, every key belongs to the command, Ctrl-C included.
    if (prompter.attached && !parseMouse(input)) {
      prompter.handleKey(input, key);
      return;
    }
    if (key.ctrl && input === 'c') {
      controls.quit(EXIT_SIGINT);
      return;
    }
    const mouse = parseMouse(input);
    if (mouse) {
      if (isClick(mouse)) onHit(hitTest(regions.current, mouse.x, mouse.y));
      // With reports on, the wheel no longer arrives as arrow keys; keep it moving the selection and the logs.
      else if (mouse.press && (mouse.button === 64 || mouse.button === 65)) dispatch({ action: mouse.button === 64 ? 'up' : 'down', ctx: { ...ctx, scrollMax: scrollMax.current, logScrollMax: logScrollMax.current } });
      return;
    }
    if (paletteOpen) {
      const taken = palette.handleKey(input, key);
      if (typeof taken === 'string') return showNotice({ kind: 'saved', service: '', text: `Palette saved · ${taken}` });
      if (taken) return;
    }
    if (key.ctrl && input === 'k') return dispatch({ action: 'scripts', ctx });
    if (scriptPalette.handleKey(input, key)) return;
    if (!paletteOpen && ui.view !== 'keys' && ui.view !== 'scripts' && prompter.handleKey(input, key)) return;
    const action = actionForKey(input, key);
    if (action !== 'stop' && action !== 'stopOrphans') hogActions.disarm();
    if (!action) return;
    if (action === 'quit') return controls.quit();
    if (action === 'stop') return hogActions.stop(hogTarget);
    if (action === 'stopOrphans') return (hogPanelShown || ui.view === 'hogs') && hogActions.stopOrphans();
    if (action === 'restart' && hogTarget) return restartHog(hogTarget);
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
  // A command's progress takes one row over the region, and a waiting prompt its bottom.
  const progressOf = apps.find((s) => s.progress && s.pid !== undefined);
  const progressRows = progressOf && viewRows >= 4 ? 1 : 0;
  const promptPlan = prompter.prompt ? planPrompt(prompter.prompt, prompter.input, columns, viewRows - progressRows) : undefined;
  const innerRows = viewRows - progressRows - (promptPlan?.rows ?? 0);
  const inner = (() => {
    if (innerRows < 2) return null;
    if (ui.view === 'palette') return <Palette state={palette.state} width={columns} rows={innerRows} />;
    if (ui.view === 'scripts') return <ScriptList entries={scriptPalette.entries} query={scriptPalette.query} index={scriptPalette.index} width={columns} rows={innerRows} />;
    if (ui.view === 'hogs') {
      const armed = hogActions.armed;
      return <HogView hogs={hogs} width={columns} rows={innerRows} selectedPid={selectedHog?.pid} armedPid={armed && armed.target !== 'orphans' ? armed.target : undefined} armedOrphans={armed?.target === 'orphans'} />;
    }
    if (ui.view === 'error' && selectedError) {
      return <ErrorCard error={selectedError} width={columns} rows={innerRows} offset={ui.scroll} scrollMax={scrollMax} link={(text) => linkFor(selectedError.service, text)} />;
    }
    // The logs take the feed's rows; the feed is back one `l` or an escape later.
    if (ui.activity === 'logs' && selectedService) {
      return <LogPane services={apps} selectedIndex={serviceIndex} controls={controls} columns={columns} rows={innerRows} scroll={ui.logScroll} paused={ui.paused} scrollMax={logScrollMax} window={logWindow} link={linkFor} />;
    }
    return null;
  })();
  const view: ReactNode | null =
    progressRows > 0 || promptPlan ? (
      <Box flexDirection="column" width={columns} height={viewRows} overflow="hidden">
        {progressRows > 0 && progressOf ? <ProgressLine service={progressOf} columns={columns} now={now} /> : null}
        {inner ?? <Box height={Math.max(0, innerRows)} />}
        {promptPlan && prompter.service ? <PromptCard plan={promptPlan} width={columns} label={prompter.service.label} /> : null}
      </Box>
    ) : (
      inner
    );

  // The hogs block above the tray, and the cells a click can land on.
  const hogRows = plain ? plainLayout.hogRows : layout.hogRows;
  const hogTop = plain ? plainLayout.header + plainLayout.services + plainLayout.latest : layout.header + layout.services + layout.middle;
  const regions = useRef<HitRegion[]>([]);
  regions.current = [];
  let hogBlock: ReactNode = null;
  const armed = hogActions.armed;
  const plan = useMemo(() => (hogRows > 0 && hogPanelShown ? planHogPanel(hogs, columns, hogRows, hogIndex, armed) : undefined), [hogRows, hogPanelShown, hogs, columns, hogIndex, armed]);
  if (hogRows > 0 && hogPanelShown) {
    if (plan) {
      regions.current = panelRegions(plan, hogTop, columns);
      hogBlock = <HogPanel plan={plan} width={columns} rows={hogRows} focused={focus === 'hogs'} selectedPid={selectedHog?.pid} />;
    }
  } else if (hogRows > 0) {
    regions.current = stripRegions(hogTop, columns);
    hogBlock = <HogStrip hogs={hogs} width={columns} />;
  }
  if (promptPlan) {
    const regionTop = plain ? plainLayout.header + plainLayout.services : layout.header + layout.services;
    regions.current = [...promptRegions(promptPlan, regionTop + viewRows - promptPlan.rows, columns), ...regions.current];
  }

  const shared = { meta: state.meta, hogBlock, apps, watchers, events, calls, errors, callCount: state.callCount, callErrorCount: state.callErrorCount, totalMemMb, totalCpu, errorIndex, frame, spinning, now, hotNow, spanNow, view };

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
        <Footer errors={errors} columns={columns} mode={ui.mode} activity={ui.activity} view={ui.view} hogs={hogs.length} hogsHidden={ui.hogsHidden} inputHints={prompter.hints} typeHint={state.meta.mode !== undefined} />
        {notice ? <Notice notice={notice} columns={columns} /> : null}
      </Box>
    </ThemeProvider>
  );
}
