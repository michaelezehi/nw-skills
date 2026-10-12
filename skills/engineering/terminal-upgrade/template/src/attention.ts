/**
 * Getting your attention when you are not looking at the deck. A one-off run that took a
 * while says when it ends; a prompt left waiting says what it asks. Both as a macOS
 * notification. The terminal tab's title follows the deck too, so a glance at the tab bar
 * shows `42% build`, `? ship waiting` or `2 errors`.
 */
import { execFile } from 'node:child_process';
import type { DeckState } from './store.ts';
import type { ServiceState } from './types.ts';

export type Notify = (title: string, body: string) => void;

/** Runs shorter than this end without a notification: you were still watching. */
export const RUN_NOTIFY_MS = 20_000;
/** A prompt left this long gets a notification. */
export const PROMPT_NOTIFY_MS = 5_000;

/**
 * osascript's argv for one notification. The text travels as arguments read through
 * `argv`, never pasted into the script, so a quote in a command's output is only text.
 */
export function osascriptArgs(title: string, body: string): string[] {
  return ['-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', title, body];
}

/** A notifier for this platform, or undefined where there is none. Failures are ignored. */
export function systemNotifier(platform: NodeJS.Platform = process.platform, run: typeof execFile = execFile): Notify | undefined {
  if (platform !== 'darwin') return undefined;
  return (title, body) => {
    try {
      run('osascript', osascriptArgs(title, body), { timeout: 5000 }, () => undefined);
    } catch {
      // No osascript; the deck still shows everything.
    }
  };
}

const seconds = (ms: number): string => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`);

const running = (s: ServiceState): boolean => s.pid !== undefined;

/** The tab title for the deck as it stands. Plain text, at most about 40 characters. */
export function tabTitle(state: Pick<DeckState, 'meta' | 'order' | 'services' | 'errors'>): string {
  const services = state.order.map((id) => state.services[id]).filter((s): s is ServiceState => Boolean(s));
  const name = (s: ServiceState): string => s.label.toLowerCase();
  const waiting = services.find((s) => s.prompt);
  if (waiting) return `? ${name(waiting)} waiting`;
  const run = services.find((s) => s.oneShot && running(s));
  if (run) {
    const fraction = run.progress?.fraction;
    return fraction !== undefined ? `${Math.round(fraction * 100)}% ${name(run)}` : `▸ ${name(run)}`;
  }
  const errors = state.errors.length;
  const deck = (state.meta.title ?? '').trim() || 'devdeck';
  if (errors > 0) return `◆ ${errors} ${errors === 1 ? 'error' : 'errors'} · ${deck.toLowerCase()}`;
  return `${deck.toLowerCase()} · ${(state.meta.mode ?? 'dev').toLowerCase()}`;
}

/** OSC 2: set the window and tab title. Control characters are dropped from the text. */
export const titleSequence = (title: string): string => `\u001b]2;${title.replace(/[\u0000-\u001f\u007f]/g, '')}\u0007`;

export interface AttentionOptions {
  notify?: Notify;
  /** Writes the title; omitted when stdout is not a terminal. */
  setTitle?: (title: string) => void;
  now?: () => number;
  runMs?: number;
  promptMs?: number;
}

interface Watchable {
  getState(): DeckState;
  subscribe(listener: (state: DeckState, prev: DeckState) => void): () => void;
}

/** Watch the store for runs that end and prompts left waiting. Returns the stop. */
export function watchAttention(store: Watchable, options: AttentionOptions = {}): () => void {
  const now = options.now ?? Date.now;
  const runMs = options.runMs ?? RUN_NOTIFY_MS;
  const promptMs = options.promptMs ?? PROMPT_NOTIFY_MS;
  const timers = new Map<string, { key: string; timer: NodeJS.Timeout }>();
  let title = '';

  const showTitle = (state: DeckState): void => {
    if (!options.setTitle) return;
    const next = tabTitle(state);
    if (next === title) return;
    title = next;
    options.setTitle(next);
  };

  const onChange = (state: DeckState, prev: DeckState): void => {
    showTitle(state);
    if (!options.notify) return;
    for (const id of state.order) {
      const cur = state.services[id];
      const before = prev.services[id];
      if (!cur?.oneShot) continue;
      // The run ended: it had a pid and now has none.
      if (before?.pid !== undefined && cur.pid === undefined && cur.startedAt !== undefined) {
        const took = now() - cur.startedAt;
        if (took >= runMs) {
          const failed = cur.status === 'crashed';
          options.notify(failed ? `${cur.label} failed` : `${cur.label} finished`, failed ? `exit ${cur.exitCode ?? '?'} after ${seconds(took)}` : `in ${seconds(took)}`);
        }
      }
      // A new prompt starts its own clock; any change of prompt stops the old one.
      const key = cur.prompt ? JSON.stringify(cur.prompt) : '';
      const pending = timers.get(id);
      if (pending && pending.key !== key) {
        clearTimeout(pending.timer);
        timers.delete(id);
      }
      if (key && !timers.has(id)) {
        const question = cur.prompt?.question ?? '';
        const label = cur.label;
        // The entry stays after it fires, so one prompt notifies once.
        const timer = setTimeout(() => options.notify?.(`${label} is waiting`, question), promptMs);
        timer.unref?.();
        timers.set(id, { key, timer });
      }
    }
  };

  showTitle(store.getState());
  const unsubscribe = store.subscribe(onChange);
  return () => {
    unsubscribe();
    for (const { timer } of timers.values()) clearTimeout(timer);
    timers.clear();
  };
}
