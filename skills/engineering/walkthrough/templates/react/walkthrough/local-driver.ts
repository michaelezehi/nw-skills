import type { RunView, WalkthroughDriver, WalkthroughStory } from './story-types';

/**
 * The run held in the browser, for a user walkthrough that writes no data.
 * Progress is kept per viewer and per story in localStorage, so a viewer who
 * leaves at step 4 comes back to step 4. Storage that throws (private mode,
 * blocked site data) just means the tour starts from the top next time.
 */

interface Saved {
  index: number;
  status: RunView['status'];
}

const keyFor = (viewerId: string, story: string) => `wt-run:${viewerId}:${story}`;

function load(key: string): Saved {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { index: 0, status: 'idle' };
    const saved = JSON.parse(raw) as Saved;
    // A tour left playing comes back paused: nothing should move on its own after a reload.
    return { index: saved.index, status: saved.status === 'playing' ? 'paused' : saved.status };
  } catch {
    return { index: 0, status: 'idle' };
  }
}

function save(key: string, saved: Saved): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    // Storage blocked: progress lives for this page only.
  }
}

export function viewOf(story: WalkthroughStory, saved: Saved): RunView {
  const total = story.steps.length;
  const index = Math.max(0, Math.min(saved.index, total));
  return {
    story: story.key,
    storyLabel: story.label,
    steps: story.steps.map((s) => s.title),
    arts: story.steps.map((s) => s.explain.art),
    index,
    total,
    status: saved.status,
    lastStep: index > 0 ? story.steps[index - 1]! : null,
    drivenElsewhere: false,
  };
}

/** `onChange` lets the hook re-render on every move; the driver is the only writer. */
export function createLocalDriver(
  story: WalkthroughStory,
  viewerId: string,
  onChange: (view: RunView) => void,
): WalkthroughDriver & { current(): RunView } {
  const key = keyFor(viewerId, story.key);
  let state = load(key);
  const commit = (next: Saved) => {
    state = next;
    save(key, state);
    const view = viewOf(story, state);
    onChange(view);
    return view;
  };
  const total = story.steps.length;

  return {
    current: () => viewOf(story, state),
    async start() {
      if (state.status === 'done') return commit({ index: 0, status: 'playing' });
      return commit({ ...state, status: 'playing' });
    },
    async advance(expectedIndex, { step }) {
      // A stale index, a finished story, or a paused one without a request: no move.
      if (state.index !== expectedIndex || state.status === 'done') return viewOf(story, state);
      if (state.status === 'paused' && !step) return viewOf(story, state);
      const index = expectedIndex + 1;
      const status =
        index >= total ? 'done' : state.status === 'idle' ? 'paused' : state.status;
      return commit({ index, status });
    },
    async back(expectedIndex) {
      if (state.index !== expectedIndex || expectedIndex < 2) return viewOf(story, state);
      return commit({ index: expectedIndex - 1, status: 'paused' });
    },
    async pause() {
      return state.status === 'playing' ? commit({ ...state, status: 'paused' }) : viewOf(story, state);
    },
    async restart() {
      return commit({ index: 0, status: 'idle' });
    },
  };
}
