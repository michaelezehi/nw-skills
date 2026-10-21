// Walkthrough narration drift gate. Every narrated step has its lead and
// detail clip on disk and the manifest hash matches the current text, so a
// copy edit without a fresh `generate-narration` run fails here and the voice
// never says something the story no longer does. Narration is spoken to
// every viewer from one clip, so it may hold no `{placeholder}`, and no dash
// the voice would read as a gap.

import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';

// HOST: point these at the app's stories and its copy of narration-clips.ts.
import { STORIES } from '@/components/walkthrough/stories';
import { clipKey, clipRelPath, narrationClips, resolveStories } from '../scripts/audio/narration-clips';

// HOST: the folder the generator's --out wrote, from the app root vitest runs in.
const AUDIO_DIR = path.resolve(process.cwd(), 'public/audio/walkthrough');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');

interface Manifest {
  schemaVersion: number;
  clips: Record<string, { textHash: string; durationMs: number; sizeBytes: number }>;
}

const stories = resolveStories({ STORIES }) ?? [];
const clips = narrationClips(stories);
const manifest: Manifest = existsSync(MANIFEST_PATH)
  ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest)
  : { schemaVersion: 0, clips: {} };

describe('walkthrough narration audio', () => {
  test('the stories load and the manifest is current', () => {
    expect(stories.length).toBeGreaterThan(0);
    if (clips.length > 0) expect(manifest.schemaVersion).toBe(1);
  });

  test.each(clips.map((clip) => [clipKey(clip.story, clip.stepId, clip.part), clip] as const))(
    '%s is on disk and matches its text',
    (key, clip) => {
      const file = path.join(AUDIO_DIR, clipRelPath(clip.story, clip.stepId, clip.part));
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(1024);
      expect(manifest.clips[key]?.textHash).toBe(clip.textHash);
    },
  );

  test('the manifest holds no clip for a step that is gone', () => {
    const live = new Set(clips.map((c) => clipKey(c.story, c.stepId, c.part)));
    expect(Object.keys(manifest.clips).filter((key) => !live.has(key))).toEqual([]);
  });

  test('narration holds no placeholder and no dash', () => {
    const bad = stories.flatMap((story) =>
      story.steps.flatMap((step) =>
        step.narration
          ? [step.narration.lead, step.narration.detail]
              .filter((text) => /[{\u2014\u2013]/.test(text))
              .map((text) => `${story.key}/${step.id}: ${text}`)
          : [],
      ),
    );
    expect(bad).toEqual([]);
  });
});
