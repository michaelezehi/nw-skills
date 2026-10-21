// The arrow keys move the story: left asks for the previous step, right for
// the next, and M turns the sound on or off. Keys typed into a field, or with
// a modifier, stay with the page. Every handled key unlocks audio.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

const unlock = vi.hoisted(() => vi.fn());
vi.mock('../useNarration', () => ({ unlockNarration: unlock }));

import { useWalkthroughStore } from '../walkthrough-store';
import { useStepKeys } from '../useStepKeys';

function Keys({ enabled }: { enabled: boolean }) {
  useStepKeys(enabled);
  return <input aria-label="field" />;
}

afterEach(() => {
  cleanup();
  useWalkthroughStore.setState({ stepRequest: null, sound: true });
  unlock.mockReset();
});

describe('useStepKeys', () => {
  it('turns the arrow keys into step requests', () => {
    render(<Keys enabled />);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(useWalkthroughStore.getState().stepRequest).toEqual({ dir: 'back', n: 1 });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(useWalkthroughStore.getState().stepRequest).toEqual({ dir: 'forward', n: 2 });
  });

  it('leaves fields, modifiers and a story not under way alone', () => {
    const { getByLabelText, rerender } = render(<Keys enabled />);
    fireEvent.keyDown(getByLabelText('field'), { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', metaKey: true });
    expect(useWalkthroughStore.getState().stepRequest).toBeNull();
    rerender(<Keys enabled={false} />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(useWalkthroughStore.getState().stepRequest).toBeNull();
  });

  it('M turns the sound off and on, and every handled key unlocks audio', () => {
    render(<Keys enabled />);
    fireEvent.keyDown(document.body, { key: 'm' });
    expect(useWalkthroughStore.getState().sound).toBe(false);
    fireEvent.keyDown(document.body, { key: 'M' });
    expect(useWalkthroughStore.getState().sound).toBe(true);
    expect(useWalkthroughStore.getState().stepRequest).toBeNull();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(unlock).toHaveBeenCalledTimes(3);
  });

  it('leaves M typed into a field, with a modifier, or with no story alone', () => {
    const { getByLabelText, rerender } = render(<Keys enabled />);
    fireEvent.keyDown(getByLabelText('field'), { key: 'm' });
    fireEvent.keyDown(document.body, { key: 'm', metaKey: true });
    expect(useWalkthroughStore.getState().sound).toBe(true);
    rerender(<Keys enabled={false} />);
    fireEvent.keyDown(document.body, { key: 'm' });
    expect(useWalkthroughStore.getState().sound).toBe(true);
    expect(unlock).not.toHaveBeenCalled();
  });
});
