import { useEffect, useEffectEvent, useState } from 'react';

import { findFocusTargets } from './focus-guide';
import type { FocusSpec } from './story-types';

/**
 * Where the reader sits for a step. The whole screen is the canvas: the
 * reader takes its usual side, moves to the other side when that would
 * cover what the step is about, and drops to a shorter panel along the
 * bottom when both sides would. What the step is about is every control its
 * focus names, measured while the step is up.
 */
export type ReaderPlacement = 'end' | 'start' | 'bottom';

const ORDER: readonly ReaderPlacement[] = ['end', 'start', 'bottom'];
/** The reader's 16px inset from the screen edge (`end-4`, `start-4`). */
const EDGE = 16;
/** The bottom panel: as wide as reads well, a little under half the screen tall. */
export const BOTTOM_MAX_W = 760;
export const BOTTOM_MAX_H = 360;
const BOTTOM_SHARE = 0.42;
/** A page settles after the reader opens (a card fades in); look again this often. */
const REMEASURE_MS = 1000;

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The screen and the reader's fixed geometry, in CSS pixels. */
export interface PlacementFrame {
  width: number;
  height: number;
  readerWidth: number;
  /** Where a side reader starts, below the header. */
  top: number;
  /** The gap a reader leaves above the bottom of the screen for the bar. */
  bottomGap: number;
  rtl: boolean;
}

/** The box a placement covers. `end` is the right in a left-to-right page and the left in a right-to-left one. */
export function placementBox(placement: ReaderPlacement, frame: PlacementFrame): Box {
  const bottom = frame.height - frame.bottomGap;
  if (placement === 'bottom') {
    const width = Math.min(BOTTOM_MAX_W, frame.width - EDGE * 2);
    const height = Math.min(BOTTOM_MAX_H, frame.height * BOTTOM_SHARE);
    const left = (frame.width - width) / 2;
    return { left, right: left + width, top: bottom - height, bottom };
  }
  const width = Math.min(frame.readerWidth, frame.width - EDGE * 2);
  const onRight = (placement === 'end') !== frame.rtl;
  const left = onRight ? frame.width - EDGE - width : EDGE;
  return { left, right: left + width, top: frame.top, bottom };
}

function overlap(a: Box, b: Box): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? x * y : 0;
}

/** The first placement that covers none of `subjects`, else the one that covers least. */
export function choosePlacement(subjects: readonly Box[], frame: PlacementFrame): ReaderPlacement {
  let best: ReaderPlacement = 'end';
  let least = Number.POSITIVE_INFINITY;
  for (const placement of ORDER) {
    const box = placementBox(placement, frame);
    const covered = subjects.reduce((sum, subject) => sum + overlap(box, subject), 0);
    if (covered === 0) return placement;
    if (covered < least) {
      best = placement;
      least = covered;
    }
  }
  return best;
}

/**
 * The placement for one step's reader, chosen as it opens and again each
 * second and on resize, so a card that opens late still moves it. Mount it
 * keyed by step so each step starts from its own measure.
 */
export function useReaderPlacement(
  focus: readonly FocusSpec[] | undefined,
  resolveName: (name: string) => string,
  geometry: Omit<PlacementFrame, 'width' | 'height'>,
): ReaderPlacement {
  const measure = (): ReaderPlacement => {
    if (typeof window === 'undefined' || !focus?.length) return 'end';
    const subjects = findFocusTargets(focus, resolveName)
      .flat()
      .map(({ element }) => element.getBoundingClientRect());
    return choosePlacement(subjects, { ...geometry, width: window.innerWidth, height: window.innerHeight });
  };
  const [placement, setPlacement] = useState<ReaderPlacement>(measure);
  const remeasure = useEffectEvent(() => setPlacement(measure()));

  useEffect(() => {
    const timer = setInterval(() => remeasure(), REMEASURE_MS);
    const onResize = () => remeasure();
    window.addEventListener('resize', onResize);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return placement;
}
