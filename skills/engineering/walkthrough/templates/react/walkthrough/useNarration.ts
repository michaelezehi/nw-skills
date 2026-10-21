'use client';

import { useEffect, useEffectEvent } from 'react';

import type { RunView } from './story-types';
import { useWalkthroughStore, type WalkthroughNarration } from './walkthrough-store';
import * as player from './narration-player';

/**
 * Where the clips are served from: `<public>/audio/walkthrough/...`. The one
 * value an installer may change; the generator's `--out` must match it.
 */
export const NARRATION_BASE = '/audio/walkthrough';

/**
 * How long narration outlives an unmounted `Tour`. A persona switch into
 * another layout remounts it mid clip; ending the tour unmounts it for good.
 */
export const UNMOUNT_GRACE_MS = 3000;

export type NarrationPart = 'lead' | 'detail';

export function narrationUrl(story: string, stepId: string, part: NarrationPart): string {
  return `${NARRATION_BASE}/${story}/${stepId}/${part}.mp3`;
}

let current: { token: number; part: NarrationPart } | null = null;
let listening = false;
let unmountTimer: ReturnType<typeof setTimeout> | null = null;

function narration(): WalkthroughNarration {
  return useWalkthroughStore.getState().narration;
}

function setNarration(patch: Partial<WalkthroughNarration>): void {
  useWalkthroughStore.getState().setNarration(patch);
}

function startClip(story: string, stepId: string, part: NarrationPart): Partial<WalkthroughNarration> {
  const token = player.play(narrationUrl(story, stepId, part));
  current = { token, part };
  return { [part]: 'playing' };
}

/** The detail clip, once the reader is open on this step and the lead is over. */
function detailPatch(lead = narration().lead): Partial<WalkthroughNarration> {
  const state = useWalkthroughStore.getState();
  const n = state.narration;
  if (!state.sound || !n.stepId || !n.story) return {};
  const step = state.explanation?.step;
  if (step?.id !== n.stepId || !step.narration) return {};
  if (n.detail !== 'idle' || lead === 'playing') return {};
  return startClip(n.story, n.stepId, 'detail');
}

function onPlayerEvent(token: number, outcome: player.NarrationOutcome): void {
  if (!current || current.token !== token) return;
  const { part } = current;
  current = null;
  const result = outcome === 'ended' ? 'done' : 'failed';
  // Lead and detail flip in one write, so the reader never sees a gap between them.
  if (part === 'lead') setNarration({ lead: result, ...detailPatch(result) });
  else setNarration({ detail: result });
}

/** Cuts the clip at once. Back, Next, Start over, a story switch and mute all call it. */
export function stopNarration(): void {
  player.stop();
  current = null;
  const n = narration();
  const patch: Partial<WalkthroughNarration> = {};
  if (n.lead === 'playing') patch.lead = 'cut';
  if (n.detail === 'playing') patch.detail = 'cut';
  if (Object.keys(patch).length > 0) setNarration(patch);
}

/** Lets later clips autoplay. Call inside a click or key press. */
export function unlockNarration(): void {
  player.unlock();
}

function stepKey(run: RunView): string | null {
  if (!run.lastStep) return null;
  return `${run.story}:${run.index}:${run.lastStep.id}`;
}

/**
 * Drives the narrator from the run and the store. Mount once, in `Tour`; the
 * reader and the loop read `narration` from the store.
 *
 * - the step on screen changes: stop, then its lead clip
 * - the reader opens on that step: the detail clip, after the lead
 * - the run, the reader or "Show me how" pauses: pause; resumed: resume
 * - a step request, a story switch, sound off, another tab driving, or the
 *   tour ending: stop
 * The first run seen on a page load is only recorded: that step was already
 * on screen, so nothing speaks until the story moves. A step with no
 * `narration` plays nothing and keeps its plain timing.
 *
 * `enabled` false keeps this tab quiet; the director tier passes false while
 * another tab drives the run. The local driver never does.
 */
export function useNarration(run: RunView | null | undefined, enabled: boolean): WalkthroughNarration {
  // A null run (not loaded yet, or none on the server) is not a first sight.
  const status = run ? run.status : undefined;
  const key = run ? stepKey(run) : undefined;
  const stepId = run?.lastStep?.id ?? null;
  const story = run?.story ?? null;
  const explainingId = useWalkthroughStore((s) => s.explanation?.step.id ?? null);
  const readerPaused = useWalkthroughStore((s) => s.readerPaused);
  const showMeHow = useWalkthroughStore((s) => s.showMeHow);
  const state = useWalkthroughStore((s) => s.narration);

  // Mount: keep listening for clip ends; unmount: stop unless Tour comes straight back.
  useEffect(() => {
    if (unmountTimer) {
      clearTimeout(unmountTimer);
      unmountTimer = null;
    }
    if (!listening) {
      listening = true;
      player.subscribe(onPlayerEvent);
    }
    // Edges made outside the bar: the reader's Back, the keys, a story switch, mute.
    const unsubscribe = useWalkthroughStore.subscribe((s, prev) => {
      if (s.stepRequest !== prev.stepRequest && s.stepRequest) stopNarration();
      else if (s.story !== prev.story) stopNarration();
      else if (prev.sound && !s.sound) stopNarration();
    });
    return () => {
      unsubscribe();
      unmountTimer = setTimeout(() => {
        unmountTimer = null;
        stopNarration();
      }, UNMOUNT_GRACE_MS);
    };
  }, []);

  // Another tab drives: that tab narrates, this one stays quiet.
  useEffect(() => {
    if (!enabled) stopNarration();
  }, [enabled]);

  // Declared before the step effect, so a new step's clear wins over a pause edge.
  const onStatus = useEffectEvent((next: string) => {
    const n = narration();
    if (n.status === next) return;
    if (n.status === 'playing' && next === 'paused') setNarration({ status: next, runHold: true });
    else if (next === 'playing') setNarration({ status: next, runHold: false });
    else setNarration({ status: next });
  });
  useEffect(() => {
    if (status !== undefined) onStatus(status);
  }, [status]);

  const onStep = useEffectEvent((nextKey: string | null, nextStory: string, nextStep: string | null) => {
    const n = narration();
    const record = { seen: true, key: nextKey, story: nextStory, stepId: nextStep };
    if (!n.seen) {
      // First sight on this page load: the step was already on screen.
      setNarration(record);
      return;
    }
    if (n.story !== nextStory) {
      stopNarration();
      setNarration({ ...record, lead: 'idle', detail: 'idle', runHold: false });
      return;
    }
    if (n.key === nextKey) return;
    stopNarration();
    const fresh: Partial<WalkthroughNarration> = { ...record, lead: 'idle', detail: 'idle', runHold: false };
    const { sound } = useWalkthroughStore.getState();
    const spoken = run?.lastStep?.narration !== undefined;
    if (nextKey && nextStep && spoken && sound && enabled) {
      setNarration({ ...fresh, ...startClip(nextStory, nextStep, 'lead') });
    } else {
      setNarration(fresh);
    }
  });
  useEffect(() => {
    if (key !== undefined && story !== null) onStep(key, story, stepId);
  }, [key, story, stepId]);

  const onReader = useEffectEvent(() => {
    const patch = detailPatch();
    if (Object.keys(patch).length > 0) setNarration(patch);
  });
  useEffect(() => {
    if (explainingId) onReader();
  }, [explainingId, state.stepId]);

  const hold = state.runHold || readerPaused || showMeHow;
  useEffect(() => {
    if (hold) player.pause();
    else player.resume();
  }, [hold]);

  return state;
}

/** Tests only: forget the module state between cases. */
export function __resetNarrationForTests(): void {
  current = null;
  listening = false;
  if (unmountTimer) clearTimeout(unmountTimer);
  unmountTimer = null;
}
