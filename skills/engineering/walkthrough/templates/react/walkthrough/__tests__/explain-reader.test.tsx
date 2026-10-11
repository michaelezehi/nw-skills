// The reader: shows the step's picture and copy, counts down, pauses on
// request, closes on Continue or at zero (which lets the story carry on),
// and asks the bar for the previous step.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ExplainReader, EXPLAIN_SECONDS } from '../ExplainReader';
import { useWalkthroughStore } from '../walkthrough-store';

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
  },
};

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useWalkthroughStore.setState({ explanation: EXPLANATION, pending: 0, stepRequest: null });
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
    expect(screen.getAllByText('Dana sets a task')[1]!.getAttribute('aria-current')).toBe('step');
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
});
