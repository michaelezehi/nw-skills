'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CaretLeftIcon,
  CheckIcon,
  PauseIcon,
  PlayIcon,
  SignpostIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  XIcon,
} from '@phosphor-icons/react';

import { WalkthroughArt } from './walkthrough-art';
import { WALKTHROUGH_COPY as COPY, stepProgressCopy } from './walkthrough-copy';
import {
  useWalkthroughStore,
  type WalkthroughExplanation,
  type WalkthroughNarration,
} from './walkthrough-store';
import { getProgress } from './narration-player';
import { unlockNarration } from './useNarration';
import { WALKTHROUGH_UI_ATTR, findNavTarget, type NavTarget } from './nav-guide';
import { NavSpotlight } from './NavSpotlight';
import { EYEBROW, PILL, READING, ROUND_BUTTON, cx } from './walkthrough-ui';

/** How long the reader holds a step before the story carries on by itself. */
export const EXPLAIN_SECONDS = 30;
/** With sound on, how long the reader stays up after the detail clip ends. */
export const DETAIL_GRACE_MS = 1500;
/** The longest the reader waits on a clip that never ends or fails, such as a stalled download. */
export const CLIP_CEILING_MS = 60_000;

const TICK_MS = 250;
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The reader waits for the spoken detail: sound on, this step's narration
 * under way, and no clip failed or cut. Otherwise the 30s countdown decides.
 */
export function waitsForClip(sound: boolean, n: WalkthroughNarration, stepId: string): boolean {
  if (!sound || n.stepId !== stepId) return false;
  if (n.detail === 'playing' || n.detail === 'done') return true;
  return n.detail === 'idle' && n.lead === 'playing';
}

/** `share` of the ring still left, and the seconds to print, or null for none. */
function CountdownRing({ share, seconds }: { share: number; seconds: number | null }) {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--wt-line)" strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--wt-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - share)}
          style={{ transition: `stroke-dashoffset ${TICK_MS}ms linear` }}
        />
      </svg>
      {seconds !== null && (
        <span className="text-[12px] font-semibold tabular-nums text-[var(--wt-ink-strong)]">{seconds}</span>
      )}
    </span>
  );
}

/** Every step in the story: done, the one on screen, and what comes next. */
function JourneyList({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="m-0 list-none space-y-2.5 p-0">
      {steps.map((title, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={`${i}-${title}`} className="flex items-start gap-3">
            <span
              className={cx(
                'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                done && 'border-[var(--wt-dark)] bg-[var(--wt-dark)] text-white',
                now && 'border-[var(--wt-dark)] bg-[var(--wt-accent)]',
                !done && !now && 'border-[var(--wt-dark)]/25 bg-white',
              )}
              aria-hidden
            >
              {done && <CheckIcon className="h-2.5 w-2.5" weight="bold" />}
            </span>
            <span
              className={cx(
                'text-[12.5px] leading-[1.4]',
                now
                  ? 'font-semibold text-[var(--wt-ink-strong)]'
                  : done
                    ? 'text-[var(--wt-muted)]'
                    : 'text-[var(--wt-faint)]',
              )}
              aria-current={now ? 'step' : undefined}
            >
              {title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ReaderBody({
  explanation,
  switching,
}: {
  explanation: WalkthroughExplanation;
  switching: boolean;
}) {
  const setExplanation = useWalkthroughStore((st) => st.setExplanation);
  const requestStep = useWalkthroughStore((st) => st.requestStep);
  const paused = useWalkthroughStore((st) => st.readerPaused);
  const setPaused = useWalkthroughStore((st) => st.setReaderPaused);
  const setShowMeHow = useWalkthroughStore((st) => st.setShowMeHow);
  const sound = useWalkthroughStore((st) => st.sound);
  const setSound = useWalkthroughStore((st) => st.setSound);
  const narration = useWalkthroughStore((st) => st.narration);
  const [remainingMs, setRemainingMs] = useState(EXPLAIN_SECONDS * 1000);
  const [graceMs, setGraceMs] = useState(DETAIL_GRACE_MS);
  const [clipShare, setClipShare] = useState<{ share: number; seconds: number } | null>(null);
  const [target, setTarget] = useState<NavTarget | null>(null);
  const [canGuide, setCanGuide] = useState(false);
  const { step, storyLabel, total, steps } = explanation;
  const close = () => setExplanation(null);
  // The spotlight holds the clip while it rings the menu item.
  const guide = (next: NavTarget | null) => {
    setTarget(next);
    setShowMeHow(next !== null);
  };
  // The reader can unmount with the spotlight up; never leave the clip held.
  useEffect(() => () => setShowMeHow(false), [setShowMeHow]);

  const clip = waitsForClip(sound, narration, step.id);
  const clipDone = clip && narration.detail === 'done';

  // The countdown holds while a switch lands, while paused, and while the menu is shown.
  // With a clip under way it also holds while the story is paused, as the clip does.
  const ticking = !paused && !switching && target === null && !(clip && narration.runHold);
  const onTick = useEffectEvent(() => {
    // The 30s keeps running under a clip, so a clip that fails falls back to the plain timing.
    setRemainingMs((ms) => ms - TICK_MS);
    if (clipDone) setGraceMs((ms) => ms - TICK_MS);
    const progress = clip && narration.detail === 'playing' ? getProgress() : null;
    setClipShare(
      progress
        ? {
            share: 1 - progress.currentTime / progress.duration,
            seconds: Math.ceil(Math.max(0, progress.duration - progress.currentTime)),
          }
        : null,
    );
  });
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => onTick(), TICK_MS);
    return () => clearInterval(timer);
  }, [ticking]);

  // Out of time, or the clip ended a moment ago: the story carries on.
  const timeUp = clip
    ? graceMs <= 0 || remainingMs <= EXPLAIN_SECONDS * 1000 - CLIP_CEILING_MS
    : remainingMs <= 0;
  useEffect(() => {
    if (timeUp) setExplanation(null);
  }, [timeUp, setExplanation]);

  let ring: { share: number; seconds: number | null } = {
    share: Math.max(0, remainingMs) / (EXPLAIN_SECONDS * 1000),
    seconds: Math.ceil(Math.max(0, remainingMs) / 1000),
  };
  if (clip) {
    // Full while the lead finishes, then the clip's own progress, then empty.
    ring = clipDone ? { share: 0, seconds: null } : (clipShare ?? { share: 1, seconds: null });
  }
  const soundLabel = sound ? COPY.soundTurnOff : COPY.soundTurnOn;

  // The menu link exists only once the new screen is up.
  useEffect(() => {
    if (switching) return;
    setCanGuide(findNavTarget(step.route) !== null);
  }, [switching, step.route]);

  const showMeHow = () => {
    const found = findNavTarget(step.route);
    if (found) guide(found);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <p className={EYEBROW}>{storyLabel}</p>
        {/* A fixed name with aria-pressed: a label that flips with the state reads as two buttons. */}
        <button
          type="button"
          onClick={() => {
            if (!sound) unlockNarration();
            setSound(!sound);
          }}
          aria-label={COPY.sound}
          aria-pressed={sound}
          title={COPY.soundKey(soundLabel)}
          className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wt-muted)] transition-colors hover:bg-[var(--wt-hover)] hover:text-[var(--wt-ink-strong)]"
        >
          {sound ? (
            <SpeakerHighIcon className="h-4 w-4" weight="bold" aria-hidden />
          ) : (
            <SpeakerSlashIcon className="h-4 w-4" weight="bold" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label={COPY.explainClose}
          className="-mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wt-muted)] transition-colors hover:bg-[var(--wt-hover)] hover:text-[var(--wt-ink-strong)]"
        >
          <XIcon className="h-4 w-4" weight="bold" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {/* Fixed pixel art inside a clipped box: a % size spills out of the panel. */}
        <div className="mt-3 grid h-[150px] place-items-center overflow-hidden rounded-[22px] bg-[var(--wt-art-panel)]">
          <WalkthroughArt slug={step.explain.art} size={128} />
        </div>

        <p className={cx(EYEBROW, 'mt-5')}>{stepProgressCopy(step.index + 1, total)}</p>
        <h2 className="m-0 mt-2 text-[21px] font-medium leading-[1.18] -tracking-[0.03em] text-[var(--wt-ink)]">
          {step.title}
        </h2>

        <dl className="m-0 mt-4 grid gap-3">
          <div>
            <dt className={EYEBROW}>{COPY.explainWhat}</dt>
            <dd className={cx(READING, 'mt-1')}>{step.explain.what}</dd>
          </div>
          <div>
            <dt className={EYEBROW}>{COPY.explainWhy}</dt>
            <dd className={cx(READING, 'mt-1')}>{step.explain.why}</dd>
          </div>
        </dl>

        {canGuide && (
          <button
            type="button"
            onClick={showMeHow}
            disabled={target !== null}
            className="mt-4 inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--wt-dark)]/20 bg-white px-4 text-[12px] font-semibold text-[var(--wt-ink-strong)] transition-colors hover:border-[var(--wt-dark)]/45 hover:bg-[var(--wt-art-panel)] disabled:opacity-60"
          >
            <SignpostIcon className="h-4 w-4" aria-hidden />
            {COPY.showMeHow}
          </button>
        )}

        {steps.length > 1 && (
          <div className="mt-6 border-t border-[var(--wt-line)] pt-4">
            <p className={cx(EYEBROW, 'mb-3')}>{COPY.journey}</p>
            <JourneyList steps={steps} current={step.index} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--wt-line)] px-5 py-4">
        <CountdownRing share={ring.share} seconds={ring.seconds} />
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? COPY.explainResume : COPY.explainPause}
          title={paused ? COPY.explainResume : COPY.explainPause}
          className={ROUND_BUTTON}
        >
          {paused ? (
            <PlayIcon className="h-3.5 w-3.5" weight="fill" aria-hidden />
          ) : (
            <PauseIcon className="h-3.5 w-3.5" weight="fill" aria-hidden />
          )}
        </button>
        {step.index > 0 && (
          <button
            type="button"
            onClick={() => requestStep('back')}
            disabled={switching}
            aria-label={COPY.back}
            title={`${COPY.back}. ${COPY.keysHint}`}
            className={ROUND_BUTTON}
          >
            <CaretLeftIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className={cx(
            'ml-auto inline-flex h-10 shrink-0 items-center whitespace-nowrap px-6 text-xs font-semibold',
            PILL,
          )}
        >
          {COPY.explainContinue}
        </button>
      </div>

      {target && <NavSpotlight target={target} onDone={() => guide(null)} />}
    </>
  );
}

/**
 * The journey reader: after each step a panel on the right shows the
 * picture, what just happened and why it matters, where the step sits in the
 * whole story, and "Show me how to get there", which rings the menu item for
 * this screen and clicks it. A 30 second countdown, pausable, lets the story
 * carry on; with sound on the reader waits for the spoken detail instead,
 * then 1.5 seconds more, and never past 60 seconds. It stays up through a screen switch (the countdown holds until
 * the new screen lands), so the viewer is never left on an empty page.
 */
export function ExplainReader() {
  const explanation = useWalkthroughStore((st) => st.explanation);
  const switching = useWalkthroughStore((st) => st.pending > 0);
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {explanation && (
        <motion.aside
          key={explanation.step.id}
          {...{ [WALKTHROUGH_UI_ATTR]: '' }}
          role="complementary"
          aria-label={COPY.explainLabel}
          data-testid="walkthrough-reader"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-[92px] right-4 top-[var(--wt-header-h)] z-[110] flex w-[min(var(--wt-reader-w),calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-[var(--wt-line)] bg-[var(--wt-surface)] shadow-[var(--wt-shadow-reader)]"
        >
          <ReaderBody explanation={explanation} switching={switching} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
