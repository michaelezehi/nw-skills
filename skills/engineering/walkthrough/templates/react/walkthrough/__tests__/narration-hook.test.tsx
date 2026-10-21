// The narration hook: plays the lead when a step starts, the detail when the
// reader opens on it, pauses with the run, the reader and "Show me how", and
// stops on a step request, a story switch, mute and another tab driving. A
// step with no narration plays nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import type { RunView, WalkthroughStep } from '../story-types';

const fake = vi.hoisted(() => ({
  token: 0,
  calls: [] as string[],
  listener: null as null | ((token: number, outcome: 'ended' | 'failed') => void),
}));

vi.mock('../narration-player', () => ({
  play: (url: string) => {
    fake.token += 1;
    fake.calls.push(`play:${url}`);
    return fake.token;
  },
  pause: () => fake.calls.push('pause'),
  resume: () => fake.calls.push('resume'),
  stop: () => fake.calls.push('stop'),
  unlock: () => fake.calls.push('unlock'),
  getProgress: () => null,
  subscribe: (cb: typeof fake.listener) => {
    fake.listener = cb;
    return () => undefined;
  },
}));

import { NARRATION_IDLE, useWalkthroughStore } from '../walkthrough-store';
import { __resetNarrationForTests, UNMOUNT_GRACE_MS, useNarration } from '../useNarration';

function step(index: number, spoken = true): WalkthroughStep {
  return {
    id: `s${index}`,
    index,
    title: `Step ${index}`,
    route: `/app/${index}`,
    viewAs: null,
    holdMs: 4000,
    explain: { art: 'default', what: 'What.', why: 'Why.' },
    ...(spoken ? { narration: { lead: 'Lead.', detail: 'Detail.' } } : {}),
  };
}

function run(index: number, status: RunView['status'] = 'playing', story = 'founder', spoken = true): RunView {
  return {
    story,
    storyLabel: 'Founder story',
    steps: [],
    index,
    total: 9,
    status,
    lastStep: index > 0 ? step(index - 1, spoken) : null,
    drivenElsewhere: false,
  };
}

function Host({ view, enabled = true }: { view: RunView | null | undefined; enabled?: boolean }) {
  useNarration(view, enabled);
  return null;
}

function openReader(s: WalkthroughStep) {
  act(() => {
    useWalkthroughStore.getState().setExplanation({ step: s, storyLabel: 'Founder story', total: 9, steps: [] });
  });
}

function end(outcome: 'ended' | 'failed' = 'ended') {
  act(() => fake.listener?.(fake.token, outcome));
}

const plays = () => fake.calls.filter((c) => c.startsWith('play'));

beforeEach(() => {
  vi.useFakeTimers();
  __resetNarrationForTests();
  fake.token = 0;
  fake.calls.length = 0;
  fake.listener = null;
  useWalkthroughStore.setState({
    narration: NARRATION_IDLE,
    sound: true,
    explanation: null,
    readerPaused: false,
    showMeHow: false,
    stepRequest: null,
    story: 'founder',
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useNarration', () => {
  it('stays quiet for a step already on screen, then stops and plays the lead of each new one', () => {
    const { rerender } = render(<Host view={null} />);
    rerender(<Host view={run(3)} />);
    expect(plays()).toEqual([]);

    fake.calls.length = 0;
    rerender(<Host view={run(4)} />);
    expect(fake.calls).toEqual(['stop', 'play:/audio/walkthrough/founder/s3/lead.mp3']);
    expect(useWalkthroughStore.getState().narration).toMatchObject({ stepId: 's3', lead: 'playing' });
  });

  it('plays the detail when the reader opens, only after the lead ends', () => {
    const { rerender } = render(<Host view={run(0)} />);
    rerender(<Host view={run(1)} />);
    openReader(step(0));
    expect(fake.calls).not.toContain('play:/audio/walkthrough/founder/s0/detail.mp3');

    end();
    expect(fake.calls.at(-1)).toBe('play:/audio/walkthrough/founder/s0/detail.mp3');
    expect(useWalkthroughStore.getState().narration).toMatchObject({ lead: 'done', detail: 'playing' });

    end();
    expect(useWalkthroughStore.getState().narration.detail).toBe('done');
  });

  it('plays the detail at once when the lead failed', () => {
    const { rerender } = render(<Host view={run(0)} />);
    rerender(<Host view={run(1)} />);
    end('failed');
    openReader(step(0));
    expect(fake.calls.at(-1)).toBe('play:/audio/walkthrough/founder/s0/detail.mp3');
  });

  it('plays nothing for a step without narration', () => {
    const { rerender } = render(<Host view={run(0, 'playing', 'founder', false)} />);
    rerender(<Host view={run(1, 'playing', 'founder', false)} />);
    openReader(step(0, false));
    expect(plays()).toEqual([]);
    expect(useWalkthroughStore.getState().narration).toMatchObject({ stepId: 's0', lead: 'idle', detail: 'idle' });
  });

  it('pauses with the run, the reader and Show me how, and resumes after', () => {
    const { rerender } = render(<Host view={run(0)} />);
    rerender(<Host view={run(1)} />);
    fake.calls.length = 0;

    rerender(<Host view={run(1, 'paused')} />);
    expect(fake.calls).toEqual(['pause']);
    rerender(<Host view={run(1, 'playing')} />);
    expect(fake.calls).toEqual(['pause', 'resume']);

    fake.calls.length = 0;
    act(() => useWalkthroughStore.getState().setReaderPaused(true));
    act(() => useWalkthroughStore.getState().setReaderPaused(false));
    act(() => useWalkthroughStore.getState().setShowMeHow(true));
    act(() => useWalkthroughStore.getState().setShowMeHow(false));
    expect(fake.calls).toEqual(['pause', 'resume', 'pause', 'resume']);
  });

  it('stops on a step request, a story switch and sound off', () => {
    render(<Host view={run(1)} />);
    fake.calls.length = 0;
    act(() => useWalkthroughStore.getState().requestStep('back'));
    expect(fake.calls).toEqual(['stop']);

    fake.calls.length = 0;
    act(() => useWalkthroughStore.getState().setStory('coach'));
    expect(fake.calls).toEqual(['stop']);

    fake.calls.length = 0;
    act(() => useWalkthroughStore.getState().setSound(false));
    expect(fake.calls).toEqual(['stop']);
  });

  it('does not play the other story when the story switches', () => {
    const { rerender } = render(<Host view={run(2)} />);
    fake.calls.length = 0;
    rerender(<Host view={run(4, 'paused', 'coach')} />);
    expect(fake.calls).toEqual(['stop']);
  });

  it('plays nothing with sound off, or while another tab drives', () => {
    useWalkthroughStore.setState({ sound: false });
    const first = render(<Host view={run(0)} />);
    first.rerender(<Host view={run(1)} />);
    expect(plays()).toEqual([]);
    first.unmount();

    useWalkthroughStore.setState({ sound: true });
    const { rerender } = render(<Host view={run(1)} enabled={false} />);
    expect(fake.calls).toContain('stop');
    rerender(<Host view={run(2)} enabled={false} />);
    expect(plays()).toEqual([]);
  });

  it('keeps playing through a remount, and stops once it is gone for good', () => {
    const { rerender, unmount } = render(<Host view={run(0)} />);
    rerender(<Host view={run(1)} />);
    fake.calls.length = 0;

    // A persona switch into another layout: unmount, then mount again on the same step.
    unmount();
    render(<Host view={run(1)} />);
    act(() => {
      vi.advanceTimersByTime(UNMOUNT_GRACE_MS * 2);
    });
    expect(fake.calls).not.toContain('stop');
    expect(plays()).toEqual([]);

    cleanup();
    act(() => {
      vi.advanceTimersByTime(UNMOUNT_GRACE_MS);
    });
    expect(fake.calls).toContain('stop');
  });
});
