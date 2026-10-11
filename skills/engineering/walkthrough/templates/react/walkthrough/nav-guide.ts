/**
 * "Show me how to get there": find the menu link a viewer would use to reach
 * a step's screen. Looks only at links in the app chrome (header, nav,
 * sidebar), never inside the walkthrough's own panels, and prefers the most
 * specific one: an exact path match, else the longest link path the route
 * sits under. A role's home link (one segment, like `/app` or `/coach`)
 * matches only itself, or every screen without its own menu item would
 * point at Home.
 */

/** Marks the walkthrough's own panels so their links are never picked as the menu. */
export const WALKTHROUGH_UI_ATTR = 'data-walkthrough-ui';

/**
 * Screens with no menu item of their own, and the menu item that leads
 * there: tabs inside a page, detail pages under a list. Fill this from the
 * host's investigation; an unmapped screen with no menu item shows no button.
 */
export const REACHED_THROUGH: Record<string, string> = {
  // '/app/team/blueprint': '/app/team',
};

export interface NavTarget {
  element: HTMLElement;
  /** What the link says, for the "Open Team" caption. Empty when it has no words. */
  label: string;
}

function linkPath(href: string): string | null {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** `/app`, `/coach`, `/vc`: one segment, the role's home. */
function isRoleHome(href: string): boolean {
  return href.split('/').length === 2;
}

function labelOf(el: HTMLElement): string {
  const text = (el.getAttribute('aria-label') ?? el.textContent ?? el.getAttribute('title') ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 40 ? '' : text;
}

export function findNavTarget(
  route: string,
  root: ParentNode = document,
  reachedThrough: Record<string, string> = REACHED_THROUGH,
): NavTarget | null {
  const own = route.split('?')[0]!.replace(/\/+$/, '') || '/';
  const path = reachedThrough[own] ?? own;
  let best: { element: HTMLElement; score: number } | null = null;
  for (const el of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (el.closest(`[${WALKTHROUGH_UI_ATTR}]`)) continue;
    if (!el.closest('header, nav, aside')) continue;
    const href = linkPath(el.getAttribute('href') ?? '');
    if (!href || href === '/') continue;
    let score = 0;
    if (href === path) score = 10_000 + href.length;
    else if (!isRoleHome(href) && path.startsWith(`${href}/`)) score = href.length;
    if (score === 0 || !isVisible(el)) continue;
    if (!best || score > best.score) best = { element: el, score };
  }
  return best ? { element: best.element, label: labelOf(best.element) } : null;
}
