'use client';

import { useEffect, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { CheckIcon } from '@phosphor-icons/react';

import { JourneyIcon } from './journey-icons';
import { WALKTHROUGH_COPY as COPY } from './walkthrough-copy';
import { EYEBROW, cx } from './walkthrough-ui';

/** A row's icon and the current step's icon, in px. */
export const JOURNEY_ICON_PX = 28;
export const JOURNEY_NOW_ICON_PX = 40;
/** How long the list holds the last step's order before it moves, so the reader has slid in first. */
export const JOURNEY_SETTLE_MS = 600;

type RowState = 'now' | 'next' | 'done';

/** Story positions in the order the journey shows them: now, then still to come, then done. */
export function journeyOrder(count: number, current: number): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  return [
    ...all.filter((i) => i === current),
    ...all.filter((i) => i > current),
    ...all.filter((i) => i < current),
  ];
}

function stateOf(i: number, current: number): RowState {
  if (i === current) return 'now';
  return i < current ? 'done' : 'next';
}

/**
 * The reader mounts afresh for every step, so the list remembers the last
 * step it showed for this story. When the story has just moved on by one,
 * the list opens in that step's order and then moves, so the step that
 * finished slides to the bottom and the new one rises to the top.
 */
let lastShown: { story: string; index: number } | null = null;

/** Forget the last step shown. Tests only. */
export function resetJourneyMemory(): void {
  lastShown = null;
}

const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Every step in the story with an icon that tells it: the step on screen on
 * top in full colour, the steps still to come under it, muted, and the done
 * steps at the bottom, muted with a tick. Dotted hairlines between rows.
 */
export function JourneyList({
  steps,
  arts = [],
  current,
}: {
  steps: string[];
  /** Each step's picture slug, in story order. */
  arts?: readonly string[];
  current: number;
}) {
  const reduceMotion = useReducedMotion();
  const story = steps.join('|');
  const [shown, setShown] = useState(() =>
    !reduceMotion && lastShown?.story === story && lastShown.index === current - 1 ? current - 1 : current,
  );

  useEffect(() => {
    lastShown = { story, index: current };
    if (shown === current) return;
    const id = setTimeout(() => setShown(current), JOURNEY_SETTLE_MS);
    return () => clearTimeout(id);
  }, [story, current, shown]);

  const order = journeyOrder(steps.length, shown);
  const hidden: Record<Exclude<RowState, 'now'>, string> = { done: COPY.journeyDone, next: COPY.journeyToCome };

  return (
    <LayoutGroup>
      <ol className="m-0 list-none p-0" data-testid="walkthrough-journey">
        {order.map((i, position) => {
          const title = steps[i]!;
          // What the row looks like follows the order on screen; what it says follows the step on screen.
          const look = stateOf(i, shown);
          const state = stateOf(i, current);
          const now = look === 'now';
          const after = position > 0 && order[position - 1] !== shown;
          return (
            <motion.li
              key={`${i}-${title}`}
              layout={reduceMotion ? false : 'position'}
              transition={{ layout: { duration: 0.5, ease: EASE } }}
              data-journey-state={look}
              aria-current={state === 'now' ? 'step' : undefined}
              className={cx(
                'flex items-center gap-3',
                now
                  ? 'mb-1.5 rounded-[18px] border border-[var(--wt-now-line)] bg-[var(--wt-now-surface)] p-3'
                  : 'px-1 py-2.5',
                after && 'border-t border-dotted border-[var(--wt-dots)]',
              )}
            >
              <span
                className={cx(
                  'relative grid shrink-0 place-items-center',
                  now
                    ? 'h-[52px] w-[52px] rounded-[16px] bg-[var(--wt-surface)]'
                    : 'h-9 w-9 rounded-[12px] bg-[var(--wt-icon-box)]',
                )}
                aria-hidden
              >
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-[inherit]">
                  <JourneyIcon art={arts[i]} size={now ? JOURNEY_NOW_ICON_PX : JOURNEY_ICON_PX} muted={!now} />
                </span>
                {look === 'done' && (
                  <span
                    data-journey-check=""
                    className="absolute -bottom-1 -end-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--wt-done-fill)] text-[var(--wt-done-tick)] ring-2 ring-[var(--wt-surface)]"
                  >
                    <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                {now && <span className={cx(EYEBROW, 'mb-0.5 block')}>{COPY.journeyNow}</span>}
                {state !== 'now' && <span className="sr-only">{`${hidden[state]}: `}</span>}
                <span
                  className={cx(
                    'block leading-[1.35]',
                    now
                      ? 'text-[13.5px] font-semibold text-[var(--wt-ink-strong)]'
                      : look === 'done'
                        ? 'text-[12.5px] text-[var(--wt-muted)]'
                        : 'text-[12.5px] text-[var(--wt-faint)]',
                  )}
                >
                  {title}
                </span>
              </span>
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}
