// The reader: shows the step's picture and copy, counts down, pauses on
// request, closes on Continue or at zero (which lets the story carry on),
// and asks the bar for the previous step. With sound on it waits for the
// spoken detail instead, then a short grace, never past the ceiling. It
// sits clear of what the step is about, dropping to a short bottom panel with
// no picture when both sides would cover it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CLIP_CEILING_MS, DETAIL_GRACE_MS, ExplainReader, EXPLAIN_SECONDS } from '../ExplainReader';
import { NARRATION_IDLE, useWalkthroughStore, type WalkthroughNarration } from '../walkthrough-store';

const EXPLANATION = {
  storyLabel: 'Coach story',
  total: 7,
  steps: ['Dana invites the team', 'The founders choose', 'Dana sets a task', 'The founders see the task'],
  step: {
    id: 'coach-sets-task',
    index: 2,
    title: 'Dana sets a task',
    viewAs: null,
    route: '/coach/assignments',
    holdMs: 8000,
    explain: { art: 'default', what: 'Dana set the team a task.', why: 'Work between sessions.' },
    narration: { lead: 'Dana sets a task.', detail: 'The task waits for the team.' },
  },
};

function speaking(patch: Partial<WalkthroughNarration>) {
  useWalkthroughStore.setState({
    narration: { ...NARRATION_IDLE, seen: true, stepId: 'coach-sets-task', story: 'coach', ...patch },
  });
}

async function closesAt(ms: number) {
  await tick(ms - 250);
  expect(useWalkthroughStore.getState().explanation).not.toBeNull();
  await tick(250);
  expect(useWalkthroughStore.getState().explanation).toBeNull();
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useWalkthroughStore.setState({
    explanation: EXPLANATION,
    pending: 0,
    stepRequest: null,
    readerPaused: false,
    showMeHow: false,
    sound: true,
    narration: NARRATION_IDLE,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useWalkthroughStore.setState({ explanation: null });
});

describe('ExplainReader', () => {
  it('shows the story, the step, what happened and the journey', () => {
    render(<ExplainReader />);
    expect(screen.getByText('Coach story')).toBeTruthy();
    expect(screen.getByText('Step 3 of 7')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dana sets a task' })).toBeTruthy();
    const journey = screen.getByTestId('walkthrough-journey');
    expect(journey.querySelector('[aria-current="step"]')!.textContent).toContain('Dana sets a task');
    expect(screen.getByText('Dana set the team a task.')).toBeTruthy();
    expect(screen.getByText('Work between sessions.')).toBeTruthy();
  });

  it('closes on Continue', () => {
    render(<ExplainReader />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(useWalkthroughStore.getState().explanation).toBeNull();
  });

  it('closes when the countdown runs out, and holds while paused or switching', async () => {
    render(<ExplainReader />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause the countdown' }));
    await tick(EXPLAIN_SECONDS * 1000 + 500);
    expect(useWalkthroughStore.getState().explanation).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume the countdown' }));
    act(() => useWalkthroughStore.setState({ pending: 1 }));
    await tick(EXPLAIN_SECONDS * 1000 + 500);
    expect(useWalkthroughStore.getState().explanation).not.toBeNull();
    act(() => useWalkthroughStore.setState({ pending: 0 }));
    await tick(EXPLAIN_SECONDS * 1000 + 500);
    expect(useWalkthroughStore.getState().explanation).toBeNull();
  });

  it('asks the bar for the previous step', () => {
    render(<ExplainReader />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(useWalkthroughStore.getState().stepRequest?.dir).toBe('back');
  });

  it('with sound on, waits for the detail clip, then closes 1.5s after it ends', async () => {
    speaking({ lead: 'done', detail: 'playing' });
    render(<ExplainReader />);
    await tick(EXPLAIN_SECONDS * 1000 + 10_000);
    expect(useWalkthroughStore.getState().explanation).not.toBeNull();
    await act(async () => speaking({ lead: 'done', detail: 'done' }));
    await closesAt(DETAIL_GRACE_MS);
  });

  it('with sound on, also waits while the lead is still playing', async () => {
    speaking({ lead: 'playing', detail: 'idle' });
    render(<ExplainReader />);
    await tick(EXPLAIN_SECONDS * 1000 + 500);
    expect(useWalkthroughStore.getState().explanation).not.toBeNull();
  });

  it('with sound on, gives up on a clip that never ends after the ceiling', async () => {
    speaking({ lead: 'done', detail: 'playing' });
    render(<ExplainReader />);
    await closesAt(CLIP_CEILING_MS);
  });

  it('with sound off, or a failed clip, closes at 30s as before', async () => {
    speaking({ lead: 'done', detail: 'playing' });
    useWalkthroughStore.setState({ sound: false });
    const first = render(<ExplainReader />);
    await closesAt(EXPLAIN_SECONDS * 1000);
    first.unmount();

    act(() => useWalkthroughStore.setState({ explanation: EXPLANATION, sound: true }));
    speaking({ lead: 'failed', detail: 'failed' });
    render(<ExplainReader />);
    await closesAt(EXPLAIN_SECONDS * 1000);
  });

  it('a paused run holds the reader while a clip is under way, and not without one', async () => {
    speaking({ lead: 'done', detail: 'playing', runHold: true });
    const first = render(<ExplainReader />);
    await tick(CLIP_CEILING_MS * 2);
    expect(useWalkthroughStore.getState().explanation).not.toBeNull();
    first.unmount();

    useWalkthroughStore.setState({ sound: false });
    render(<ExplainReader />);
    await tick(EXPLAIN_SECONDS * 1000);
    expect(useWalkthroughStore.getState().explanation).toBeNull();
  });

  it('pausing holds the clip grace too, and the sound button keeps its name', async () => {
    speaking({ lead: 'done', detail: 'done' });
    render(<ExplainReader />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause the countdown' }));
    expect(useWalkthroughStore.getState().readerPaused).toBe(true);
    await tick(DETAIL_GRACE_MS * 4);
    expect(useWalkthroughStore.getState().explanation).not.toBeNull();

    const toggle = screen.getByRole('button', { name: 'Sound' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(useWalkthroughStore.getState().sound).toBe(false);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Sound' }));
    expect(useWalkthroughStore.getState().sound).toBe(true);
  });

  it('sits on its usual side, and drops to a short panel with no picture when both sides cover the step', () => {
    const first = render(<ExplainReader />);
    expect(screen.getByTestId('walkthrough-reader').getAttribute('data-placement')).toBe('end');
    first.unmount();

    // One control by each edge of the screen: either side would cover one.
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="left">Export</button><button id="right" aria-label="Export"></button>',
    );
    const at = (left: number) => ({ left, right: left + 120, top: 200, bottom: 240, width: 120, height: 40 }) as DOMRect;
    document.getElementById('left')!.getBoundingClientRect = () => at(30);
    document.getElementById('right')!.getBoundingClientRect = () => at(window.innerWidth - 150);
    const step = { ...EXPLANATION.step, focus: [{ name: 'Export' }] };
    act(() => useWalkthroughStore.setState({ explanation: { ...EXPLANATION, step } }));
    render(<ExplainReader />);
    const reader = screen.getByTestId('walkthrough-reader');
    expect(reader.getAttribute('data-placement')).toBe('bottom');
    expect(reader.querySelector('img[src$="default.webp"][width="128"]')).toBeNull();
    document.getElementById('left')!.remove();
    document.getElementById('right')!.remove();
  });
});
