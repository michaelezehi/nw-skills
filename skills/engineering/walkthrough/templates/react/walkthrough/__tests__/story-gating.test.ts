// Which stories a viewer is offered: steps on a feature the workspace has
// off are dropped and renumbered, a story left under three steps is not
// offered, regions follow the company's own setup, and nothing is offered
// until the modules are known.

import { describe, expect, it } from 'vitest';

import { MIN_STORY_STEPS, filterStory, offerStories, offeredInRegion } from '../story-gating';
import type { WalkthroughStory } from '../story-types';

function story(key: string, modules: Array<string | undefined>): WalkthroughStory {
  return {
    key,
    label: `${key} story`,
    steps: modules.map((module, index) => ({
      id: `${key}-${index}`,
      index,
      title: `Step ${index + 1}`,
      route: `/app/${index}`,
      viewAs: null,
      holdMs: 1000,
      explain: { art: 'default', what: 'What.', why: 'Why.' },
      ...(module ? { module } : {}),
    })),
  };
}

const ON = (on: string[]) => (id: string) => on.includes(id);

describe('filterStory', () => {
  it('drops the steps whose module is off and renumbers the rest, keeping their ids', () => {
    const cut = filterStory(story('owner', [undefined, 'payroll', undefined]), ON([]));
    expect(cut.steps.map((s) => s.id)).toEqual(['owner-0', 'owner-2']);
    expect(cut.steps.map((s) => s.index)).toEqual([0, 1]);
  });

  it('hands back the same story when nothing is off', () => {
    const whole = story('owner', [undefined, 'payroll']);
    expect(filterStory(whole, ON(['payroll']))).toBe(whole);
  });
});

describe('offeredInRegion', () => {
  it('offers a story that names no region everywhere, even before the region is known', () => {
    expect(offeredInRegion({}, null)).toBe(true);
  });

  it('holds a story to its regions, or keeps it out of them', () => {
    expect(offeredInRegion({ regions: ['SA'] }, 'sa')).toBe(true);
    expect(offeredInRegion({ regions: ['SA'] }, 'GB')).toBe(false);
    expect(offeredInRegion({ notRegions: ['SA'] }, 'SA')).toBe(false);
    expect(offeredInRegion({ notRegions: ['SA'] }, 'GB')).toBe(true);
  });

  it('offers no region-held story while the region is unknown', () => {
    expect(offeredInRegion({ regions: ['SA'] }, undefined)).toBe(false);
    expect(offeredInRegion({ notRegions: ['SA'] }, '')).toBe(false);
  });
});

describe('offerStories', () => {
  const entries = {
    owner: { story: story('owner', [undefined, undefined, 'payroll', undefined]) },
    short: { story: story('short', [undefined, 'payroll', 'payroll']) },
    saudi: { story: story('saudi', [undefined, undefined, undefined]), regions: ['SA'] },
  };

  it('offers nothing until the modules are known', () => {
    expect(offerStories({ entries, isModuleOn: undefined, region: 'SA' })).toEqual({});
  });

  it('cuts each story to the workspace, and drops one left too short or held elsewhere', () => {
    const offered = offerStories({ entries, isModuleOn: ON([]), region: 'GB' });
    expect(Object.keys(offered)).toEqual(['owner']);
    expect(offered.owner!.steps).toHaveLength(MIN_STORY_STEPS);
    expect(Object.keys(offerStories({ entries, isModuleOn: ON(['payroll']), region: 'SA' }))).toEqual([
      'owner',
      'short',
      'saudi',
    ]);
  });
});
