// The journey: the step on screen first, then the steps still to come in
// story order, then the done steps at the bottom with a tick. Moving on by
// one step opens in the last step's order and then moves; with reduced motion
// the list shows the new order straight away.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motion.reduce };
});

import { JOURNEY_SETTLE_MS, JourneyList, journeyOrder, resetJourneyMemory } from '../JourneyList';
import { journeyArt } from '../journey-icons';

const STEPS = ['Your home', 'Check your own record', 'Book time off', 'Payslips', 'Set goals'];

function rows() {
  return Array.from(screen.getByTestId('walkthrough-journey').querySelectorAll('li'));
}

function titles() {
  return rows().map((li) => li.querySelector('span.block:last-child')!.textContent);
}

beforeEach(() => {
  vi.useFakeTimers();
  motion.reduce = false;
  resetJourneyMemory();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('journeyOrder', () => {
  it('puts the current step first, then what is to come, then what is done', () => {
    expect(journeyOrder(5, 2)).toEqual([2, 3, 4, 0, 1]);
    expect(journeyOrder(3, 0)).toEqual([0, 1, 2]);
    expect(journeyOrder(3, 2)).toEqual([2, 0, 1]);
  });
});

describe('JourneyList', () => {
  it('shows a step in the middle of a story first, then what is to come, then what is done', () => {
    render(<JourneyList steps={STEPS} current={2} />);
    expect(titles()).toEqual(['Book time off', 'Payslips', 'Set goals', 'Your home', 'Check your own record']);
    expect(rows().map((li) => li.dataset.journeyState)).toEqual(['now', 'next', 'next', 'done', 'done']);
  });

  it('marks only the current row aria-current and says the state of the others', () => {
    render(<JourneyList steps={STEPS} current={2} />);
    const [now, next, , done] = rows();
    expect(now!.getAttribute('aria-current')).toBe('step');
    expect(rows().filter((li) => li.hasAttribute('aria-current'))).toHaveLength(1);
    expect(now!.textContent).toContain('Now');
    expect(next!.querySelector('.sr-only')!.textContent).toBe('Still to come: ');
    expect(done!.querySelector('.sr-only')!.textContent).toBe('Done: ');
  });

  it('puts a check badge on the done rows only', () => {
    render(<JourneyList steps={STEPS} current={2} />);
    expect(rows().map((li) => !!li.querySelector('[data-journey-check]'))).toEqual([false, false, false, true, true]);
  });

  it('separates rows with a dotted hairline, never under the current card', () => {
    render(<JourneyList steps={STEPS} current={2} />);
    const dotted = rows().map((li) => li.className.includes('border-dotted'));
    expect(dotted).toEqual([false, false, true, true, true]);
  });

  it('opens in the last step order after moving on, then moves the finished step to the bottom', async () => {
    const first = render(<JourneyList steps={STEPS} current={1} />);
    first.unmount();
    render(<JourneyList steps={STEPS} current={2} />);
    expect(titles()[0]).toBe('Check your own record');
    // Screen readers hear the real step from the start.
    expect(rows()[1]!.getAttribute('aria-current')).toBe('step');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOURNEY_SETTLE_MS);
    });
    expect(titles()).toEqual(['Book time off', 'Payslips', 'Set goals', 'Your home', 'Check your own record']);
  });

  it('shows the new order straight away with reduced motion', () => {
    motion.reduce = true;
    const first = render(<JourneyList steps={STEPS} current={1} />);
    first.unmount();
    render(<JourneyList steps={STEPS} current={2} />);
    expect(titles()).toEqual(['Book time off', 'Payslips', 'Set goals', 'Your home', 'Check your own record']);
    expect(rows()[0]!.getAttribute('aria-current')).toBe('step');
  });

  it('draws an icon for every row, larger for the current step', () => {
    render(<JourneyList steps={STEPS} current={2} />);
    const sizes = rows().map((li) => li.querySelector<HTMLElement>('[data-journey-icon]')!.style.width);
    expect(sizes).toEqual(['40px', '28px', '28px', '28px', '28px']);
  });

  it('draws each step with its own picture slug, and the default for one the set does not hold', () => {
    render(<JourneyList steps={STEPS} arts={['default', 'no-such-picture']} current={0} />);
    const slugs = rows().map((li) => li.querySelector<HTMLElement>('[data-journey-icon]')!.dataset.journeyIcon);
    expect(slugs).toEqual(['default', 'default', 'default', 'default', 'default']);
    expect(journeyArt('no-such-picture')).toBe('default');
    expect(journeyArt(undefined)).toBe('default');
  });
});
