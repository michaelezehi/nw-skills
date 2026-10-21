/**
 * Query params that open a pop-up over the page, such as `?companion=1` for
 * an assistant card. A step may set one in its route to show the pop-up; the
 * next step that does not set it, the end of the tour, or a switch to another
 * story takes it off again, so the pop-up never follows the story onto other
 * pages. Empty by default: list the host's own, e.g. `['companion']`.
 */
export const OPENER_PARAMS: readonly string[] = [];

/**
 * `search` without the openers that `route` does not set itself, as a
 * search string (`''` when nothing is left), or null when there is nothing
 * to take off.
 */
export function withoutOpeners(
  search: string,
  route = '',
  openers: readonly string[] = OPENER_PARAMS,
): string | null {
  const params = new URLSearchParams(search);
  const wanted = new URLSearchParams(route.split('?')[1] ?? '');
  const stale = openers.filter((param) => params.has(param) && !wanted.has(param));
  if (stale.length === 0) return null;
  stale.forEach((param) => params.delete(param));
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
