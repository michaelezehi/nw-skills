'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { WalkthroughArt } from './walkthrough-art';
import { WALKTHROUGH_COPY as COPY } from './walkthrough-copy';
import { useWalkthroughStore } from './walkthrough-store';
import { WALKTHROUGH_UI_ATTR } from './nav-guide';
import { EYEBROW } from './walkthrough-ui';

/**
 * Covers the page while a step's screen loads. Without it a switch shows an
 * empty frame for a second, which reads as a broken app. Sits under the
 * reader, so the explanation stays readable through the switch. If the host
 * already has a page loader, render that here instead.
 */
export function SwitchLoader() {
  const switching = useWalkthroughStore((st) => st.pending > 0);
  return (
    <AnimatePresence>
      {switching && (
        <motion.div
          {...{ [WALKTHROUGH_UI_ATTR]: '' }}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-[var(--wt-surface)]/90 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <WalkthroughArt slug="default" size={96} />
            </motion.div>
            <p className={EYEBROW}>{COPY.switching}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
