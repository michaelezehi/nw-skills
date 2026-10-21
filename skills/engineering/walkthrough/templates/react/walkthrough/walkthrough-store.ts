import { create } from 'zustand';

import type { WalkthroughStep } from './story-types';

/**
 * State the bar, the reader, the keys and the prompt layer must agree on.
 * The bar owns the run; everything else asks it through `stepRequest`, so two
 * components never move the story at once.
 */

const EXPLAIN_KEY = 'wt-explain';
const FOLLOW_KEY = 'wt-follow';
const SOUND_KEY = 'wt-sound';

/** Where one narration clip is. `cut` was stopped by a step, a switch or mute. */
export type NarrationClipState = 'idle' | 'playing' | 'done' | 'failed' | 'cut';

/**
 * What the narrator is doing, written by `useNarration` (mounted once in
 * `Tour`) and read by the reader and the loop. Kept here so it outlives a
 * remount.
 */
export interface WalkthroughNarration {
  /** False until the hook has seen a run once on this page load. */
  seen: boolean;
  /** Story, index and step of the step on screen, or null before the first step. */
  key: string | null;
  story: string | null;
  stepId: string | null;
  lead: NarrationClipState;
  detail: NarrationClipState;
  /** The run was paused while a clip played; resuming the run resumes it. */
  runHold: boolean;
  /** The run status the hook last saw, for the paused and resumed edges. */
  status: string | null;
}

export const NARRATION_IDLE: WalkthroughNarration = {
  seen: false,
  key: null,
  story: null,
  stepId: null,
  lead: 'idle',
  detail: 'idle',
  runHold: false,
  status: null,
};

/** The step the reader is showing, with where it sits in its story. */
export interface WalkthroughExplanation {
  step: WalkthroughStep;
  storyLabel: string;
  total: number;
  /** Every step's title in the story, in order. */
  steps: string[];
}

export type StepDirection = 'back' | 'forward';

function read(key: string, fallback: boolean): boolean {
  try {
    const value = window.sessionStorage.getItem(key);
    return value === null ? fallback : value === 'on';
  } catch {
    return fallback;
  }
}

function write(key: string, on: boolean): void {
  try {
    window.sessionStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the toggle still works for this page.
  }
}

/** Sound is on unless the viewer turned it off. localStorage, so a new tab keeps the choice. */
function readSound(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeSound(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the switch still works for this page.
  }
}

interface WalkthroughStore {
  /** The story the viewer picked; one per role. Null until a tour starts. */
  story: string | null;
  setStory: (story: string | null) => void;
  /** Move the screen with each step. Off: the story runs, the viewer stays put. */
  follow: boolean;
  setFollow: (on: boolean) => void;
  /** Stop after each step and open the reader. */
  explain: boolean;
  setExplain: (on: boolean) => void;
  /** The open reader. The story waits while this is set. */
  explanation: WalkthroughExplanation | null;
  setExplanation: (explanation: WalkthroughExplanation | null) => void;
  /** Screen switches in flight. The loader covers the page while above zero. */
  pending: number;
  /** A Back or Next asked for outside the bar (the reader, the arrow keys). */
  stepRequest: { dir: StepDirection; n: number } | null;
  requestStep: (dir: StepDirection) => void;
  /** Spoken narration on. Persisted; on by default. */
  sound: boolean;
  setSound: (on: boolean) => void;
  /** The reader's countdown is paused; the clip holds with it. */
  readerPaused: boolean;
  setReaderPaused: (on: boolean) => void;
  /** "Show me how" is ringing the menu item; the clip holds while it does. */
  showMeHow: boolean;
  setShowMeHow: (on: boolean) => void;
  narration: WalkthroughNarration;
  setNarration: (patch: Partial<WalkthroughNarration>) => void;
}

export const useWalkthroughStore = create<WalkthroughStore>((set) => ({
  story: null,
  setStory: (story) => set({ story }),
  follow: typeof window === 'undefined' ? true : read(FOLLOW_KEY, true),
  setFollow: (on) => {
    write(FOLLOW_KEY, on);
    set({ follow: on });
  },
  // Explain is on by default for users: the reader is the point of the tour.
  explain: typeof window === 'undefined' ? true : read(EXPLAIN_KEY, true),
  // Turning Explain off also lets a waiting story carry on.
  setExplain: (on) => {
    write(EXPLAIN_KEY, on);
    set(
      on
        ? { explain: true }
        : { explain: false, explanation: null, readerPaused: false, showMeHow: false },
    );
  },
  explanation: null,
  // A new reader starts unpaused, with no spotlight up.
  setExplanation: (explanation) => set({ explanation, readerPaused: false, showMeHow: false }),
  pending: 0,
  stepRequest: null,
  requestStep: (dir) => set((s) => ({ stepRequest: { dir, n: (s.stepRequest?.n ?? 0) + 1 } })),
  sound: typeof window === 'undefined' ? true : readSound(),
  setSound: (on) => {
    writeSound(on);
    set({ sound: on });
  },
  readerPaused: false,
  setReaderPaused: (on) => set({ readerPaused: on }),
  showMeHow: false,
  setShowMeHow: (on) => set({ showMeHow: on }),
  narration: NARRATION_IDLE,
  setNarration: (patch) => set((s) => ({ narration: { ...s.narration, ...patch } })),
}));

/**
 * Run a screen switch with the loader up. A switch that leaves the page empty
 * while it lands reads as a broken app; the loader says what is happening.
 */
export async function withSwitch<T>(work: () => Promise<T>): Promise<T> {
  const { setState } = useWalkthroughStore;
  setState((s) => ({ pending: s.pending + 1 }));
  try {
    return await work();
  } finally {
    setState((s) => ({ pending: Math.max(0, s.pending - 1) }));
  }
}
