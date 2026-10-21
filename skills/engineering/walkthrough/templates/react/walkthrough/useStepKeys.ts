'use client';

import { useEffect } from 'react';

import { useWalkthroughStore } from './walkthrough-store';
import { unlockNarration } from './useNarration';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  // A list, menu or combobox moves its own highlight with the arrows (the story picker is one).
  return Boolean(
    target.closest(
      'input, textarea, select, [role="slider"], [role="textbox"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"]',
    ),
  );
}

/**
 * The left and right arrow keys move the story one step back or forward, and
 * `M` turns the narration on or off. Keys typed into a field, or held with a
 * modifier, are left to the page, and so is every key while no story is under
 * way. A key press is a user gesture, so each one also unlocks audio.
 */
export function useStepKeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const mute = event.key.toLowerCase() === 'm';
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && !mute) return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (isEditable(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      unlockNarration();
      const store = useWalkthroughStore.getState();
      if (mute) {
        store.setSound(!store.sound);
        return;
      }
      store.requestStep(event.key === 'ArrowLeft' ? 'back' : 'forward');
    };
    // Capture, so a page's own arrow handling does not also move under the story.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
