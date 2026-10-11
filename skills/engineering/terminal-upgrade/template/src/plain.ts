import type { DeckStore } from './store.ts';
import type { ConvexCall, DevError, DevEvent, DevEventKind } from './types.ts';

/** Convex calls slower than this print in plain mode even when they succeed. */
export const SLOW_CALL_MS = 1000;

const ICONS: Record<DevEventKind, string> = {
  ready: '▲',
  reload: '⚡',
  compile: '⚡',
  request: '✓',
  push: '↑',
  error: '✗',
  recovered: '✓',
  exit: '■',
  restart: '↻',
  info: '·',
};

export function tag(service: string, width: number): string {
  return `[${service}]`.padEnd(width + 2);
}

function icon(event: DevEvent): string {
  if (event.kind === 'request' && event.status !== undefined && event.status >= 400) return '✗';
  return ICONS[event.kind];
}

/** One plain line for an event, e.g. `[admin] ⚡ compiled /dashboard 182ms`. */
export function formatEvent(event: DevEvent, width: number): string {
  let text = event.text;
  if (event.kind === 'request' && event.status !== undefined && !new RegExp(`\\b${event.status}\\b`).test(text)) {
    text += ` ${event.status}`;
  }
  if (event.ms !== undefined) text += ` ${Math.round(event.ms)}ms`;
  return `${tag(event.service, width)} ${icon(event)} ${text}`;
}

/** An error in full: the title line, then the body indented. */
export function formatError(error: DevError, width: number): string[] {
  const head = `${tag(error.service, width)} ✗ ${error.title}${error.file ? `  (${error.file})` : ''}`;
  const body = error.body.filter((line, i) => !(i === 0 && line.trim() === error.title.trim()));
  return [head, ...body.map((line) => `${' '.repeat(width + 3)}  ${line}`)];
}

/** A convex call line, or null when it is fast and fine (those stay quiet in plain mode). */
export function formatCall(call: Omit<ConvexCall, 'id'>, width: number): string | null {
  if (call.ok && call.ms <= SLOW_CALL_MS) return null;
  const mark = call.ok ? '⏱' : '✗';
  const tail = call.ok ? '' : `  ${call.error ?? 'failed'}`;
  return `${tag('convex', width)} ${mark} ${call.type} ${call.fn} ${Math.round(call.ms)}ms${tail}`;
}

export interface PlainOutput {
  write(chunk: string): unknown;
}

/** Print new events, errors and noteworthy calls as they land. Returns an unsubscribe. */
export function startPlain(store: DeckStore, out: PlainOutput = process.stdout): () => void {
  const initial = store.getState();
  const width = Math.max(6, 'devdeck'.length, ...initial.order.map((id) => id.length));
  let lastEvent = initial.events.at(-1)?.id ?? 0;
  let lastError = initial.errors.at(-1)?.id ?? 0;
  let lastCall = initial.calls.at(-1)?.id ?? 0;

  const print = (lines: string[]): void => {
    if (lines.length === 0) return;
    try {
      out.write(`${lines.join('\n')}\n`);
    } catch {
      // A closed pipe must not crash the deck.
    }
  };

  return store.subscribe((state) => {
    const lines: string[] = [];
    for (const error of state.errors) {
      if (error.id <= lastError) continue;
      lastError = error.id;
      lines.push(...formatError(error, width));
    }
    for (const event of state.events) {
      if (event.id <= lastEvent) continue;
      lastEvent = event.id;
      // Errors already printed in full above.
      if (event.kind === 'error') continue;
      lines.push(formatEvent(event, width));
    }
    for (const call of state.calls) {
      if (call.id <= lastCall) continue;
      lastCall = call.id;
      const line = formatCall(call, width);
      if (line) lines.push(line);
    }
    print(lines);
  });
}
