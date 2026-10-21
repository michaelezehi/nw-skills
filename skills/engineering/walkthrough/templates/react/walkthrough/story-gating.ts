import type { WalkthroughStory } from './story-types';

/**
 * Which stories a viewer is offered. Two gates, both decided from the
 * workspace's own setup and never from the viewer: a step whose page belongs
 * to a feature the workspace has off is left out (`WalkthroughStep.module`),
 * and a story may be held to the regions a company is set up in. A story
 * left too short to be worth a tour is not offered at all.
 */

/** A story with fewer steps than this after filtering is not offered. */
export const MIN_STORY_STEPS = 3;

/** A story as the host lists it, with the regions it is held to. */
export interface StoryEntry {
  story: WalkthroughStory;
  /** Offered only to companies set up in one of these regions (ISO alpha-2, e.g. 'SA'). */
  regions?: readonly string[];
  /** Never offered to companies set up in one of these regions. */
  notRegions?: readonly string[];
}

/**
 * The story without the steps whose module is off. Step ids stay as they are,
 * so saved progress finds its step again; positions are renumbered.
 */
export function filterStory(story: WalkthroughStory, isModuleOn: (moduleId: string) => boolean): WalkthroughStory {
  const steps = story.steps.filter((step) => !step.module || isModuleOn(step.module));
  if (steps.length === story.steps.length) return story;
  return { ...story, steps: steps.map((step, index) => ({ ...step, index })) };
}

/**
 * True when a story may be offered to a company set up in `region`. A region
 * that is not known yet offers only the stories that name no region.
 */
export function offeredInRegion(entry: Pick<StoryEntry, 'regions' | 'notRegions'>, region: string | null | undefined): boolean {
  if (!entry.regions && !entry.notRegions) return true;
  const code = (region ?? '').trim().toUpperCase();
  if (!code) return false;
  if (entry.regions && !entry.regions.includes(code)) return false;
  if (entry.notRegions?.includes(code)) return false;
  return true;
}

/**
 * The stories to hand `Walkthrough`, keyed by story key, in the order given.
 * Pass only the entries this viewer's role may take. Until the workspace's
 * modules are known (`isModuleOn` undefined) nothing is offered, so no step
 * ever lands on a page the viewer cannot open.
 */
export function offerStories({
  entries,
  isModuleOn,
  region,
}: {
  entries: Record<string, StoryEntry>;
  isModuleOn: ((moduleId: string) => boolean) | undefined;
  /** The company's own region, from its setup, never the viewer's locale. */
  region: string | null | undefined;
}): Record<string, WalkthroughStory> {
  if (!isModuleOn) return {};
  const offered: Record<string, WalkthroughStory> = {};
  for (const [key, entry] of Object.entries(entries)) {
    if (!offeredInRegion(entry, region)) continue;
    const story = filterStory(entry.story, isModuleOn);
    if (story.steps.length >= MIN_STORY_STEPS) offered[key] = story;
  }
  return offered;
}
