// The arrow keys move the story: left asks for the previous step, right for
// the next. Keys typed into a field, or with a modifier, stay with the page.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { useWalkthroughStore } from '../walkthrough-store';
import { useStepKeys } from '../useStepKeys';

function Keys({ enabled }: { enabled: boolean }) {
  useStepKeys(enabled);
  return <input aria-label="field" />;
}

afterEach(() => {
  cleanup();
  useWalkthroughStore.setState({ stepRequest: null });
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
});
