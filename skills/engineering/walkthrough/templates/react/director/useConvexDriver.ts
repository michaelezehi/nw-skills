'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';

import type { RunView, WalkthroughDriver } from '../walkthrough/story-types';
// HOST: import the generated api and point these at the run module.
import { api } from '@/convex/_generated/api';

const DRIVER_KEY = 'wt-driver';

/** A stable id per browser tab, so the server leases a playing run to one tab. */
export function getDriverId(): string {
  try {
    const existing = window.sessionStorage.getItem(DRIVER_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(DRIVER_KEY, id);
    return id;
  } catch {
    return 'tab';
  }
}

/**
 * Director tier: the run lives on the server. `run` is reactive, so a second
 * tab shows progress without driving. Pass `driver` and `run` to
 * `useWalkthroughLoop`, and a persona switch as its `show` option.
 */
export function useConvexDriver(story: string): { run: RunView | null | undefined; driver: WalkthroughDriver } {
  const run = useQuery(api.walkthrough_run.getRun, { story }) as (RunView & { runId?: string }) | null | undefined;
  const start = useMutation(api.walkthrough_run.startRun);
  const advance = useMutation(api.walkthrough_run.advanceBeat);
  const back = useMutation(api.walkthrough_run.stepBack);
  const pause = useMutation(api.walkthrough_run.pauseRun);
  const restart = useMutation(api.walkthrough_run.restartRun);
  const runId = useRef<string | null>(null);
  const latestRunId = run?.runId;
  useEffect(() => {
    if (latestRunId) runId.current = latestRunId;
  }, [latestRunId]);

  const driver = useMemo<WalkthroughDriver>(
    () => ({
      start: async () => (await start({ story })) as RunView,
      advance: async (expectedIndex, { step }) =>
        (await advance({ runId: runId.current!, expectedIndex, step, driverId: getDriverId() })) as RunView,
      back: async (expectedIndex) => (await back({ runId: runId.current!, expectedIndex })) as RunView,
      pause: async () => (await pause({ runId: runId.current! })) as RunView,
      restart: async () => (await restart({ story })) as RunView,
    }),
    [story, start, advance, back, pause, restart],
  );
  return { run, driver };
}
