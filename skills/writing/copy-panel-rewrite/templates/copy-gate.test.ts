// Copy gate: fails when a bank or copy module breaks the house rules.
// Adapt the imports and limits to the project; keep the frozen option counts.
import { describe, expect, it } from 'vitest';
// import { ITEMS } from '<path to the question bank>';

interface Item { slug: string; text: string; options?: string[] }
const ITEMS: Item[] = [];

const BANNED = [/\u2014/, /\u2013/, /\s-\s/, /\bassessment\b/i];
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// Frozen when this test was written: option count per item. A change here
// changes scoring, so it must be deliberate.
const OPTION_COUNTS: Record<string, number> = {};

describe('copy gate', () => {
  it.each(ITEMS.map((i) => [i.slug, i] as const))('%s obeys the house rules', (_slug, item) => {
    for (const s of [item.text, ...(item.options ?? [])]) {
      for (const re of BANNED) expect(s, `"${s}" matches ${re}`).not.toMatch(re);
      expect(s, 'slash between words').not.toMatch(/\w\/\w/);
    }
    expect(words(item.text)).toBeLessThanOrEqual(20);
    for (const o of item.options ?? []) expect(words(o)).toBeLessThanOrEqual(12);
  });

  it('keeps every option count', () => {
    for (const item of ITEMS) {
      if (item.slug in OPTION_COUNTS) expect(item.options?.length ?? 0, item.slug).toBe(OPTION_COUNTS[item.slug]);
    }
  });
});
