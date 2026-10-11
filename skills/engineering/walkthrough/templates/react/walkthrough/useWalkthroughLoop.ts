'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import type { RunView, WalkthroughDriver, WalkthroughStep } from './story-types';
import { useWalkthroughStore, withSwitch } from './walkthrough-store';

export type LoopBusy = null | 'starting' | 'stepping' | 'pausing' | 'restarting' | 'following';
/** `loop`: the story stopped on its own and offers Retry. `action`: a button failed. */
export type LoopError = null | 'loop' | 'action';

/** How long a route change may take before the loader gives up waiting on it. */
const LAND_TIMEOUT_MS = 6_000;

interface Options {
  /** The latest run, from whatever holds it (local state or a reactive query). */
  run: RunView | null | undefined;
  driver: WalkthroughDriver;
  /**
   * Put a step on screen. Defaults to a route change under the loader. The
   * director tier passes its persona switch here.
   */
  show?: (step: WalkthroughStep) => Promise<void>;
}

/**
 * Plays a story while the run says `playing`: advance, show the step, then
 * hold (or wait on the reader), and go again. Back, Next and Start over stop
 * the loop first, so one owner moves the run at a time.
 */
export function useWalkthroughLoop({ run, driver, show }: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const follow = useWalkthroughStore((s) => s.follow);

  const [busy, setBusy] = useState<LoopBusy>(null);
  const [error, setError] = useState<LoopError>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const runRef = useRef<RunView | null>(null);
  const loopRef = useRef<Promise<void> | null>(null);
  // Set while a button owns the run, so the loop does not start under it.
  const holdLoop = useRef(false);
  // Set by Back and Start over: the running loop exits at its next check.
  const stopLoop = useRef(false);
  const cancelWait = useRef<(() => void) | null>(null);
  // Set on EVERY mount. StrictMode mounts, unmounts and remounts; a flag only
  // ever cleared leaves the loop dead before its first step.
  const aliveRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cancelWait.current?.();
    };
  }, []);

  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (run !== undefined) runRef.current = run;
  }, [run]);

  /** Resolves true after `ms`, or false at once when cancelled or unmounted. */
  const wait = (ms: number) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        cancelWait.current = null;
        resolve(true);
      }, ms);
      cancelWait.current = () => {
        clearTimeout(timer);
        cancelWait.current = null;
        resolve(false);
      };
    });

  /** Resolves once the address bar shows `path`, or after the timeout. */
  const landOn = (path: string) =>
    new Promise<void>((resolve) => {
      const started = Date.now();
      const check = () => {
        if (pathRef.current === path || Date.now() - started > LAND_TIMEOUT_MS) resolve();
        else setTimeout(check, 50);
      };
      check();
    });

  const showStep = async (step: WalkthroughStep) => {
    if (!follow) return;
    if (show) {
      await show(step);
      return;
    }
    const path = step.route.split('?')[0]!;
    if (pathRef.current === path) return;
    await withSwitch(async () => {
      router.push(step.route);
      await landOn(path);
    });
  };
  // The loop reads the follow flag and path of the latest render.
  const showFromLoop = useEffectEvent((step: WalkthroughStep) => showStep(step));

  /** Opens the reader on the step just shown, when Explain is on. */
  const openExplanation = (view: RunView, step: WalkthroughStep): boolean => {
    const { explain, setExplanation } = useWalkthroughStore.getState();
    if (!explain) return false;
    setExplanation({ step, storyLabel: view.storyLabel, total: view.total, steps: view.steps });
    return true;
  };

  /** Resolves true when the reader closes, or false at once when cancelled. */
  const untilExplained = () =>
    new Promise<boolean>((resolve) => {
      if (useWalkthroughStore.getState().explanation === null) {
        resolve(true);
        return;
      }
      const unsubscribe = useWalkthroughStore.subscribe((state) => {
        if (state.explanation !== null) return;
        unsubscribe();
        cancelWait.current = null;
        resolve(true);
      });
      cancelWait.current = () => {
        unsubscribe();
        cancelWait.current = null;
        resolve(false);
      };
    });

  /** The pause after a step: the reader when Explain is on, the step's hold when not. */
  const holdAfter = (view: RunView, step: WalkthroughStep) =>
    openExplanation(view, step) ? untilExplained() : wait(step.holdMs);

  const stillDriving = () => aliveRef.current && !stopLoop.current;

  const loopBody = async () => {
    try {
      while (stillDriving()) {
        const view = runRef.current;
        if (!view || view.status !== 'playing') break;
        const next = await driver.advance(view.index, { step: false });
        runRef.current = next;
        if (!stillDriving()) break;
        // Another tab moved the story (director tier); never show a step this tab did not apply.
        if (next.drivenElsewhere || next.index !== view.index + 1) break;
        if (next.lastStep) {
          setBusy('following');
          try {
            await showFromLoop(next.lastStep);
          } finally {
            if (aliveRef.current) setBusy((b) => (b === 'following' ? null : b));
          }
        }
        if (!stillDriving() || next.status !== 'playing' || !next.lastStep) break;
        if (!(await holdAfter(next, next.lastStep))) break;
      }
    } catch {
      if (!aliveRef.current || stopLoop.current) return;
      setError('loop');
      try {
        runRef.current = await driver.pause();
      } catch {
        // Best effort: Retry restarts the loop either way.
      }
    }
  };

  const runLoop = useEffectEvent(() => {
    if (loopRef.current || holdLoop.current) return;
    loopRef.current = loopBody().finally(() => {
      loopRef.current = null;
    });
  });

  const status = run?.status ?? null;
  useEffect(() => {
    if (status === 'playing') runLoop();
  }, [status, retryNonce]);

  /** Stops the loop where it is and pauses the run, so a button can own it. */
  const haltLoop = async () => {
    holdLoop.current = true;
    stopLoop.current = true;
    // Cancel the wait BEFORE closing the reader: closing it first lets the loop step on.
    cancelWait.current?.();
    useWalkthroughStore.getState().setExplanation(null);
    if (runRef.current?.status === 'playing') runRef.current = await driver.pause();
    // A step may be mid switch; let it land first.
    await loopRef.current;
  };

  const release = () => {
    stopLoop.current = false;
    holdLoop.current = false;
    if (aliveRef.current) setBusy(null);
  };

  const onPlay = async () => {
    setError(null);
    setBusy('starting');
    try {
      runRef.current = await driver.start();
    } catch {
      setError('action');
    } finally {
      setBusy(null);
    }
  };

  const onRetry = async () => {
    setError(null);
    if (runRef.current?.status === 'playing') {
      setRetryNonce((n) => n + 1);
      return;
    }
    await onPlay();
  };

  const onPause = async () => {
    setBusy('pausing');
    try {
      runRef.current = await driver.pause();
    } catch {
      setError('action');
    } finally {
      setBusy(null);
    }
  };

  /** One step forward on a paused run, with its reader. */
  const onStep = async () => {
    setError(null);
    setBusy('stepping');
    holdLoop.current = true;
    try {
      let view = runRef.current ?? run ?? null;
      if (!view || view.status === 'idle') {
        // Nothing under way: start, then hold it so a single step plays.
        await driver.start();
        view = await driver.pause();
      }
      const next = await driver.advance(view.index, { step: true });
      runRef.current = next;
      if (next.index === view.index + 1 && next.lastStep && aliveRef.current) {
        await showStep(next.lastStep);
        openExplanation(next, next.lastStep);
      }
    } catch {
      setError('action');
    } finally {
      holdLoop.current = false;
      if (aliveRef.current) setBusy(null);
    }
  };

  /** One step back. The run stays paused; Play carries on from there. */
  const onBack = async () => {
    const view = runRef.current ?? run ?? null;
    if (!view || view.index < 2 || busy !== null) return;
    setError(null);
    setBusy('stepping');
    try {
      await haltLoop();
      const current = runRef.current ?? view;
      const back = await driver.back(current.index);
      runRef.current = back;
      if (back.lastStep && aliveRef.current) {
        await showStep(back.lastStep);
        openExplanation(back, back.lastStep);
      }
    } catch {
      setError('action');
    } finally {
      release();
    }
  };

  /** Forward: while playing, close the reader so the story carries on; else one step. */
  const onForward = async () => {
    if (busy !== null) return;
    const view = runRef.current ?? run ?? null;
    if (view?.status === 'done') return;
    if (view?.status === 'playing') {
      useWalkthroughStore.getState().setExplanation(null);
      return;
    }
    await onStep();
  };

  const onRestart = async () => {
    setError(null);
    setBusy('restarting');
    try {
      await haltLoop();
      runRef.current = await driver.restart();
    } catch {
      setError('action');
    } finally {
      release();
    }
  };

  return { busy, error, onPlay, onPause, onStep, onBack, onForward, onRestart, onRetry };
}
