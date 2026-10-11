'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRightIcon, XIcon } from '@phosphor-icons/react';

import type { WalkthroughPrompt } from './story-types';
import { WalkthroughArt } from './walkthrough-art';
import { WALKTHROUGH_COPY as COPY } from './walkthrough-copy';
import { useWalkthroughStore } from './walkthrough-store';
import { WALKTHROUGH_UI_ATTR } from './nav-guide';
import { EYEBROW, PILL, cx } from './walkthrough-ui';

/** At most this many cards on screen. */
const MAX_VISIBLE = 3;
/** Long enough to read a two-line body on camera. */
const AUTO_DISMISS_MS = 8_000;

function PromptCard({
  prompt,
  onDismiss,
  onAct,
}: {
  prompt: WalkthroughPrompt;
  onDismiss: (id: string) => void;
  onAct: (prompt: WalkthroughPrompt) => void;
}) {
  const reduceMotion = useReducedMotion();
  const fireDismiss = useEffectEvent(() => onDismiss(prompt.id));
  // WCAG 2.2.1: a card someone is reading or tabbing through never times out.
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const held = hovered || focusInside;

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => fireDismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [prompt.id, held]);

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48, scale: 0.96 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48, scale: 0.96 }}
      transition={
        reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }
      }
      data-testid="walkthrough-prompt"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
      }}
      className="pointer-events-auto relative flex w-full overflow-hidden rounded-[24px] border border-[var(--wt-line)] bg-[var(--wt-surface)] shadow-[var(--wt-shadow-card)]"
    >
      {/* The split: picture left, message right. */}
      <div className="grid w-[118px] shrink-0 place-items-center bg-[var(--wt-art-panel)]" aria-hidden>
        <WalkthroughArt slug={prompt.art} size={92} />
      </div>
      <div className="min-w-0 flex-1 py-4 pl-4 pr-10">
        <p className={EYEBROW}>{COPY.promptEyebrow}</p>
        <p className="m-0 mt-1.5 text-[16px] font-medium leading-[1.25] -tracking-[0.02em] text-[var(--wt-ink)]">
          {prompt.title}
        </p>
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-[var(--wt-body)]">{prompt.body}</p>
        {prompt.ctaLabel && (
          <button
            type="button"
            onClick={() => onAct(prompt)}
            className={cx(
              'mt-3 inline-flex h-9 items-center gap-1.5 whitespace-nowrap px-4 text-xs font-semibold',
              PILL,
            )}
          >
            {prompt.ctaLabel}
            <ArrowRightIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(prompt.id)}
        aria-label={COPY.dismiss}
        className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--wt-muted)] transition-colors hover:bg-[var(--wt-hover)] hover:text-[var(--wt-ink-strong)]"
      >
        <XIcon className="h-3.5 w-3.5" weight="bold" aria-hidden />
      </button>
    </motion.li>
  );
}

/**
 * Cards that stand in for emails and notifications during the story. They
 * stack top right and step left of the reader while it is open, so the two
 * never overlap.
 */
export function PromptLayer({
  prompts,
  onDismiss,
  onAct,
}: {
  prompts: WalkthroughPrompt[];
  onDismiss: (id: string) => void;
  onAct: (prompt: WalkthroughPrompt) => void;
}) {
  const readerOpen = useWalkthroughStore((st) => st.explanation !== null);
  return (
    <section
      {...{ [WALKTHROUGH_UI_ATTR]: '' }}
      aria-label={COPY.promptsLabel}
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed top-[var(--wt-header-h)] z-[70] w-[min(400px,calc(100vw-32px))] transition-[right] duration-300',
        // The reader's width plus its gutter.
        readerOpen ? 'right-4 lg:right-[calc(var(--wt-reader-w)+32px)]' : 'right-4',
      )}
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        <AnimatePresence initial={false}>
          {prompts.slice(0, MAX_VISIBLE).map((p) => (
            <PromptCard key={p.id} prompt={p} onDismiss={onDismiss} onAct={onAct} />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
