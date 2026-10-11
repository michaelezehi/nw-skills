import { create } from 'zustand';

import type { WalkthroughStep } from './story-types';

/**
 * State the bar, the reader, the keys and the prompt layer must agree on.
 * The bar owns the run; everything else asks it through `stepRequest`, so two
 * components never move the story at once.
 */

const EXPLAIN_KEY = 'wt-explain';
const FOLLOW_KEY = 'wt-follow';

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
    set(on ? { explain: true } : { explain: false, explanation: null });
  },
  explanation: null,
  setExplanation: (explanation) => set({ explanation }),
  pending: 0,
  stepRequest: null,
  requestStep: (dir) => set((s) => ({ stepRequest: { dir, n: (s.stepRequest?.n ?? 0) + 1 } })),
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
