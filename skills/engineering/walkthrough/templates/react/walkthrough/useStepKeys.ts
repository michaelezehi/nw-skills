'use client';

import { useEffect } from 'react';

import { useWalkthroughStore } from './walkthrough-store';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [role="slider"], [role="textbox"]'));
}

/**
 * The left and right arrow keys move the story one step back or forward.
 * Keys typed into a field, or held with a modifier, are left to the page, and
 * so is every arrow key while no story is under way.
 */
export function useStepKeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (isEditable(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      useWalkthroughStore.getState().requestStep(event.key === 'ArrowLeft' ? 'back' : 'forward');
    };
    // Capture, so a page's own arrow handling does not also move under the story.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
