'use client';

import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  CircleNotchIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  XIcon,
} from '@phosphor-icons/react';

import type { RunView } from './story-types';
import type { useWalkthroughLoop } from './useWalkthroughLoop';
import { WALKTHROUGH_COPY as COPY, stepProgressCopy } from './walkthrough-copy';
import { useWalkthroughStore } from './walkthrough-store';
import { WALKTHROUGH_UI_ATTR } from './nav-guide';
import { PILL, cx } from './walkthrough-ui';

const iconButton =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wt-ink-strong)] transition-colors hover:bg-[var(--wt-hover)] disabled:opacity-40 disabled:hover:bg-transparent';
const spinner = 'animate-spin motion-reduce:animate-none';

/** "Founder story · Step 3 of 9": the step on screen, or the one about to play. */
export function progressLabel(run: RunView): string {
  const n = run.lastStep ? run.lastStep.index + 1 : Math.min(run.index + 1, run.total);
  return `${run.storyLabel} · ${stepProgressCopy(n, run.total)}`;
}

function Toggle({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={title}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-medium text-[var(--wt-ink-strong)]"
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-[var(--wt-accent)]' : 'bg-[var(--wt-line)]',
        )}
        aria-hidden
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

/**
 * The floating story bar: play or pause, previous and next step, start over,
 * where the story stands, and the Follow and Explain toggles.
 */
export function WalkthroughBar({
  run,
  loop,
  onEnd,
}: {
  run: RunView;
  loop: ReturnType<typeof useWalkthroughLoop>;
  onEnd: () => void;
}) {
  const follow = useWalkthroughStore((st) => st.follow);
  const setFollow = useWalkthroughStore((st) => st.setFollow);
  const explain = useWalkthroughStore((st) => st.explain);
  const setExplain = useWalkthroughStore((st) => st.setExplain);
  const { busy, error, onPlay, onPause, onStep, onBack, onRestart, onRetry } = loop;

  const playing = run.status === 'playing';
  const done = run.status === 'done';
  const locked = busy !== null;
  const statusLine = done && busy === null ? COPY.done : progressLabel(run);

  return (
    <div
      {...{ [WALKTHROUGH_UI_ATTR]: '' }}
      role="group"
      aria-label={COPY.barLabel}
      data-testid="walkthrough-bar"
      className="fixed bottom-5 left-1/2 z-[70] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--wt-line)] bg-white/90 py-1.5 pl-1.5 pr-2 shadow-[var(--wt-shadow-bar)] backdrop-blur-xl"
    >
      {playing ? (
        <button
          type="button"
          onClick={() => void onPause()}
          disabled={locked}
          className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--wt-line)] bg-white px-4 text-xs font-semibold text-[var(--wt-ink-strong)] transition-colors hover:bg-[var(--wt-art-panel)] disabled:opacity-60"
        >
          <PauseIcon className="h-3.5 w-3.5" weight="fill" aria-hidden />
          {COPY.pause}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void onPlay()}
          disabled={locked}
          className={cx(
            'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-4 text-xs font-semibold disabled:opacity-60',
            PILL,
          )}
        >
          {busy === 'starting' ? (
            <CircleNotchIcon className={cx('h-3.5 w-3.5', spinner)} weight="bold" aria-hidden />
          ) : (
            <PlayIcon className="h-3.5 w-3.5" weight="fill" aria-hidden />
          )}
          {run.status === 'paused' ? COPY.resume : COPY.play}
        </button>
      )}

      <button
        type="button"
        onClick={() => void onBack()}
        disabled={locked || run.index < 2}
        aria-label={COPY.back}
        title={`${COPY.back}. ${COPY.keysHint}`}
        className={iconButton}
      >
        <SkipBackIcon className="h-4 w-4" weight="fill" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => void onStep()}
        disabled={locked || playing || done}
        aria-label={COPY.step}
        title={`${COPY.step}. ${COPY.keysHint}`}
        className={iconButton}
      >
        {busy === 'stepping' ? (
          <CircleNotchIcon className={cx('h-4 w-4', spinner)} weight="bold" aria-hidden />
        ) : (
          <SkipForwardIcon className="h-4 w-4" weight="fill" aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={() => void onRestart()}
        disabled={locked}
        aria-label={COPY.restart}
        title={COPY.restart}
        className={iconButton}
      >
        <ArrowCounterClockwiseIcon className="h-4 w-4" weight="bold" aria-hidden />
      </button>

      <span className="mx-2 hidden h-5 w-px shrink-0 bg-[var(--wt-line)] sm:block" aria-hidden />
      <p
        aria-live="polite"
        className="m-0 hidden whitespace-nowrap text-xs font-medium tabular-nums text-[var(--wt-body)] sm:block"
      >
        {statusLine}
      </p>

      <span className="mx-2 h-5 w-px shrink-0 bg-[var(--wt-line)]" aria-hidden />
      <Toggle checked={follow} onChange={setFollow} label={COPY.follow} />
      <span className="mx-2 h-5 w-px shrink-0 bg-[var(--wt-line)]" aria-hidden />
      <Toggle checked={explain} onChange={setExplain} label={COPY.explain} title={COPY.explainHint} />
      <button
        type="button"
        onClick={onEnd}
        aria-label={COPY.endTour}
        title={COPY.endTour}
        className={cx(iconButton, 'ml-1')}
      >
        <XIcon className="h-4 w-4" weight="bold" aria-hidden />
      </button>

      {error === 'action' && (
        <p
          role="alert"
          className="absolute -top-8 left-1/2 m-0 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-medium text-rose-700"
        >
          {COPY.failed}
        </p>
      )}
      {error === 'loop' && (
        <button
          type="button"
          role="alert"
          onClick={() => void onRetry()}
          className="absolute -top-9 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
        >
          <ArrowClockwiseIcon className="h-3 w-3" weight="bold" aria-hidden />
          {COPY.failed}
        </button>
      )}
    </div>
  );
}
