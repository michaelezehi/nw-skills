/**
 * One shared animation clock. The 400ms ticker only runs while at least one subscriber
 * says a spinner is live; otherwise Devdeck sits idle and costs nothing.
 * A second clock ticks once a second for the uptime display.
 */
import { useEffect, useRef, useState } from 'react';
import { HOT_MS } from './theme.ts';

export const FRAME_MS = 400;

interface Clock {
  listeners: Set<() => void>;
  active: Set<symbol>;
  timer: ReturnType<typeof setInterval> | undefined;
  frame: number;
  ms: number;
}

function makeClock(ms: number): Clock {
  return { listeners: new Set(), active: new Set(), timer: undefined, frame: 0, ms };
}

const frameClock = makeClock(FRAME_MS);
const secondClock = makeClock(1000);

function start(clock: Clock): void {
  if (clock.timer) return;
  clock.timer = setInterval(() => {
    clock.frame += 1;
    for (const fn of clock.listeners) fn();
  }, clock.ms);
  clock.timer.unref?.();
}

function stop(clock: Clock): void {
  if (!clock.timer) return;
  clearInterval(clock.timer);
  clock.timer = undefined;
}

function useClock(clock: Clock, active: boolean): number {
  const [frame, setFrame] = useState(clock.frame);
  useEffect(() => {
    const listener = () => setFrame(clock.frame);
    clock.listeners.add(listener);
    return () => {
      clock.listeners.delete(listener);
    };
  }, [clock]);
  useEffect(() => {
    if (!active) return;
    const token = Symbol('anim');
    clock.active.add(token);
    start(clock);
    return () => {
      clock.active.delete(token);
      if (clock.active.size === 0) stop(clock);
    };
  }, [clock, active]);
  return frame;
}

/** Frame counter at 400ms. Pass `active=false` when no spinner is live. */
export function useFrame(active: boolean): number {
  return useClock(frameClock, active);
}

/** Ticks once a second. Always on while mounted; it drives the uptime clock. */
export function useSecond(): number {
  return useClock(secondClock, true);
}

/**
 * One re-render at `at` (a timestamp), so a glyph that settles after a fixed delay, like
 * the yellow bolt turning amber, settles on time without any clock running.
 */
export function useWakeAt(at: number | undefined): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (at === undefined) return;
    const wait = at - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => setTick((t) => t + 1), wait);
    timer.unref?.();
    return () => clearTimeout(timer);
  }, [at]);
}

/**
 * A stand-in for now that moves only when something cools: the latest `at + HOT_MS` that
 * has passed, else 0. For every `at` given, isHot(at, settledNow(now, ats)) equals
 * isHot(at, now), so a memoised leaf that only colours hot things can take this value
 * and skip the renders where nothing it draws would change.
 */
export function settledNow(now: number, ats: Iterable<number | undefined>): number {
  let settled = 0;
  for (const at of ats) {
    if (at === undefined) continue;
    const cooled = at + HOT_MS;
    if (cooled <= now && cooled > settled) settled = cooled;
  }
  return settled;
}

/** `now` as of the last time `key` changed: a clock that holds still while what it draws is the same. */
export function useHeldNow(now: number, key: string): number {
  const held = useRef({ key, now });
  if (held.current.key !== key) held.current = { key, now };
  return held.current.now;
}

/** Test seam: true when the 400ms ticker is running. */
export function isFrameClockRunning(): boolean {
  return frameClock.timer !== undefined;
}
