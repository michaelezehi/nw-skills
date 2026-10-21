/**
 * The walkthrough's narration clips, derived from the stories. Pure: no file
 * or network access, so the generator and the drift test read the same list.
 * A clip's `textHash` is taken over the speakable text actually sent to the
 * voice, so a copy edit shows up as drift.
 *
 * No imports from the host: the stories are passed in, typed only by the
 * fields read here.
 */

import { createHash } from 'node:crypto';

export type NarrationPart = 'lead' | 'detail';

export const NARRATION_PARTS: readonly NarrationPart[] = ['lead', 'detail'];

/** The parts of a `WalkthroughStory` the narration reads. */
export interface NarratedStory {
  key: string;
  steps: ReadonlyArray<{ id: string; narration?: { lead: string; detail: string } }>;
}

export interface NarrationClip {
  story: string;
  stepId: string;
  part: NarrationPart;
  /** The speakable text sent to the voice. */
  text: string;
  textHash: string;
}

/**
 * The text as it should be spoken: a dash becomes a comma pause, runs of
 * spaces collapse, and paragraph breaks stay so the voice takes a breath.
 */
export function speakableText(text: string): string {
  return text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function hashNarrationText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Manifest key for one clip: `<story>/<stepId>/<part>`. */
export function clipKey(story: string, stepId: string, part: NarrationPart): string {
  return `${story}/${stepId}/${part}`;
}

/**
 * Path under the audio folder (`--out`), matching the player's
 * `${NARRATION_BASE}/<story>/<stepId>/<part>.mp3`.
 */
export function clipRelPath(story: string, stepId: string, part: NarrationPart): string {
  return `${clipKey(story, stepId, part)}.mp3`;
}

function isStory(value: unknown): value is NarratedStory {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { key?: unknown; steps?: unknown };
  return typeof v.key === 'string' && Array.isArray(v.steps);
}

function asStories(value: unknown): NarratedStory[] | null {
  const resolved = typeof value === 'function' ? (value as () => unknown)() : value;
  if (Array.isArray(resolved)) return resolved.every(isStory) ? resolved : null;
  if (typeof resolved !== 'object' || resolved === null) return null;
  const list = Object.values(resolved);
  return list.length > 0 && list.every(isStory) ? list : null;
}

/**
 * The stories out of a loaded module: its default export, else a named
 * `STORIES` or `stories`. Each may be a record keyed by story key (what
 * `<Walkthrough stories>` takes), an array of stories, or a function with
 * no arguments that returns either. Null when none fits.
 */
export function resolveStories(mod: Record<string, unknown>): NarratedStory[] | null {
  const fallback = mod.default as Record<string, unknown> | undefined;
  for (const candidate of [mod.default, mod.STORIES, mod.stories, fallback?.STORIES, fallback?.stories]) {
    if (candidate === undefined) continue;
    const stories = asStories(candidate);
    if (stories) return stories;
  }
  return null;
}

/** One lead and one detail clip per narrated step. A step without narration has none. */
export function narrationClips(stories: readonly NarratedStory[]): NarrationClip[] {
  return stories.flatMap((story) =>
    story.steps.flatMap((step) => {
      if (!step.narration) return [];
      const narration = step.narration;
      return NARRATION_PARTS.map((part) => {
        const text = speakableText(narration[part]);
        return { story: story.key, stepId: step.id, part, text, textHash: hashNarrationText(text) };
      });
    }),
  );
}
