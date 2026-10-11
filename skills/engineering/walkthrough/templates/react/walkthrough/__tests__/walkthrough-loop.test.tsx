// The loop: Play shows each step and opens the reader; closing the reader
// moves on; Back stops the loop, steps back and reopens the reader there;
// Start over goes back to the top. Runs the real local driver.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const push = vi.hoisted(() => vi.fn());
const path = vi.hoisted(() => ({ current: '/app/1' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => path.current,
}));

import { Walkthrough, startTour } from '../Walkthrough';
import { useWalkthroughStore } from '../walkthrough-store';
import type { WalkthroughStory } from '../story-types';

const STORY: WalkthroughStory = {
  key: 'founder',
  label: 'Founder story',
  steps: [1, 2, 3].map((n) => ({
    id: `s${n}`,
    index: n - 1,
    title: `Step title ${n}`,
    // Every step on the current page: the loop never waits on a route change.
    route: '/app/1',
    viewAs: null,
    holdMs: 1000,
    explain: { art: 'default', what: `What ${n}.`, why: 'Why.' },
  })),
};

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useWalkthroughStore.setState({ explain: true, follow: true, explanation: null, story: null });
  startTour('founder');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('Walkthrough loop', () => {
  it('plays step by step through the reader, steps back, and starts over', async () => {
    render(<Walkthrough stories={{ founder: STORY }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();
    expect(useWalkthroughStore.getState().explanation?.step.id).toBe('s1');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await flush();
    expect(useWalkthroughStore.getState().explanation?.step.id).toBe('s2');
    expect(screen.getByText('Founder story · Step 2 of 3')).toBeTruthy();

    // Back: the loop stops, the run pauses on step one, and its reader opens.
    act(() => useWalkthroughStore.getState().requestStep('back'));
    await flush();
    expect(useWalkthroughStore.getState().explanation?.step.id).toBe('s1');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    await flush();
    expect(useWalkthroughStore.getState().explanation).toBeNull();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('holds each step for its time when Explain is off', async () => {
    useWalkthroughStore.setState({ explain: false });
    render(<Walkthrough stories={{ founder: STORY }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();
    expect(screen.getByText('Founder story · Step 1 of 3')).toBeTruthy();
    await flush(1000);
    expect(screen.getByText('Founder story · Step 2 of 3')).toBeTruthy();
  });
});
