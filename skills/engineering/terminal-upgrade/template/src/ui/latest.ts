/**
 * The plain deck's LATEST feed: notable events and Convex calls merged, newest first.
 * Routine noise stays out: GET requests that worked, cached or quick queries, compile
 * and info lines. The cards already say what is compiling. Repeats of the same item,
 * a cron firing every few seconds, fold into their newest occurrence with a count.
 */
import type { ConvexCall, DevEvent } from '../types.ts';

/** A request or query this slow is worth a line even when it worked. */
export const SLOW_LATEST_MS = 1000;

export type LatestItem =
  | { type: 'event'; at: number; id: number; event: DevEvent }
  | { type: 'call'; at: number; id: number; call: ConvexCall };

export interface LatestRow {
  key: string;
  /** The newest occurrence. */
  item: LatestItem;
  /** How many identical items this row stands for. */
  count: number;
}

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

/** Two items are the same row when the same function (or service and text) had the same outcome. */
export function latestKey(item: LatestItem): string {
  if (item.type === 'call') return `call:${item.call.type}:${item.call.fn}:${item.call.ok ? 'ok' : (item.call.error ?? 'failed')}`;
  return `event:${item.event.service}:${item.event.kind}:${item.event.text}`;
}

/** Notable items newest first, repeats folded into their newest occurrence. */
export function latestRows(events: readonly DevEvent[], calls: readonly ConvexCall[]): LatestRow[] {
  const rows = new Map<string, LatestRow>();
  for (const item of latestItems(events, calls, Infinity)) {
    const key = latestKey(item);
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { key, item, count: 1 });
  }
  return [...rows.values()];
}
