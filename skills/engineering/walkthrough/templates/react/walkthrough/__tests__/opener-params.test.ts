// Pop-up params: a step's pop-up (`?companion=1` here) comes off when the
// next step does not open it too, keeping the tab the page is on. The host
// list is empty by default, so nothing is ever taken off until it fills it.

import { describe, expect, it } from 'vitest';

import { OPENER_PARAMS, withoutOpeners } from '../opener-params';

const OPENERS = ['companion'];

describe('withoutOpeners', () => {
  it('takes the pop-up off when the next step does not open it', () => {
    expect(withoutOpeners('?companion=1', '', OPENERS)).toBe('');
    expect(withoutOpeners('?companion=1', '/dashboard', OPENERS)).toBe('');
  });

  it('keeps the tab the page is on', () => {
    expect(withoutOpeners('?view=ranked&companion=1', '/jobs', OPENERS)).toBe('?view=ranked');
  });

  it('leaves it open when the next step opens it too', () => {
    expect(withoutOpeners('?companion=1', '/jobs?companion=1', OPENERS)).toBeNull();
  });

  it('has nothing to do on a page with no pop-up open', () => {
    expect(withoutOpeners('?tab=hr', '/company-settings', OPENERS)).toBeNull();
    expect(withoutOpeners('', '', OPENERS)).toBeNull();
  });

  it('takes nothing off until the host lists its openers', () => {
    expect(OPENER_PARAMS).toEqual([]);
    expect(withoutOpeners('?companion=1')).toBeNull();
  });
});
