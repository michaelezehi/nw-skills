// The loop and the focus pass: a step with focus waits for its pass before
// the reader opens; a same-page step whose focus clicks its tab moves the
// query only as a fallback once the pass is over; a pop-up param the last
// step opened comes off on the next step and when the tour ends.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/1',
}));
vi.mock('../useNarration', () => ({
  useNarration: () => undefined,
  stopNarration: () => undefined,
  unlockNarration: () => undefined,
}));
// The host lists its pop-up params; this test plays one that lists `companion`.
vi.mock('../opener-params', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../opener-params')>();
  return {
    ...actual,
    withoutOpeners: (search: string, route?: string) => actual.withoutOpeners(search, route, ['companion']),
  };
});

import { Walkthrough, startTour } from '../Walkthrough';
import { FOCUS_FIND_MS } from '../focus-guide';
import { useWalkthroughStore } from '../walkthrough-store';
import type { WalkthroughStep, WalkthroughStory } from '../story-types';

function step(n: number, patch: Partial<WalkthroughStep>): WalkthroughStep {
  return {
    id: `s${n}`,
    index: n - 1,
    title: `Step title ${n}`,
    route: '/app/1',
    viewAs: null,
    holdMs: 1000,
    explain: { art: 'default', what: `What ${n}.`, why: 'Why.' },
    ...patch,
  };
}

const TAB_STORY: WalkthroughStory = {
  key: 'founder',
  label: 'Founder story',
  steps: [
    step(1, { route: '/app/1?tab=reports', focus: [{ name: 'Reports', role: 'tab', click: true }] }),
    step(2, {}),
    step(3, {}),
  ],
};

const POPUP_STORY: WalkthroughStory = {
  key: 'founder',
  label: 'Founder story',
  steps: [step(1, { route: '/app/1?companion=1' }), step(2, {}), step(3, {})],
};

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  router.push.mockReset();
  router.replace.mockReset();
  window.history.replaceState(null, '', '/app/1');
  useWalkthroughStore.setState({ explain: true, follow: true, explanation: null, story: null, focusing: null });
  startTour('founder');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('Walkthrough loop with a focus pass', () => {
  it('waits for the pass, then moves the tab query only as the fallback', async () => {
    render(<Walkthrough stories={{ founder: TAB_STORY }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();
    // The pass is looking for the tab; the query waits and so does the reader.
    expect(useWalkthroughStore.getState().focusing?.id).toBe('s1');
    expect(router.push).not.toHaveBeenCalled();
    expect(useWalkthroughStore.getState().explanation).toBeNull();

    // No tab ever shows up: the pass gives up and the query moves the page instead.
    await flush(FOCUS_FIND_MS + 200);
    expect(useWalkthroughStore.getState().focusing).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/app/1?tab=reports');
    expect(useWalkthroughStore.getState().explanation?.step.id).toBe('s1');
  });

  it('clicks the tab itself when it is there, after the light has shown', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button role="tab" id="reports">Reports</button>');
    const tab = document.getElementById('reports')!;
    tab.getBoundingClientRect = () => ({ left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 }) as DOMRect;
    const clicked = vi.fn();
    tab.addEventListener('click', clicked);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

    render(<Walkthrough stories={{ founder: TAB_STORY }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush(3000);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(useWalkthroughStore.getState().focusing).toBeNull();
    expect(useWalkthroughStore.getState().explanation?.step.id).toBe('s1');
    tab.remove();
  });

  it('takes a pop-up param off on the next step and when the tour ends', async () => {
    render(<Walkthrough stories={{ founder: POPUP_STORY }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();
    expect(router.push).toHaveBeenCalledWith('/app/1?companion=1');
    window.history.replaceState(null, '', '/app/1?companion=1');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await flush();
    expect(router.replace).toHaveBeenCalledWith('/app/1');
    expect(useWalkthroughStore.getState().explanation?.step.id).toBe('s2');

    router.replace.mockReset();
    fireEvent.click(screen.getByRole('button', { name: 'End the tour' }));
    await flush();
    expect(router.replace).toHaveBeenCalledWith('/app/1');
  });
});
