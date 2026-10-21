// The loop: Play shows each step and opens the reader; closing the reader
// moves on; Back stops the loop, steps back and reopens the reader there;
// Start over goes back to the top. With Explain off a step holds for its time
// and then for the rest of its lead clip. Runs the real local driver.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const push = vi.hoisted(() => vi.fn());
const path = vi.hoisted(() => ({ current: '/app/1' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => path.current,
}));

const fake = vi.hoisted(() => ({
  token: 0,
  plays: [] as string[],
  listener: null as null | ((token: number, outcome: 'ended' | 'failed') => void),
}));
vi.mock('../narration-player', () => ({
  play: (url: string) => {
    fake.token += 1;
    fake.plays.push(url);
    return fake.token;
  },
  pause: () => undefined,
  resume: () => undefined,
  stop: () => undefined,
  unlock: () => undefined,
  getProgress: () => null,
  subscribe: (cb: typeof fake.listener) => {
    fake.listener = cb;
    return () => undefined;
  },
}));

import { Walkthrough, startTour } from '../Walkthrough';
import { NARRATION_IDLE, useWalkthroughStore } from '../walkthrough-store';
import { LEAD_CEILING_MS } from '../useWalkthroughLoop';
import { __resetNarrationForTests } from '../useNarration';
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

const SPOKEN: WalkthroughStory = {
  ...STORY,
  steps: STORY.steps.map((step) => ({ ...step, narration: { lead: 'Lead.', detail: 'Detail.' } })),
};

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetNarrationForTests();
  fake.token = 0;
  fake.plays.length = 0;
  fake.listener = null;
  useWalkthroughStore.setState({
    explain: true,
    follow: true,
    explanation: null,
    story: null,
    sound: true,
    narration: NARRATION_IDLE,
  });
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

  it('with Explain off, holds past holdMs until the lead clip is over', async () => {
    useWalkthroughStore.setState({ explain: false });
    render(<Walkthrough stories={{ founder: SPOKEN }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();
    expect(fake.plays).toEqual(['/audio/walkthrough/founder/s1/lead.mp3']);
    await flush(3000);
    expect(screen.getByText('Founder story · Step 1 of 3')).toBeTruthy();
    act(() => fake.listener?.(fake.token, 'ended'));
    await flush();
    expect(screen.getByText('Founder story · Step 2 of 3')).toBeTruthy();
  });

  it('with Explain off, gives up on a lead clip that never ends after the ceiling', async () => {
    useWalkthroughStore.setState({ explain: false });
    render(<Walkthrough stories={{ founder: SPOKEN }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush(1000 + LEAD_CEILING_MS - 250);
    expect(screen.getByText('Founder story · Step 1 of 3')).toBeTruthy();
    await flush(250);
    expect(screen.getByText('Founder story · Step 2 of 3')).toBeTruthy();
  });

  it('with sound off, a narrated step keeps its plain hold', async () => {
    useWalkthroughStore.setState({ explain: false, sound: false });
    render(<Walkthrough stories={{ founder: SPOKEN }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush(1000);
    expect(screen.getByText('Founder story · Step 2 of 3')).toBeTruthy();
    expect(fake.plays).toEqual([]);
  });

  it('the Sound switch in the bar turns narration off and on', async () => {
    render(<Walkthrough stories={{ founder: SPOKEN }} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('switch', { name: /Sound/ }));
    expect(useWalkthroughStore.getState().sound).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: /Sound/ }));
    expect(useWalkthroughStore.getState().sound).toBe(true);
  });
});
