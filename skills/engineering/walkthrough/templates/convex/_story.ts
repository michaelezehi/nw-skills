// Director tier story data. Pure data: seats, never ids or names. The run
// module resolves a seat against the director's demo world when a step is
// applied, and fills names into `{placeholders}` from the cast.

export type StoryKey = 'founder' | 'coach' | 'investor'; // HOST: one per role
export type EffectKey = 'none'; // HOST: one per data change a step makes

export interface Beat {
  id: string;
  title: string;
  /** The seat in view; null is the director themselves. */
  viewAs: string | null;
  route: string;
  effect: EffectKey;
  /** Why the step writes nothing, when it does not (the seeded state already shows it). */
  promptOnlyReason?: string;
  prompts: readonly { to: string; title: string; body: string; ctaLabel?: string; ctaRoute?: string }[];
  explain: { art: string; what: string; why: string };
  holdMs: number;
}

export interface Story {
  /** Versioned: bump it when the steps change, so an old run reads as not started. */
  id: string;
  key: StoryKey;
  label: string;
  beats: readonly Beat[];
}

export const STORIES: Record<StoryKey, Story> = {
  founder: { id: 'founder-v1', key: 'founder', label: 'Founder story', beats: [] },
  coach: { id: 'coach-v1', key: 'coach', label: 'Coach story', beats: [] },
  investor: { id: 'investor-v1', key: 'investor', label: 'Investor story', beats: [] },
};

export function storyById(id: string): Story | null {
  return Object.values(STORIES).find((s) => s.id === id) ?? null;
}
