'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { WALKTHROUGH_COPY } from './walkthrough-copy';
import { WALKTHROUGH_UI_ATTR, type NavTarget } from './nav-guide';

/** How long the ring shows on the menu item before it is clicked for the viewer. */
export const SPOTLIGHT_CLICK_MS = 1600;
const PAD = 6;

/**
 * A soft ring around the menu item that opens a step's screen, with a caption
 * under it. After a moment it clicks the item, so the viewer sees where to go
 * and then goes there.
 */
export function NavSpotlight({ target, onDone }: { target: NavTarget; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [rect, setRect] = useState(() => target.element.getBoundingClientRect());

  useEffect(() => {
    const measure = () => setRect(target.element.getBoundingClientRect());
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);

  const finish = useEffectEvent(() => {
    target.element.click();
    onDone();
  });
  // Once per target: a scroll or resize re-measures the ring, never restarts the wait.
  useEffect(() => {
    const timer = setTimeout(() => finish(), SPOTLIGHT_CLICK_MS);
    return () => clearTimeout(timer);
  }, [target]);

  const label = WALKTHROUGH_COPY.showMeHowLink(target.label || WALKTHROUGH_COPY.showMeHowFallback);

  return (
    <div
      {...{ [WALKTHROUGH_UI_ATTR]: '' }}
      className="pointer-events-none fixed inset-0 z-[120]"
      aria-live="polite"
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.25 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute rounded-[18px] border-2 border-[var(--wt-dark)]"
        style={{
          left: rect.left - PAD,
          top: rect.top - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: '0 0 0 6px var(--wt-accent-glow), 0 12px 40px rgba(36,36,30,0.18)',
        }}
      />
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
        className="absolute m-0 whitespace-nowrap rounded-full border border-[var(--wt-line)] bg-[var(--wt-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wt-ink-strong)] shadow-[var(--wt-shadow-caption)]"
        style={{ left: Math.max(12, rect.left - PAD), top: rect.bottom + PAD + 10 }}
      >
        {label}
      </motion.p>
    </div>
  );
}
