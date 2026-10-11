/** Partial-line cap for service output: a longer line is handed on in pieces. */
export const MAX_PARTIAL = 64 * 1024;

export interface LineSplitter {
  push(chunk: string): string[];
  /** Hand back a pending partial line, if any. */
  drain(): string[];
}

/**
 * Splits on \n, \r\n and bare \r (progress redraws). Holds partial lines between chunks,
 * up to `maxPartial` characters; past that the partial is handed on as a line of its own.
 */
export function createLineSplitter(maxPartial = MAX_PARTIAL): LineSplitter {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      const out: string[] = [];
      let start = 0;
      for (let i = 0; i < buf.length; i++) {
        const c = buf.charCodeAt(i);
        if (c === 10) {
          out.push(buf.slice(start, i));
          start = i + 1;
        } else if (c === 13) {
          // A trailing \r may be the first half of \r\n: wait for the next chunk.
          if (i + 1 >= buf.length) break;
          out.push(buf.slice(start, i));
          if (buf.charCodeAt(i + 1) === 10) i++;
          start = i + 1;
        }
      }
      buf = buf.slice(start);
      if (buf.length > maxPartial) {
        out.push(buf);
        buf = '';
      }
      return out;
    },
    drain() {
      const rest = buf.replace(/\r$/, '');
      buf = '';
      return rest ? [rest] : [];
    },
  };
}

/** Cut a string to `max` characters, marking the cut with an ellipsis. */
export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
