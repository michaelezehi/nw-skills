/**
 * The plain view's LATEST feed: notable events and Convex calls merged, newest first.
 * Routine noise stays out: GET requests that worked, cached or quick queries, compile
 * and info lines. The service rows already say what is compiling.
 */
import type { ConvexCall, DevEvent } from '../types.ts';

/** A request or query this slow is worth a line even when it worked. */
export const SLOW_LATEST_MS = 1000;

export type LatestItem =
  | { type: 'event'; at: number; id: number; event: DevEvent }
  | { type: 'call'; at: number; id: number; call: ConvexCall };

export function isNotableEvent(event: DevEvent): boolean {
  switch (event.kind) {
    case 'ready':
    case 'reload':
    case 'push':
    case 'error':
    case 'recovered':
    case 'exit':
    case 'restart':
      return true;
    case 'request':
      return (event.status !== undefined && event.status >= 400) || (event.ms !== undefined && event.ms >= SLOW_LATEST_MS);
    case 'compile':
    case 'info':
      return false;
  }
}

export function isNotableCall(call: ConvexCall): boolean {
  if (!call.ok) return true;
  if (call.cached) return false;
  if (call.type === 'Query') return call.ms >= SLOW_LATEST_MS;
  return true;
}

/** Up to `limit` notable items, newest first. */
export function latestItems(events: readonly DevEvent[], calls: readonly ConvexCall[], limit: number): LatestItem[] {
  if (limit <= 0) return [];
  const items: LatestItem[] = [];
  for (const event of events) if (isNotableEvent(event)) items.push({ type: 'event', at: event.at, id: event.id, event });
  for (const call of calls) if (isNotableCall(call)) items.push({ type: 'call', at: call.at, id: call.id, call });
  items.sort((a, b) => b.at - a.at || b.id - a.id);
  return items.slice(0, limit);
}
