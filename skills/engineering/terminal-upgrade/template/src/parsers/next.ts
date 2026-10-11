import type { LineParser, Signal } from '../types.ts';
import { blockFull, errorSignal, toMs } from './block.ts';

const VERSION_RE = /^▲\s*Next\.js\s+(\S+)(?:\s+\((\w+)\))?/;
const LOCAL_RE = /^-\s*Local:\s+\S*?:(\d+)\b/;
const STARTING_RE = /^✓\s*Starting\.\.\./;
const READY_RE = /^✓\s*Ready in ([\d.]+)\s*(ms|s)\b/;
const COMPILING_RE = /^○\s*Compiling(?:\s+(\/\S*))?/;
const COMPILED_RE = /^✓\s*Compiled(?:\s+(\/\S*))?\s+in\s+([\d.]+)\s*(ms|s)\b/;
const REQUEST_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)\s+(\d{3})\s+in\s+([\d.]+)\s*(ms|s)\b/;
/** Next 16.0 to 16.2 put a "(compile: 900ms, render: 300ms)" breakdown on the request line. */
const REQUEST_COMPILE_RE = /\bcompile:\s*([\d.]+)\s*(ms|s)\b/;
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
  /**
   * The compile a "○ Compiling" line opened. Next 16.3 prints no line when an on-demand
   * compile ends, so the next request line is what closes it.
   */
  let compile: { route: string | undefined } | null = null;
  /** An error was emitted and nothing has cleared it since. */
  let errored = false;

  const close = (): Signal[] => {
    if (!block) return [];
    const lines = block;
    block = null;
    errored = true;
    return [errorSignal(lines)];
  };

  /** A request line ends any open compile: status, reload and recovery follow from it. */
  const afterRequest = (path: string, status: number, line: string): Signal[] => {
    const timed = REQUEST_COMPILE_RE.exec(line);
    const open = compile;
    compile = null;
    if (!open && !timed) return [];
    // An open block is closed and emitted ahead of this line's signals, so it counts as an error here.
    const failed = errored || block !== null;
    const out: Signal[] = [
      { type: 'reload', route: open ? (open.route ?? path) : path, ms: timed ? toMs(timed[1]!, timed[2]!) : undefined },
    ];
    if (failed) {
      // Still failing: hand the card back to error rather than leave it on compiling.
      if (status >= 400) return open ? [...out, { type: 'status', status: 'error' }] : out;
      errored = false;
      return [...out, { type: 'status', status: 'ready' }, { type: 'recovered' }];
    }
    if (open) out.push({ type: 'status', status: 'ready' });
    return out;
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
    if (m) {
      compile = { route: m[1] };
      return [{ type: 'status', status: 'compiling', detail: m[1] }];
    }
    m = COMPILED_RE.exec(t);
    if (m) {
      compile = null;
      errored = false;
      return [
        { type: 'reload', route: m[1], ms: toMs(m[2]!, m[3]!) },
        { type: 'status', status: 'ready' },
        { type: 'recovered' },
      ];
    }
    m = REQUEST_RE.exec(t);
    if (m) {
      const status = Number(m[3]);
      return [
        {
          type: 'event',
          kind: 'request',
          text: `${m[1]} ${m[2]}`,
          ms: toMs(m[4]!, m[5]!),
          status,
        },
        ...afterRequest(m[2]!, status, t),
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
