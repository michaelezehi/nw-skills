/**
 * What a big card says, as rows of label then value, each in the fullest wording that
 * fits the card. Nothing is cut: a row that cannot fit in any of its forms is left out,
 * and when the card is short the least telling rows go first. Pure, so it is testable
 * without a terminal.
 */
import type { DevError, ServiceState } from '../types.ts';
import { MEM_HISTORY } from '../store.ts';
import type { Tone } from './theme.ts';
import { capsuleBar, capsule, sparkline } from './glyphs.ts';
import { cellWidth, formatClock, formatMb, formatMs, formatSpan, padEnd, padStart } from './format.ts';
import { displayRuntime } from './ServiceCard.tsx';
import { glyph, type StatusLook } from './sprites.ts';

export interface Segment {
  text: string;
  color: string;
  /** Wraps the text in a terminal link to this URL. */
  href?: string;
  bold?: boolean;
  dim?: boolean;
}

export interface CardLine {
  /** Lower ranks survive a short card longer. */
  rank: number;
  left: Segment[];
  /** Right aligned on the same row. */
  right?: Segment[];
  /** The status group at the top of the card; the facts follow after a gap. */
  head?: boolean;
}

export interface QuietLineInput {
  service: ServiceState;
  look: StatusLook;
  /** Largest memMb across services, for the relative bar. */
  maxMemMb: number;
  /** The newest open error for this service. */
  error?: DevError;
  now: number;
  /** Cells available on one row. */
  width: number;
  /** Verbose adds the memory trend. */
  detail: boolean;
  tone: Tone;
}

/** `memory   ` and its siblings, so every value starts in the same column. */
export const LABEL_W = 9;

export const width = (segments: readonly Segment[]): number => segments.reduce((sum, s) => sum + cellWidth(s.text), 0);

const label = (text: string, tone: Tone): Segment => ({ text: padEnd(text, LABEL_W), color: tone.muted });

/** The first of `options` that fits `room`, as one segment of `color`. */
function fit(options: readonly string[], room: number, color: string): Segment[] | undefined {
  const text = options.find((option) => cellWidth(option) <= room);
  return text === undefined ? undefined : [{ text, color }];
}

/** The glosses that explain the number, longest first. */
export const MEMORY_GLOSSES = [
  'RAM held by this server and its child processes',
  'RAM held by this server and its children',
  'RAM held by it and its children',
  'RAM held, children included',
  'RAM held right now',
  'RAM in use',
] as const;

export function reloadLabel(service: ServiceState): string {
  return service.kind === 'convex' ? 'pushes' : 'reloads';
}

function reloadOptions(service: ServiceState): string[] {
  const n = service.reloads;
  const last = service.lastReload;
  if (!last) return [String(n)];
  const at = formatClock(last.at);
  const ms = last.ms !== undefined ? formatMs(last.ms) : '';
  if (last.route) {
    return [ms ? `${n} · last ${last.route} in ${ms}` : `${n} · last ${last.route} at ${at}`, `${n} · last ${last.route}`, ms ? `${n} · last in ${ms}` : `${n} · last at ${at}`, String(n)];
  }
  return [`${n} · last at ${at}`, String(n)];
}

export function quietLines(input: QuietLineInput): CardLine[] {
  const { service, look, tone, now, width: w } = input;
  const room = w - LABEL_W;
  const lines: CardLine[] = [];
  const push = (rank: number, name: string, value: Segment[] | undefined, head = false) => {
    if (value) lines.push({ rank, left: [label(name, tone), ...value], head });
  };

  // Status and the port, as on every card.
  const port = service.port ? `:${service.port}` : '';
  const status: Segment[] = [{ text: `${look.glyph} ${look.word}`, color: look.color }];
  const showPort = port !== '' && width(status) + 1 + cellWidth(port) <= w;
  lines.push({ rank: 0, left: status, right: showPort ? [{ text: port, color: tone.muted, href: service.url ?? `http://localhost:${service.port}` }] : undefined, head: true });

  if (input.error) push(1, 'error', fit([input.error.title, 'press e to read it'], room, tone.error), true);
  if (service.status === 'compiling' && service.detail) push(1, 'now', fit([service.detail], room, tone.activity), true);
  if (service.status === 'stopped' || service.status === 'crashed') {
    push(1, 'exit', fit([`code ${service.exitCode ?? '?'}`], room, service.status === 'crashed' ? tone.error : tone.muted), true);
  }
  if (service.runtime) {
    const runtime = displayRuntime(service.runtime, room);
    push(2, 'runtime', runtime ? [{ text: runtime, color: tone.muted }] : undefined);
  }

  // The memory row: the value right aligned to `812 MB`, so bars start in one column down
  // a row of cards, then a capsule bar against the biggest service when there is room.
  const mem = padStart(formatMb(service.memMb), 6);
  const barRoom = room - cellWidth(mem) - 2 - 2;
  const memory: Segment[] = [{ text: mem, color: tone.text }];
  if (barRoom >= 6) {
    const bar = capsuleBar(input.maxMemMb > 0 ? (service.memMb / input.maxMemMb) * 100 : 0, Math.min(16, barRoom));
    memory.push(
      { text: `  ${capsule.left}`, color: tone.line },
      { text: bar.filled, color: service.memMb / Math.max(1, input.maxMemMb) > 0.85 ? tone.activity : tone.accent },
      { text: bar.empty, color: tone.line },
      { text: capsule.right, color: tone.line },
    );
  }
  push(0, 'memory', memory);
  push(2, '', fit(MEMORY_GLOSSES, room, tone.muted));

  // The trend: one cell per sample, newest at the right, up to twenty; sixty samples two
  // seconds apart is two minutes, fewer is what has been seen so far.
  const samples = service.memHistory.length;
  if (input.detail && samples > 1) {
    const gloss = `  ${samples >= MEM_HISTORY ? 'over two minutes' : 'so far'}`;
    const withGloss = Math.min(20, samples, room - cellWidth(gloss));
    const bare = Math.min(20, samples, room);
    if (withGloss >= 4) push(3, 'trend', [{ text: sparkline(service.memHistory, withGloss), color: tone.activity, dim: true }, { text: gloss, color: tone.muted }]);
    else if (bare >= 4) push(3, 'trend', [{ text: sparkline(service.memHistory, bare), color: tone.activity, dim: true }]);
  }

  const cpu = service.cpu > 0 ? `${Math.round(service.cpu)}%` : '';
  // A row with nothing to report is left out: no `idle`, `none yet` or `none`.
  if (cpu) push(1, 'cpu', fit([`${cpu} of one core right now`, `${cpu} of one core`, cpu], room, tone.text));

  if (service.startedAt) {
    const span = formatSpan(now - service.startedAt);
    const at = formatClock(service.startedAt);
    push(2, 'up', fit([`${span} · since ${at}`, `since ${at}`, span], room, tone.text));
  }
  if (service.reloads > 0) push(1, reloadLabel(service), fit(reloadOptions(service), room, tone.text));
  if (service.restarts > 0) push(3, 'restarts', fit([`${service.restarts} · ${glyph.restart} by hand or after a crash`, String(service.restarts)], room, tone.activity));

  return lines;
}

/**
 * The lines a card of `rows` content rows shows: the highest ranks go first when there are
 * too many, later ones before earlier ones at the same rank; the rest keep their order.
 */
export function fitLines(lines: CardLine[], rows: number): CardLine[] {
  const kept = lines.map((line, i) => ({ line, i }));
  while (kept.length > Math.max(0, rows)) {
    let drop = 0;
    for (let k = 1; k < kept.length; k++) if (kept[k]!.line.rank >= kept[drop]!.line.rank) drop = k;
    kept.splice(drop, 1);
  }
  return kept.map((k) => k.line);
}
