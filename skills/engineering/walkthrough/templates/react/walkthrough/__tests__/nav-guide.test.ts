// "Show me how to get there" picks the menu link for a step's screen: the
// exact path first, else the longest link the route sits under, and never a
// link inside the demo's own panels.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { WALKTHROUGH_UI_ATTR, findNavTarget } from '../nav-guide';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  // jsdom lays nothing out; every element reads as visible.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 40, height: 20, left: 0, top: 0, right: 40, bottom: 20, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('findNavTarget', () => {
  it('prefers the exact link, then the longest parent', () => {
    mount(`
      <header><a href="/app">Home</a><a href="/app/pulse">Pulse</a></header>
      <aside><a href="/app/my-coach" aria-label="My coach"></a></aside>`);
    expect(findNavTarget('/app/my-coach')?.label).toBe('My coach');
    expect(findNavTarget('/app/pulse?tab=capacity')?.label).toBe('Pulse');
    expect(findNavTarget('/app/pulse/history')?.label).toBe('Pulse');
  });

  it('never falls back to the home link, and sends tab screens to their menu item', () => {
    mount(`
      <header><a href="/app">Home</a><a href="/app/team">Team</a></header>`);
    expect(findNavTarget('/app')?.label).toBe('Home');
    const tabs = { '/app/blueprint': '/app/team' };
    expect(findNavTarget('/app/blueprint', document, tabs)?.label).toBe('Team');
    expect(findNavTarget('/app/sessions')).toBeNull();
  });

  it('ignores links outside the chrome and inside demo panels', () => {
    mount(`
      <main><a href="/app/alerts">Body link</a></main>
      <section ${WALKTHROUGH_UI_ATTR}><nav><a href="/app/alerts">Prompt link</a></nav></section>`);
    expect(findNavTarget('/app/alerts')).toBeNull();
  });
});
