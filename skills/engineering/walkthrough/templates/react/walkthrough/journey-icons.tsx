'use client';

import { WALKTHROUGH_ART, WalkthroughArt } from './walkthrough-art';

/**
 * The journey's icons: one per picture slug, drawn through the same slot as
 * the reader's picture, at a fixed pixel size inside a clipped box. A host
 * with an icon family (a line set for small rows, a fuller set for the step
 * on screen) maps each slug to its icons here and nowhere else, coloured
 * only from `--wt-*` tokens.
 */

/** The picture slug for a step, or the default picture for a slug the set does not hold. */
export function journeyArt(art: string | null | undefined): string {
  return art && WALKTHROUGH_ART.has(art) ? art : 'default';
}

/** One journey icon at a fixed size; `muted` greys it and lowers it for done and to come. */
export function JourneyIcon({ art, size, muted }: { art: string | null | undefined; size: number; muted: boolean }) {
  const slug = journeyArt(art);
  return (
    <span
      className={muted ? 'opacity-[0.55] grayscale' : undefined}
      style={{ width: size, height: size, display: 'inline-flex' }}
      data-journey-icon={slug}
    >
      <WalkthroughArt slug={slug} size={size} />
    </span>
  );
}
