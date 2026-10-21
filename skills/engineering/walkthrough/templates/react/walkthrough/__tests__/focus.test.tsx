// The focus pass: controls are found by their label (a trailing count
// ignored, every match lit, never the walkthrough's own chrome), the page
// dims around them, a tab the step is about is clicked, and the pass clears
// itself so the story carries on.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

import { FOCUS_FADE_MS, FOCUS_HOLD_MS, FocusLayer, focusStages, primaryFocus } from '../FocusLayer';
import { findFocusTargets, nameMatches } from '../focus-guide';
import { WALKTHROUGH_UI_ATTR } from '../nav-guide';
import { useWalkthroughStore } from '../walkthrough-store';
import type { WalkthroughStep } from '../story-types';

// A host with a catalog names targets by key and resolves them.
const LABELS: Record<string, string> = { 'k.assistant': 'Assistant', 'k.timeOff': 'Time off' };
const t = (key: string) => LABELS[key] ?? key;

// jsdom lays nothing out; give every element a box so it counts as shown.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    top: 10,
    right: 110,
    bottom: 40,
    width: 100,
    height: 30,
    x: 10,
    y: 10,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  useWalkthroughStore.setState({ focusing: null });
});

describe('findFocusTargets', () => {
  it('lights every control with the label, by text or aria-label', () => {
    document.body.innerHTML = `
      <header><button>Assistant</button></header>
      <button aria-label="Assistant"><svg></svg></button>
      <button>Settings</button>`;
    const found = findFocusTargets([{ name: 'k.assistant' }], t).flat();
    expect(found).toHaveLength(2);
    expect(found.every((f) => !f.click)).toBe(true);
  });

  it('matches the label as shown when no resolver is given', () => {
    document.body.innerHTML = `<button>Assistant</button>`;
    expect(findFocusTargets([{ name: 'Assistant' }]).flat()).toHaveLength(1);
  });

  it('takes a tab with its count, and skips menu links, hidden copies and the walkthrough chrome', () => {
    document.body.innerHTML = `
      <nav><a href="/time-off">Time off</a></nav>
      <div role="tablist"><button role="tab"><span>Time off</span><span>4</span></button></div>
      <div aria-hidden="true"><button role="tab">Time off</button></div>
      <div ${WALKTHROUGH_UI_ATTR}><button role="tab">Time off</button></div>`;
    const found = findFocusTargets([{ name: 'k.timeOff', role: 'tab', click: true }], t).flat();
    expect(found).toHaveLength(1);
    expect(found[0]!.element.textContent).toBe('Time off4');
    expect(found[0]!.click).toBe(true);
  });

  it('matches a label with a count or a dot after it, never a longer label', () => {
    expect(nameMatches('not checked in (49)', 'not checked in')).toBe(true);
    expect(nameMatches('payroll handoff.', 'payroll handoff')).toBe(true);
    expect(nameMatches('upcoming holidays', 'upcoming')).toBe(false);
  });

  it('rings the card round a heading when the spec asks for its area', () => {
    document.body.innerHTML = `<div id="card" style="border-top-left-radius: 26px"><div><h3>Assistant</h3></div></div>`;
    const card = document.getElementById('card')!;
    card.getBoundingClientRect = () => ({ width: 300, height: 160 }) as DOMRect;
    const [found] = findFocusTargets([{ name: 'k.assistant', area: true }], t);
    expect(found![0]!.element.id).toBe('card');
  });

  it('rings the section round a label, not the pill round its text', () => {
    document.body.innerHTML = `<div id="row"><div id="cell"><div><span id="pill" style="border-top-left-radius: 999px"><p>Assistant</p></span></div></div></div>`;
    const heights: Record<string, number> = { pill: 24, cell: 96 };
    document.querySelectorAll<HTMLElement>('div, span').forEach((el) => {
      const height = heights[el.id] ?? 60;
      el.getBoundingClientRect = () => ({ width: el.id === 'row' ? 5000 : 200, height }) as DOMRect;
    });
    const [found] = findFocusTargets([{ name: 'k.assistant', area: true }], t);
    expect(found![0]!.element.id).toBe('cell');
  });

  it('lights only what the step clicks, or its first control', () => {
    expect(primaryFocus([{ name: 'a' }, { name: 'b', click: true }, { name: 'c' }])).toEqual([
      { name: 'b', click: true },
    ]);
    expect(primaryFocus([{ name: 'a' }, { name: 'b', area: true }])).toEqual([{ name: 'a' }]);
  });

  it('splits the specs into stages at each click', () => {
    expect(
      focusStages([{ name: 'a', click: true }, { name: 'b' }, { name: 'c' }, { selector: 'd', click: true }]),
    ).toEqual([[{ name: 'a', click: true }], [{ name: 'b' }, { name: 'c' }, { selector: 'd', click: true }]]);
  });

  it('waits out a control that is still fading in', () => {
    document.body.innerHTML = `<div style="opacity: 0"><button>Assistant</button></div>`;
    expect(findFocusTargets([{ name: 'k.assistant' }], t).flat()).toHaveLength(0);
  });

  it('finds a control with no label by its selector', () => {
    document.body.innerHTML = `<div data-dock="todo"><button>36</button></div>`;
    expect(findFocusTargets([{ selector: '[data-dock="todo"]' }], t).flat()).toHaveLength(1);
  });
});

const STEP: WalkthroughStep = {
  id: 'leave-policies',
  index: 5,
  title: 'Leave',
  route: '/schedule?tab=timeOff',
  viewAs: null,
  holdMs: 8000,
  explain: { art: 'default', what: 'What.', why: 'Why.' },
  focus: [{ name: 'Time off', role: 'tab', click: true }],
};

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('FocusLayer', () => {
  it('dims round the control, clicks it after the hold, then clears itself', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    document.body.innerHTML = '<button role="tab">Time off</button>';
    const tab = document.querySelector('button')!;
    const clicked = vi.fn();
    tab.addEventListener('click', clicked);

    render(<FocusLayer />);
    act(() => useWalkthroughStore.getState().setFocusing(STEP));
    await tick(0);
    expect(screen.getByTestId('walkthrough-focus')).toBeTruthy();
    expect(clicked).not.toHaveBeenCalled();

    await tick(FOCUS_HOLD_MS);
    expect(clicked).toHaveBeenCalledTimes(1);
    await tick(FOCUS_FADE_MS);
    expect(useWalkthroughStore.getState().focusing).toBeNull();
  });

  it('clears at once when none of the controls ever shows up', async () => {
    vi.useFakeTimers();
    render(<FocusLayer />);
    act(() => useWalkthroughStore.getState().setFocusing(STEP));
    await tick(3000);
    expect(useWalkthroughStore.getState().focusing).toBeNull();
    expect(screen.queryByTestId('walkthrough-focus')).toBeNull();
  });

  it('ends the pass at once when the step is cleared', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    document.body.innerHTML = '<button role="tab">Time off</button>';
    const clicked = vi.fn();
    document.querySelector('button')!.addEventListener('click', clicked);

    render(<FocusLayer />);
    act(() => useWalkthroughStore.getState().setFocusing(STEP));
    await tick(0);
    act(() => useWalkthroughStore.getState().setFocusing(null));
    await tick(FOCUS_HOLD_MS + FOCUS_FADE_MS);
    expect(clicked).not.toHaveBeenCalled();
  });
});
