'use client';

import { useEffect, useEffectEvent, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { useWalkthroughStore } from './walkthrough-store';
import { WALKTHROUGH_UI_ATTR } from './nav-guide';
import { asShown, waitForFocusTargets, type FocusTarget } from './focus-guide';
import type { FocusSpec } from './story-types';

/** How long the controls stay lit before a tab is clicked and the light fades. */
export const FOCUS_HOLD_MS = 1600;
/** The fade out, and the beat after a click for the tab to change under it. */
export const FOCUS_FADE_MS = 350;
const PAD = 8;
const RADIUS = 16;

type Rect = { left: number; top: number; width: number; height: number };

function measure(targets: FocusTarget[]): Rect[] {
  return targets.map(({ element }) => {
    const r = element.getBoundingClientRect();
    return { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
  });
}

/**
 * Only what the step clicks, or its first control when it clicks nothing:
 * one light at a time keeps the eye on where the story goes next.
 */
export function primaryFocus(specs: readonly FocusSpec[]): FocusSpec[] {
  const clicks = specs.filter((spec) => spec.click);
  return clicks.length > 0 ? clicks : specs.slice(0, 1);
}

/** A click ends a stage: what comes after it only exists once the click has changed the screen. */
export function focusStages(specs: readonly FocusSpec[]): FocusSpec[][] {
  const stages: FocusSpec[][] = [[]];
  for (const spec of specs) {
    stages[stages.length - 1]!.push(spec);
    if (spec.click) stages.push([]);
  }
  return stages.filter((stage) => stage.length > 0);
}

/** The control itself grows and settles, so the eye catches it before the ring does. */
function pop(element: HTMLElement): void {
  if (typeof element.animate !== 'function') return;
  element.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
    { duration: 520, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', composite: 'add' },
  );
}

/**
 * The focus pass: when a step lands, the page dims around the controls the
 * step talks about, each one pops and gets a ring, and a tab the step is
 * about is clicked for the viewer. Then the light fades and the next stage,
 * if any, lights what the click opened. Then the story goes on. Driven by
 * `focusing` in the store, which the loop sets and waits on; clearing it
 * (Back, Next, a pause) ends the pass at once.
 *
 * z 65 on the walkthrough's ladder: over the page, under the bar (70), the
 * reader (110) and the "Show me how" ring (120).
 */
export function FocusLayer({ resolveName = asShown }: { resolveName?: (name: string) => string }) {
  const reduceMotion = useReducedMotion();
  const maskId = useId();
  const focusing = useWalkthroughStore((st) => st.focusing);
  const [targets, setTargets] = useState<FocusTarget[]>([]);
  const [rects, setRects] = useState<Rect[]>([]);
  const [lit, setLit] = useState(false);

  const resolve = useEffectEvent((name: string) => resolveName(name));
  const popAll = useEffectEvent((found: FocusTarget[]) => {
    if (!reduceMotion) found.forEach(({ element }) => pop(element));
  });
  const bringIntoView = useEffectEvent((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
    element.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  useEffect(() => {
    if (!focusing?.focus?.length) return;
    const step = focusing;
    const specs = focusing.focus;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) => new Promise<void>((done) => timers.push(setTimeout(done, ms)));

    const play = async () => {
      for (const stage of focusStages(primaryFocus(specs))) {
        const found = await waitForFocusTargets(stage, resolve, () => cancelled);
        if (cancelled) return;
        if (found.length === 0) continue;
        bringIntoView(found[0]!.element);
        setTargets(found);
        setRects(measure(found));
        setLit(true);
        popAll(found);
        await sleep(FOCUS_HOLD_MS);
        if (cancelled) return;
        found.filter((target) => target.click).forEach(({ element }) => element.click());
        setLit(false);
        await sleep(FOCUS_FADE_MS);
        if (cancelled) return;
        setTargets([]);
      }
      if (useWalkthroughStore.getState().focusing === step) useWalkthroughStore.getState().setFocusing(null);
    };
    void play();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      setLit(false);
      setTargets([]);
    };
  }, [focusing]);

  // A smooth scroll or a layout shift moves the controls; the light follows them.
  useEffect(() => {
    if (targets.length === 0) return;
    let frame = 0;
    const follow = () => {
      setRects(measure(targets));
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [targets]);

  return (
    <AnimatePresence>
      {lit && rects.length > 0 && (
        <motion.div
          key="focus"
          {...{ [WALKTHROUGH_UI_ATTR]: '' }}
          data-testid="walkthrough-focus"
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[65]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FOCUS_FADE_MS / 1000 }}
        >
          <svg className="absolute inset-0 h-full w-full">
            <defs>
              <mask id={maskId}>
                <rect width="100%" height="100%" fill="white" />
                {rects.map((r, i) => (
                  <rect key={i} x={r.left} y={r.top} width={r.width} height={r.height} rx={RADIUS} fill="black" />
                ))}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="var(--wt-focus-dim)" mask={`url(#${maskId})`} />
          </svg>
          {rects.map((r, i) => (
            <motion.div
              key={i}
              className="absolute rounded-[16px] border-2 border-[var(--wt-spot-ring)]"
              style={{
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                boxShadow: '0 0 0 6px var(--wt-accent-glow)',
              }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: [0.85, 1.06, 1] }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
