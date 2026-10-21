'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CaretUpDownIcon } from '@phosphor-icons/react';

import type { WalkthroughStory } from './story-types';
import { startTour } from './Walkthrough';
import { JourneyIcon } from './journey-icons';
import { WALKTHROUGH_COPY as COPY } from './walkthrough-copy';
import { stopNarration, unlockNarration } from './useNarration';
import { cx } from './walkthrough-ui';

/**
 * The story in the bar, as a picker: every story this viewer may take, each
 * with the icon of its first step, dashed hairlines between them. Picking
 * one cuts the narration and jumps there; each story keeps its own place, so
 * coming back resumes where it stopped.
 *
 * This is a plain select-only combobox (a button with role combobox and a
 * listbox under it), so the template needs no host import. A host with a
 * design-system Combobox swaps the markup below for it and keeps `pick`:
 * same options, same value, same icons. Never a raw `<select>`.
 */
export function StoryPicker({ stories, current }: { stories: Record<string, WalkthroughStory>; current: string }) {
  const options = Object.values(stories);
  const selected = Math.max(
    0,
    options.findIndex((story) => story.key === current),
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  // A press anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const show = (at: number) => {
    setActive(at);
    setOpen(true);
  };

  const pick = (key: string) => {
    setOpen(false);
    if (key === current) return;
    unlockNarration();
    stopNarration();
    startTour(key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      if (open) setActive(moves[event.key]!);
      else show(selected);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) pick(options[active]!.key);
      else show(selected);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
    }
  };

  const currentStory = options[selected];

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={COPY.pickStory}
        title={COPY.pickStory}
        data-testid="walkthrough-story-picker"
        data-value={current}
        onClick={() => (open ? setOpen(false) : show(selected))}
        onKeyDown={onKeyDown}
        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--wt-line)] bg-[var(--wt-surface)] pe-3 ps-2 text-xs font-semibold text-[var(--wt-ink-strong)] transition-colors hover:bg-[var(--wt-hover)]"
      >
        <JourneyIcon art={currentStory?.steps[0]?.explain.art} size={20} muted={false} />
        {currentStory?.label}
        <CaretUpDownIcon className="h-3.5 w-3.5 text-[var(--wt-muted)]" weight="bold" aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={COPY.pickStory}
          className="absolute bottom-full start-0 m-0 mb-2 min-w-full list-none overflow-hidden rounded-[16px] border border-[var(--wt-line)] bg-[var(--wt-surface)] p-1 shadow-[var(--wt-shadow-card)]"
        >
          {options.map((story, i) => (
            <li
              key={story.key}
              id={optionId(i)}
              role="option"
              aria-selected={story.key === current}
              // Keep focus on the combobox, so the keys keep working after a hover.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(story.key)}
              className={cx(
                'flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-2 text-xs font-semibold text-[var(--wt-ink-strong)]',
                // A dashed hairline between the stories, as the journey has between its rows.
                i > 0 && 'border-t border-dashed border-[var(--wt-dots)]',
                i === active && 'rounded-[12px] bg-[var(--wt-hover)]',
              )}
            >
              <JourneyIcon art={story.steps[0]?.explain.art} size={20} muted={false} />
              {story.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
