import type { ConvexCall, LineParser, Signal, UdfType } from '../types.ts';
import { blockFull, errorSignal, toMs } from './block.ts';

const READY_RE = /Convex functions ready!?\s*\(([\d.]+)\s*(ms|s)\)/;
const PREPARING_RE = /Preparing Convex functions|\bBundling\b/;
const LOG_RE =
  /^\d{1,4}\/\d{1,2}\/\d{1,4},\s+\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\s+\[CONVEX\s+[A-Z]+\(([^)]*)\)\]\s*(.*)$/;
const OK_MARK_RE = /^[✔✓]/;
const ERROR_START_RE = /^(?:[✖✘]|[Ee]rror:|Unable to push)/;

export function createConvexParser(): LineParser {
  let block: string[] | null = null;

  const close = (): Signal[] => {
    if (!block) return [];
    const lines = block;
    block = null;
    return [errorSignal(lines)];
  };

  const recognise = (t: string): Signal[] | null => {
    let m = READY_RE.exec(t);
    if (m) {
      return [
        { type: 'status', status: 'ready' },
        { type: 'event', kind: 'push', text: 'functions pushed', ms: toMs(m[1]!, m[2]!) },
        { type: 'recovered' },
      ];
    }
    if (PREPARING_RE.test(t)) return [{ type: 'status', status: 'compiling' }];
    m = LOG_RE.exec(t);
    if (m) return [{ type: 'event', kind: 'info', text: `${m[1]} ${m[2]}`.trim() }];
    if (OK_MARK_RE.test(t)) return [];
    return null;
  };

  return {
    push(line) {
      const t = line.trim();
      if (t === '') return close();
      const known = recognise(t);
      if (known) return [...close(), ...known];
      if (block) block.push(line.trimEnd());
      else if (ERROR_START_RE.test(t)) block = [t];
      return block && blockFull(block) ? close() : [];
    },
    flush: close,
  };
}

const UDF_TYPES: readonly string[] = ['Query', 'Mutation', 'Action', 'HttpAction'];
/** Each call keeps at most this many log lines, each cut to LOG_LINE_MAX characters. */
export const MAX_LOG_LINES = 50;
export const LOG_LINE_MAX = 2048;

const cut = (s: string): string => (s.length > LOG_LINE_MAX ? `${s.slice(0, LOG_LINE_MAX)}…` : s);

function logLineText(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && 'messages' in entry && Array.isArray(entry.messages)) {
    return entry.messages.map(String).join(' ');
  }
  return JSON.stringify(entry);
}

/** One row of `convex logs --jsonl --success`. Timestamp and executionTime are seconds. */
export function parseConvexJsonl(line: string): Omit<ConvexCall, 'id'> | null {
  const t = line.trim();
  if (!t.startsWith('{')) return null;
  let row: Record<string, unknown>;
  try {
    row = JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (row.kind !== 'Completion') return null;
  if (typeof row.udfType !== 'string' || !UDF_TYPES.includes(row.udfType)) return null;
  if (typeof row.identifier !== 'string') return null;
  const error = row.error;
  const logLines = Array.isArray(row.logLines) ? row.logLines.slice(0, MAX_LOG_LINES).map((e) => cut(logLineText(e))) : [];
  return {
    at: typeof row.timestamp === 'number' ? Math.round(row.timestamp * 1000) : Date.now(),
    type: row.udfType as UdfType,
    fn: row.identifier,
    ms: typeof row.executionTime === 'number' ? Math.round(row.executionTime * 100000) / 100 : 0,
    ok: error == null,
    cached: row.cachedResult === true,
    caller: typeof row.caller === 'string' ? row.caller : undefined,
    error: error == null ? undefined : typeof error === 'string' ? error : JSON.stringify(error),
    logLines,
  };
}
