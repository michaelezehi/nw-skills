'use client';

/**
 * The picture slot. Every panel that shows art calls this, so the host's own
 * illustration system plugs in here and nowhere else. Always render at a
 * fixed pixel size: a percentage size grows with the panel's width and
 * spills out of a short picture box.
 *
 * Default: transparent square images at `/walkthrough/<slug>.webp`, with
 * `default.webp` for a slug the host has no picture for. Replace the body
 * with the host's component (an iso set, an icon family, Lottie) if it has one.
 */
export const WALKTHROUGH_ART = new Set<string>([
  // List the slugs that exist; anything else falls back to 'default'.
  'default',
]);

export function WalkthroughArt({ slug, size }: { slug: string | null; size: number }) {
  const name = slug && WALKTHROUGH_ART.has(slug) ? slug : 'default';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/walkthrough/${name}.webp`}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className="pointer-events-none shrink-0 select-none object-contain"
      style={{ width: size, height: size }}
    />
  );
}
