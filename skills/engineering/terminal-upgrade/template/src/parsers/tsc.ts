import type { LineParser, Signal } from '../types.ts';
import { blockFull, errorSignal } from './block.ts';

const START_RE = /Starting compilation in watch mode|File change detected|Starting incremental compilation/;
const FOUND_RE = /Found (\d+) errors?\b/;
const BUILD_OK_RE = /Build success in \d+\s*ms/;
const PLAIN_RE = /^(\S.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const PRETTY_RE = /^(\S.*?):(\d+):(\d+) - error (TS\d+): (.*)$/;
const GENERIC_RE = /Build failed|Build error|\[ERROR\]|^[Ee]rror\b[: ]/;
const FRAME_RE = /^\s+\S|^\d+\s|~/;

type Open = { lines: string[]; ts: { file: string; code: string; message: string } | null };

export function createTscParser(): LineParser {
  let open: Open | null = null;

  const close = (): Signal[] => {
    if (!open) return [];
    const { lines, ts } = open;
    open = null;
    if (!ts) return [errorSignal(lines)];
    return [
      {
        type: 'error',
        title: `${ts.code}: ${ts.message}`,
        body: lines,
        file: ts.file,
      },
    ];
  };

  /** Close the open block once it reaches the size cap. */
  const capped = (): Signal[] => (open && blockFull(open.lines) ? close() : []);

  const tsHeader = (t: string): Open['ts'] => {
    const m = PLAIN_RE.exec(t) ?? PRETTY_RE.exec(t);
    if (!m) return null;
    return { file: `${m[1]}:${m[2]}:${m[3]}`, code: m[4]!, message: m[5]! };
  };

  return {
    push(line) {
      const t = line.trim();
      if (t === '') return [];
      const header = tsHeader(t);
      if (header) {
        const done = close();
        open = { lines: [t], ts: header };
        return done;
      }
      const found = FOUND_RE.exec(t);
      if (found) {
        const done = close();
        if (Number(found[1]) === 0) return [...done, { type: 'status', status: 'ready' }, { type: 'recovered' }];
        return [...done, { type: 'status', status: 'error', detail: `${found[1]} ${found[1] === '1' ? 'error' : 'errors'}` }];
      }
      if (START_RE.test(t)) return [...close(), { type: 'status', status: 'compiling' }];
      if (BUILD_OK_RE.test(t)) return [...close(), { type: 'status', status: 'ready' }, { type: 'recovered' }];
      if (GENERIC_RE.test(t)) {
        if (open && !open.ts) {
          open.lines.push(line.trimEnd());
          return capped();
        }
        const done = close();
        open = { lines: [t], ts: null };
        return done;
      }
      if (open && FRAME_RE.test(line)) {
        open.lines.push(line.trimEnd());
        return capped();
      }
      return close();
    },
    flush: close,
  };
}
