// The story picker: with more than one story the bar names the story in a
// picker and shows only the step count beside it; picking another story,
// by pointer or by keys, cuts the narration and jumps there. One story keeps
// the plain "Story · Step n of m" line. Arrow keys inside the picker stay
// with the picker.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/me/overview',
}));
const narration = vi.hoisted(() => ({ stop: vi.fn(), unlock: vi.fn() }));
vi.mock('../useNarration', () => ({
  useNarration: () => undefined,
  stopNarration: narration.stop,
  unlockNarration: narration.unlock,
}));

import { Walkthrough, startTour } from '../Walkthrough';
import { useStepKeys } from '../useStepKeys';
import { useWalkthroughStore } from '../walkthrough-store';
import type { WalkthroughStory } from '../story-types';

function story(key: string, label: string): WalkthroughStory {
  return {
    key,
    label,
    steps: [1, 2, 3].map((n) => ({
      id: `${key}-${n}`,
      index: n - 1,
      title: `${label} step ${n}`,
      route: '/me/overview',
      viewAs: null,
      holdMs: 1000,
      explain: { art: 'default', what: 'What.', why: 'Why.' },
    })),
  };
}

const EMPLOYEE = story('employee', 'Employee story');
const MANAGER = story('lineManager', 'Line manager story');
const BOTH = { employee: EMPLOYEE, lineManager: MANAGER };

beforeEach(() => {
  vi.useFakeTimers();
  narration.stop.mockReset();
  useWalkthroughStore.setState({ explain: false, follow: true, explanation: null, story: null, stepRequest: null });
  startTour('employee');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('StoryPicker', () => {
  it('names the story in a picker beside the step count, and jumps on a pick', async () => {
    render(<Walkthrough stories={BOTH} viewerId="u1" />);
    await flush();
    const picker = screen.getByRole('combobox', { name: 'Choose a story' });
    expect(picker.getAttribute('data-value')).toBe('employee');
    expect(picker.textContent).toContain('Employee story');
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();

    fireEvent.click(picker);
    expect(picker.getAttribute('aria-expanded')).toBe('true');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(options[1]!.className).toContain('border-dashed');
    fireEvent.click(screen.getByRole('option', { name: 'Line manager story' }));
    expect(useWalkthroughStore.getState().story).toBe('lineManager');
    expect(narration.stop).toHaveBeenCalledTimes(1);
  });

  it('picks by keys: down opens, down moves, enter jumps, escape closes', async () => {
    render(<Walkthrough stories={BOTH} viewerId="u1" />);
    await flush();
    const picker = screen.getByRole('combobox', { name: 'Choose a story' });
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(picker, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    expect(picker.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]!.id);
    // The arrows moved the list, never the story.
    expect(useWalkthroughStore.getState().stepRequest).toBeNull();
    fireEvent.keyDown(picker, { key: 'Enter' });
    expect(useWalkthroughStore.getState().story).toBe('lineManager');
  });

  it('picking the story already on leaves it alone', async () => {
    render(<Walkthrough stories={BOTH} viewerId="u1" />);
    await flush();
    fireEvent.click(screen.getByRole('combobox', { name: 'Choose a story' }));
    fireEvent.click(screen.getByRole('option', { name: 'Employee story' }));
    expect(useWalkthroughStore.getState().story).toBe('employee');
    expect(narration.stop).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the plain story line when there is only one story', async () => {
    render(<Walkthrough stories={{ employee: EMPLOYEE }} viewerId="u1" />);
    await flush();
    expect(screen.queryByTestId('walkthrough-story-picker')).toBeNull();
    expect(screen.getByText('Employee story · Step 1 of 3')).toBeTruthy();
  });

  it('switching story closes the last story reader', () => {
    useWalkthroughStore.setState({
      explanation: { step: EMPLOYEE.steps[0]!, storyLabel: 'Employee story', total: 3, steps: [] },
    });
    startTour('lineManager');
    expect(useWalkthroughStore.getState().explanation).toBeNull();
  });

  it('leaves the arrow keys to an open list', () => {
    function Keys() {
      useStepKeys(true);
      return (
        <ul role="listbox">
          <li role="option" aria-selected tabIndex={0}>
            Employee story
          </li>
        </ul>
      );
    }
    render(<Keys />);
    fireEvent.keyDown(screen.getByRole('option'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('option'), { key: 'ArrowRight' });
    expect(useWalkthroughStore.getState().stepRequest).toBeNull();
  });
});
