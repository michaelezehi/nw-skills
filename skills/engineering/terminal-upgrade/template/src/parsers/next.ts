import type { LineParser, Signal } from '../types.ts';
import { blockFull, errorSignal, toMs } from './block.ts';

const VERSION_RE = /^▲\s*Next\.js\s+(\S+)(?:\s+\((\w+)\))?/;
const LOCAL_RE = /^-\s*Local:\s+\S*?:(\d+)\b/;
const STARTING_RE = /^✓\s*Starting\.\.\./;
const READY_RE = /^✓\s*Ready in ([\d.]+)\s*(ms|s)\b/;
const COMPILING_RE = /^○\s*Compiling(?:\s+(\/\S*))?/;
const COMPILED_RE = /^✓\s*Compiled(?:\s+(\/\S*))?\s+in\s+([\d.]+)\s*(ms|s)\b/;
const REQUEST_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)\s+(\d{3})\s+in\s+([\d.]+)\s*(ms|s)\b/;
const WARN_RE = /^⚠\s*(.*)$/;
const OTHER_MARK_RE = /^[✓○◐◑◒◓]/;
/** Startup list header, e.g. "- Experiments (use with caution):". Its items use ⨯ for a disabled flag. */
const LIST_HEADER_RE = /^-\s*\w[\w ]*\(?[^)]*\)?:\s*$/;
const LIST_ITEM_RE = /^\s+[⨯·✓○]\s+[\w.@/-]+\s*$/;
/** A bare "⨯ flagName" is a config listing, never an error. */
const BARE_FLAG_RE = /^⨯\s+[\w.-]+$/;
const ERROR_START_RE =
  /^(?:⨯|Failed to compile|Module not found|Type error:|\w*Error:|unhandledRejection|uncaughtException)/;

export function createNextParser(): LineParser {
  let block: string[] | null = null;
  let inList = false;

  const close = (): Signal[] => {
    if (!block) return [];
    const lines = block;
    block = null;
    return [errorSignal(lines)];
  };

  /** Close the open block once it reaches the size cap. */
  const capped = (): Signal[] => (block && blockFull(block) ? close() : []);

  const recognise = (t: string): Signal[] | null => {
    let m = VERSION_RE.exec(t);
    if (m) {
      const runtime = m[2] ? `Next.js ${m[1]} · ${m[2].toLowerCase()}` : `Next.js ${m[1]}`;
      return [{ type: 'meta', runtime }];
    }
    m = LOCAL_RE.exec(t);
    if (m) return [{ type: 'meta', port: Number(m[1]) }];
    if (STARTING_RE.test(t)) return [{ type: 'status', status: 'starting' }];
    m = READY_RE.exec(t);
    if (m) {
      const ms = toMs(m[1]!, m[2]!);
      return [
        { type: 'status', status: 'ready' },
        { type: 'meta', bootMs: ms },
        { type: 'event', kind: 'ready', text: `ready in ${m[1]}${m[2]}`, ms },
      ];
    }
    m = COMPILING_RE.exec(t);
    if (m) return [{ type: 'status', status: 'compiling', detail: m[1] }];
    m = COMPILED_RE.exec(t);
    if (m) {
      return [
        { type: 'reload', route: m[1], ms: toMs(m[2]!, m[3]!) },
        { type: 'status', status: 'ready' },
        { type: 'recovered' },
      ];
    }
    m = REQUEST_RE.exec(t);
    if (m) {
      return [
        {
          type: 'event',
          kind: 'request',
          text: `${m[1]} ${m[2]}`,
          ms: toMs(m[4]!, m[5]!),
          status: Number(m[3]),
        },
      ];
    }
    m = WARN_RE.exec(t);
    if (m) return [{ type: 'event', kind: 'info', text: m[1]!.trim() }];
    if (OTHER_MARK_RE.test(t)) return [];
    return null;
  };

  return {
    push(line) {
      const t = line.trim();
      if (inList && LIST_ITEM_RE.test(line)) return [];
      inList = false;
      if (LIST_HEADER_RE.test(t)) {
        inList = true;
        return close();
      }
      if (t === '') return close();
      if (!block && BARE_FLAG_RE.test(t)) return [];
      const known = recognise(t);
      if (known) return [...close(), ...known];
      if (block) {
        if (t.startsWith('⨯')) {
          const done = close();
          block = [t];
          return [...done, ...capped()];
        }
        block.push(line.trimEnd());
        return capped();
      }
      if (ERROR_START_RE.test(t)) block = [t];
      return capped();
    },
    flush: close,
  };
}
