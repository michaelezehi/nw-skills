// The local driver: one step at a time on the index the caller saw, back no
// further than step one, progress kept per viewer and per story, and a tour
// left playing comes back paused.

import { afterEach, describe, expect, it } from 'vitest';

import { createLocalDriver } from '../local-driver';
import type { WalkthroughStory } from '../story-types';

const STORY: WalkthroughStory = {
  key: 'founder',
  label: 'Founder story',
  steps: [1, 2, 3].map((n) => ({
    id: `s${n}`,
    index: n - 1,
    title: `Step title ${n}`,
    route: `/app/${n}`,
    viewAs: null,
    holdMs: 1000,
    explain: { art: 'default', what: 'What.', why: 'Why.' },
  })),
};

afterEach(() => window.localStorage.clear());

describe('createLocalDriver', () => {
  it('plays, refuses a stale index, and finishes', async () => {
    const d = createLocalDriver(STORY, 'u1', () => {});
    await d.start();
    expect((await d.advance(0, { step: false })).index).toBe(1);
    expect((await d.advance(0, { step: false })).index).toBe(1);
    await d.advance(1, { step: false });
    const end = await d.advance(2, { step: false });
    expect(end.status).toBe('done');
    expect(end.lastStep?.id).toBe('s3');
  });

  it('a paused run moves only on a step request, and back stops at step one', async () => {
    const d = createLocalDriver(STORY, 'u1', () => {});
    await d.start();
    await d.advance(0, { step: false });
    await d.pause();
    expect((await d.advance(1, { step: false })).index).toBe(1);
    expect((await d.advance(1, { step: true })).index).toBe(2);
    const back = await d.back(2);
    expect(back.index).toBe(1);
    expect(back.status).toBe('paused');
    expect((await d.back(1)).index).toBe(1);
  });

  it('keeps progress per viewer, and a playing tour reloads paused', async () => {
    const a = createLocalDriver(STORY, 'u1', () => {});
    await a.start();
    await a.advance(0, { step: false });
    const again = createLocalDriver(STORY, 'u1', () => {});
    expect(again.current().index).toBe(1);
    expect(again.current().status).toBe('paused');
    expect(createLocalDriver(STORY, 'u2', () => {}).current().index).toBe(0);
  });
});
