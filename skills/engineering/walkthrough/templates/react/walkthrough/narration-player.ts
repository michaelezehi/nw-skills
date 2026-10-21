/**
 * The narrator's one audio element. A module singleton, so a remount that a
 * route or persona switch causes does not cut the clip that covers it, and
 * two clips can never play at once.
 *
 * Every `play` returns a token. `ended` and `error` reach listeners with the
 * token of the clip they belong to, once, and never after `stop()` or a newer
 * `play()`: a late `ended` from a cut clip must not move the story on.
 */

export type NarrationOutcome = 'ended' | 'failed';
export type NarrationListener = (token: number, outcome: NarrationOutcome) => void;

/** 10ms of 8kHz silence. Played inside a click so later clips may autoplay. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

const defaultFactory = (): HTMLAudioElement => new Audio();

let factory: () => HTMLAudioElement = defaultFactory;
let el: HTMLAudioElement | null = null;
let token = 0;
/** The token of the clip in the element, or null when none is loaded. */
let activeToken: number | null = null;
/** Paused by `pause()`, so `resume()` knows there is something to carry on. */
let held = false;
let unlocked = false;
const listeners = new Set<NarrationListener>();

function settle(t: number, outcome: NarrationOutcome): void {
  if (activeToken !== t) return;
  activeToken = null;
  held = false;
  for (const listener of [...listeners]) listener(t, outcome);
}

function element(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (el) return el;
  const audio = factory();
  audio.preload = 'auto';
  // iOS Safari plays inline only with both the property and the attribute.
  (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  audio.setAttribute('playsinline', '');
  audio.addEventListener('ended', () => {
    if (activeToken !== null) settle(activeToken, 'ended');
  });
  audio.addEventListener('error', () => {
    if (activeToken !== null) settle(activeToken, 'failed');
  });
  el = audio;
  return audio;
}

/** A pause() or a newer src aborts a pending play(); that is not a failed clip. */
function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

function start(audio: HTMLAudioElement, t: number): void {
  try {
    const pending = audio.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch((err: unknown) => {
        if (!isAbort(err)) settle(t, 'failed');
      });
    }
  } catch {
    settle(t, 'failed');
  }
}

/**
 * Call inside a click or key press. Browsers allow audio for the rest of the
 * page once one play() starts inside a user gesture; a silent clip does it.
 * Safe to call again: it does nothing once unlocked or while a clip plays.
 */
export function unlock(): void {
  if (unlocked || activeToken !== null) return;
  const audio = element();
  if (!audio) return;
  const t = token;
  audio.src = SILENT_WAV;
  try {
    const pending = audio.play();
    const done = () => {
      unlocked = true;
      // A real clip may have started meanwhile; leave it alone.
      if (token === t && activeToken === null) {
        audio.pause();
        audio.removeAttribute('src');
      }
    };
    if (pending && typeof pending.then === 'function') {
      pending.then(done, () => undefined);
    } else {
      done();
    }
  } catch {
    // Blocked: a later gesture tries again.
  }
}

/** Plays `url` from the start, cutting whatever was playing. Returns the clip's token. */
export function play(url: string): number {
  token += 1;
  const t = token;
  activeToken = t;
  held = false;
  const audio = element();
  if (!audio) {
    queueMicrotask(() => settle(t, 'failed'));
    return t;
  }
  audio.src = url;
  start(audio, t);
  return t;
}

export function pause(): void {
  if (activeToken === null || !el) return;
  held = true;
  el.pause();
}

/** Carries on a clip `pause()` held. Does nothing otherwise. */
export function resume(): void {
  if (!held || activeToken === null || !el) return;
  held = false;
  start(el, activeToken);
}

/** Cuts the clip at once. Its `ended` and `error` never reach a listener. */
export function stop(): void {
  token += 1;
  activeToken = null;
  held = false;
  if (!el) return;
  el.pause();
  el.removeAttribute('src');
  try {
    el.load();
  } catch {
    // Some test DOMs have no load(); the src is already gone.
  }
}

/** The playing clip's position, for the reader's ring. Null when unknown. */
export function getProgress(): { currentTime: number; duration: number } | null {
  if (activeToken === null || !el) return null;
  const { currentTime, duration } = el;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return { currentTime, duration };
}

/** Hears how each clip ended. Returns the unsubscribe. */
export function subscribe(listener: NarrationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only: swap the element factory and forget all state. Null restores `new Audio()`. */
export function __setAudioFactoryForTests(next: (() => HTMLAudioElement) | null): void {
  factory = next ?? defaultFactory;
  el = null;
  token = 0;
  activeToken = null;
  held = false;
  unlocked = false;
  listeners.clear();
}
