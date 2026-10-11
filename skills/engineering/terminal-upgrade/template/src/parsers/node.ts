import type { LineParser, Signal } from '../types.ts';
import { blockFull, errorSignal } from './block.ts';

// A listen line names a listen verb and then the port as a URL, a host:port, or "port N".
// Clock times ("job started at 10:30:15") match none of these.
const LISTEN_WORD = String.raw`\b(?:listening|running|started|serving|ready)\b`;
const LISTEN_RES = [
  new RegExp(String.raw`${LISTEN_WORD}.*?https?:\/\/[^\s/:]+:(\d{2,5})(?![\d:])`, 'i'),
  new RegExp(String.raw`${LISTEN_WORD}\s+(?:on|at)\s+(?:\[[^\]\s]*\]|[\w-]*[a-z.][\w.-]*)?:(\d{2,5})(?![\d:])`, 'i'),
  new RegExp(String.raw`${LISTEN_WORD}.*?\bport\s*:?\s*(\d{2,5})\b`, 'i'),
];
const listenPort = (t: string): number | undefined => {
  for (const re of LISTEN_RES) {
    const m = re.exec(t);
    if (m) return Number(m[1]);
  }
  return undefined;
};
const RESTART_RE = /^\[tsx\]\s+(?:change in|restarting)|^Restarting\b|^\[nodemon\] restarting/i;
const ERROR_START_RE = /^\w*Error:|^(?:unhandledRejection|uncaughtException)/;
const PINO_ERROR_RE = /"level":(?:50|60)\b/;
const PINO_MSG_RE = /"msg":"((?:[^"\\]|\\.)*)"/;
const CONTINUE_RE = /^\s+\S|^[}\]]/;

export function createNodeParser(): LineParser {
  let block: string[] | null = null;

  const close = (): Signal[] => {
    if (!block) return [];
    const lines = block;
    block = null;
    return [errorSignal(lines)];
  };

  return {
    push(line) {
      const t = line.trim();
      if (t === '') return close();

      const port = listenPort(t);
      if (port !== undefined && !PINO_ERROR_RE.test(t)) {
        return [
          ...close(),
          { type: 'meta', port },
          { type: 'status', status: 'ready' },
          { type: 'event', kind: 'ready', text: `listening on :${port}` },
          { type: 'recovered' },
        ];
      }
      if (RESTART_RE.test(t)) {
        return [
          ...close(),
          { type: 'status', status: 'starting', detail: 'restarting' },
          { type: 'reload' },
        ];
      }
      if (block && CONTINUE_RE.test(line)) {
        block.push(line.trimEnd());
        return blockFull(block) ? close() : [];
      }
      const done = close();
      if (PINO_ERROR_RE.test(t)) {
        const msg = PINO_MSG_RE.exec(t);
        return [...done, errorSignal([msg ? msg[1]! : t, t])];
      }
      if (ERROR_START_RE.test(t)) block = [t];
      return done;
    },
    flush: close,
  };
}
