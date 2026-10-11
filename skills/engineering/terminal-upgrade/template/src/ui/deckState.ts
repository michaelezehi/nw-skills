/** Pure UI state for the deck: mode, focus, selection, view, activity and feed options. Keys become actions here. */
import type { View } from './layout.ts';
import { nextFilter, type CallFilter } from './ConvexCalls.tsx';

export type Focus = 'services' | 'calls' | 'timeline' | 'hogs' | 'errors';
export type Mode = 'plain' | 'verbose';
export type Panel = 'calls' | 'timeline';
/**
 * What the region under the cards holds. `feed` is LATEST, or the Convex calls and the
 * timeline; `logs` puts the selected service's raw lines there instead; `quiet` shows
 * neither and lets the cards grow. `l` walks the three in that order.
 */
export type Activity = 'feed' | 'logs' | 'quiet';

export interface UiState {
  /** Plain is the calm default; verbose is the full deck. */
  mode: Mode;
  focus: Focus;
  view: View;
  activity: Activity;
  /** Lines the log pane is scrolled up from its tail. 0 follows live output. */
  logScroll: number;
  /** Verbose panels folded to their title rule. Survives mode switches. */
  collapsed: Record<Panel, boolean>;
  serviceIndex: number;
  /**
   * Selected item ids in the newest-first feeds. Undefined follows the newest; an id stays
   * on its item while new ones arrive above it. The index is derived at render.
   */
  callId?: number;
  eventId?: number;
  errorId?: number;
  /** Selected memory hog by pid; undefined follows the largest. */
  hogPid?: number;
  filter: CallFilter;
  paused: boolean;
  /** Lines scrolled in the error view. */
  scroll: number;
  /** Views opened before the current one, oldest first. Back pops it; close clears it. */
  history: View[];
}

export type UiAction =
  | 'focusNext'
  | 'focusPrev'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'escape'
  | 'close'
  | 'back'
  | 'errors'
  | 'logs'
  | 'mode'
  | 'calls'
  | 'timeline'
  | 'filter'
  | 'pause'
  | 'keys'
  | 'pageUp'
  | 'pageDown'
  | 'palette'
  | 'hogs';

export interface UiContext {
  panels: Focus[];
  services: number;
  /** Ids in display order, newest first. */
  calls: readonly number[];
  events: readonly number[];
  errors: readonly number[];
  /** Hog pids, largest first. */
  hogs?: readonly number[];
  /** Rows one page scrolls. */
  page: number;
  /** Furthest the open error view can scroll; the view reports it. */
  scrollMax: number;
  /** Furthest the log pane can scroll; the pane reports it. */
  logScrollMax: number;
}

export const initialUi: UiState = {
  mode: 'plain',
  focus: 'services',
  view: 'deck',
  activity: 'feed',
  logScroll: 0,
  collapsed: { calls: false, timeline: false },
  serviceIndex: 0,
  filter: 'all',
  paused: false,
  scroll: 0,
  history: [],
};

const clamp = (n: number, max: number): number => Math.max(0, Math.min(n, Math.max(0, max - 1)));

/** Where `id` sits in `ids`; the newest (0) when nothing is selected or the item is gone. */
export function indexOfId(ids: readonly number[], id: number | undefined): number {
  if (id === undefined) return 0;
  return Math.max(0, ids.indexOf(id));
}

function stepId(ids: readonly number[], id: number | undefined, step: number): number | undefined {
  if (ids.length === 0) return id;
  return ids[clamp(indexOfId(ids, id) + step, ids.length)];
}

/** Open `view` on top of the current one, so back returns to it. Reopening the same view keeps one entry. */
function open(state: UiState, view: View, patch: Partial<UiState> = {}): UiState {
  if (state.view === view) return { ...state, ...patch, scroll: 0 };
  const history = state.history.filter((v) => v !== view);
  return { ...state, ...patch, view, scroll: 0, history: [...history, state.view] };
}

/** Back one view; the deck when there is nothing behind. */
function back(state: UiState): UiState {
  const history = state.history.slice(0, -1);
  const view = state.history[state.history.length - 1] ?? 'deck';
  return { ...state, view, scroll: 0, history: view === 'deck' ? [] : history };
}

/** Close every open view and return to the deck. */
const close = (state: UiState): UiState => ({ ...state, view: 'deck', scroll: 0, history: [] });

const scrollBy = (scroll: number, step: number, max: number): number => Math.max(0, Math.min(scroll + step, Math.max(0, max)));

function moveFocus(state: UiState, ctx: UiContext, step: 1 | -1): UiState {
  const panels = ctx.panels.length > 0 ? ctx.panels : ['services' as Focus];
  const at = Math.max(0, panels.indexOf(state.focus));
  const focus = panels[(at + step + panels.length) % panels.length]!;
  return { ...state, focus };
}

function moveSelection(state: UiState, ctx: UiContext, step: number): UiState {
  switch (state.focus) {
    case 'services':
      return { ...state, serviceIndex: clamp(state.serviceIndex + step, ctx.services) };
    case 'calls':
      return { ...state, callId: stepId(ctx.calls, state.callId, step) };
    case 'timeline':
      return { ...state, eventId: stepId(ctx.events, state.eventId, step) };
    case 'errors':
      return { ...state, errorId: stepId(ctx.errors, state.errorId, step) };
    case 'hogs':
      return { ...state, hogPid: stepId(ctx.hogs ?? [], state.hogPid, step) };
  }
}

/** Select a hog by pid, as a click on its row does, and focus the hog panel. */
export function selectHog(state: UiState, pid: number): UiState {
  return { ...state, hogPid: pid, focus: state.view === 'deck' ? 'hogs' : state.focus };
}

const selectService = (state: UiState, ctx: UiContext, step: number): UiState => ({
  ...state,
  focus: 'services',
  serviceIndex: clamp(state.serviceIndex + step, ctx.services),
  logScroll: 0,
});

export function nextActivity(activity: Activity): Activity {
  return activity === 'feed' ? 'logs' : activity === 'logs' ? 'quiet' : 'feed';
}

const setActivity = (state: UiState, activity: Activity): UiState => ({ ...state, activity, logScroll: 0 });

const togglePanel = (state: UiState, panel: Panel): UiState => ({ ...state, collapsed: { ...state.collapsed, [panel]: !state.collapsed[panel] } });

export function reduceUi(state: UiState, action: UiAction, ctx: UiContext): UiState {
  const inView = state.view !== 'deck';
  const scroll = (step: number) => ({ ...state, scroll: scrollBy(state.scroll, step, ctx.scrollMax) });
  const scrollLog = (step: number) => ({ ...state, logScroll: scrollBy(state.logScroll, step, ctx.logScrollMax) });
  const stepHog = (step: number) => ({ ...state, hogPid: stepId(ctx.hogs ?? [], state.hogPid, step) });
  switch (action) {
    case 'focusNext':
      return inView ? state : moveFocus(state, ctx, 1);
    case 'focusPrev':
      return inView ? state : moveFocus(state, ctx, -1);
    case 'up':
      if (state.view === 'error') return scroll(-1);
      if (state.view === 'hogs') return stepHog(-1);
      if (inView) return state;
      if (state.activity === 'logs') return scrollLog(1);
      return moveSelection(state, ctx, -1);
    case 'down':
      if (state.view === 'error') return scroll(1);
      if (state.view === 'hogs') return stepHog(1);
      if (inView) return state;
      if (state.activity === 'logs') return scrollLog(-1);
      return moveSelection(state, ctx, 1);
    case 'pageUp':
      if (state.view === 'error') return scroll(-ctx.page);
      if (state.view === 'hogs') return stepHog(-ctx.page);
      if (inView) return state;
      if (state.activity === 'logs') return scrollLog(ctx.page);
      return moveSelection(state, ctx, -ctx.page);
    case 'pageDown':
      if (state.view === 'error') return scroll(ctx.page);
      if (state.view === 'hogs') return stepHog(ctx.page);
      if (inView) return state;
      if (state.activity === 'logs') return scrollLog(-ctx.page);
      return moveSelection(state, ctx, ctx.page);
    case 'left':
      return inView ? back(state) : selectService(state, ctx, -1);
    case 'right':
      return inView ? state : selectService(state, ctx, 1);
    case 'enter':
      if (inView) return back(state);
      if (state.focus === 'errors' && ctx.errors.length > 0) return open(state, 'error', { errorId: stepId(ctx.errors, state.errorId, 0) });
      if (state.focus === 'calls' || state.focus === 'timeline') return togglePanel(state, state.focus);
      if (state.focus === 'services' && ctx.services > 0 && state.activity !== 'logs') return setActivity(state, 'logs');
      return state;
    case 'escape':
    case 'close':
      if (inView) return close(state);
      return state.activity === 'feed' ? state : setActivity(state, 'feed');
    case 'back':
      return inView ? back(state) : state;
    case 'errors':
      if (ctx.errors.length === 0) return state.view === 'error' ? back(state) : state;
      if (state.view === 'error') return back(state);
      return open({ ...state, focus: 'errors' }, 'error', { errorId: stepId(ctx.errors, state.errorId, 0) });
    case 'logs':
      if (ctx.services === 0) return state;
      return setActivity(state, nextActivity(state.activity));
    case 'mode':
      return { ...state, mode: state.mode === 'plain' ? 'verbose' : 'plain' };
    case 'calls':
    case 'timeline':
      return togglePanel(state, action);
    case 'filter':
      return { ...state, filter: nextFilter(state.filter), callId: undefined };
    case 'pause':
      return { ...state, paused: !state.paused };
    case 'keys':
      return state.view === 'keys' ? back(state) : open(state, 'keys');
    case 'palette':
      return state.view === 'palette' ? back(state) : open(state, 'palette');
    case 'hogs':
      return state.view === 'hogs' ? back(state) : open(state, 'hogs');
  }
}

/** Map a key press to an action. Returns undefined for keys the deck ignores. */
export type KeyAction = UiAction | 'quit' | 'restart' | 'open' | 'copy' | 'copyAll' | 'stop' | 'stopOrphans';

export function actionForKey(input: string, key: { upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean; return?: boolean; escape?: boolean; backspace?: boolean; delete?: boolean; tab?: boolean; shift?: boolean; pageUp?: boolean; pageDown?: boolean }): KeyAction | undefined {
  if (key.tab) return key.shift ? 'focusPrev' : 'focusNext';
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.return) return 'enter';
  if (key.escape) return 'escape';
  if (key.backspace || key.delete) return 'back';
  if (key.pageUp) return 'pageUp';
  if (key.pageDown) return 'pageDown';
  switch (input) {
    case 'q':
      return 'quit';
    case 'x':
      return 'close';
    case 'b':
      return 'back';
    case 'e':
      return 'errors';
    case 'l':
      return 'logs';
    case 'v':
    case '/':
      return 'mode';
    case 'c':
      return 'calls';
    case 't':
      return 'timeline';
    case 'r':
      return 'restart';
    case 'o':
      return 'open';
    case 'f':
      return 'filter';
    case 'p':
      return 'pause';
    case '?':
    case 'h':
      return 'keys';
    case 'C':
      return 'palette';
    case 'y':
      return 'copy';
    case 'Y':
      return 'copyAll';
    case 'm':
      return 'hogs';
    case 's':
      return 'stop';
    case 'S':
      return 'stopOrphans';
    case 'j':
      return 'down';
    case 'k':
      return 'up';
    default:
      return undefined;
  }
}
