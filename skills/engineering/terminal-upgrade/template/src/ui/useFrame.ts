/**
 * One shared animation clock. The 400ms ticker only runs while at least one subscriber
 * says a spinner is live; otherwise Devdeck sits idle and costs nothing.
 * A second clock ticks once a second for the uptime display.
 */
import { useEffect, useState } from 'react';

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

/** Test seam: true when the 400ms ticker is running. */
export function isFrameClockRunning(): boolean {
  return frameClock.timer !== undefined;
}
