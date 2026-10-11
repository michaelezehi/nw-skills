/** Class strings every walkthrough panel shares. Colours come from walkthrough.css. */

/** The eyebrow: tiny, extra-bold, widely tracked, never wraps. */
export const EYEBROW =
  'm-0 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wt-faint)]';

/** The primary pill: accent fill, dark label. */
export const PILL =
  'rounded-full bg-[var(--wt-accent)] text-[var(--wt-accent-ink)] shadow-[0_2px_10px_rgba(36,36,30,0.10)] transition-colors hover:bg-[var(--wt-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wt-dark)] focus-visible:ring-offset-2';

/** A round secondary button: white, hairline, warm hover. */
export const ROUND_BUTTON =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wt-line)] bg-white text-[var(--wt-ink-strong)] transition-colors hover:bg-[var(--wt-art-panel)] disabled:opacity-50';

/** Body copy inside the reader and the cards. */
export const READING = 'm-0 text-[13.5px] leading-[1.55] text-[var(--wt-body)]';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
