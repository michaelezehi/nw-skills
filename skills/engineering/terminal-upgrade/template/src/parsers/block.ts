import type { Signal } from '../types.ts';

const FILE_RE = /([\w@./\\-]+\.(?:tsx?|jsx?|mjs|cjs|css|json|mdx?)):(\d+)(?::(\d+))?/g;
const MARKER_RE = /^[\s⨯✖✘×]+/;

/** "1.2" + "s" -> 1200, "182" + "ms" -> 182. */
export function toMs(value: string, unit: string): number {
  const n = Number.parseFloat(value);
  return Math.round(unit === 's' ? n * 1000 : n);
}

/**
 * Only the head of each line is scanned for a path. FILE_RE backtracks quadratically on a
 * long run of path characters with no extension (minified bundles), so a 20KB line used to
 * cost seconds of CPU.
 */
const SCAN_CHARS = 1000;

/** First `path:line:col` in the block, preferring one outside node_modules. */
export function extractFile(lines: readonly string[]): string | undefined {
  let fallback: string | undefined;
  for (const full of lines) {
    const line = full.length > SCAN_CHARS ? full.slice(0, SCAN_CHARS) : full;
    FILE_RE.lastIndex = 0;
    for (let m = FILE_RE.exec(line); m; m = FILE_RE.exec(line)) {
      if (!m[0].includes('node_modules')) return m[0];
      fallback ??= m[0];
    }
  }
  return fallback;
}

/** First non-empty line with any error marker glyph removed. */
export function titleOf(lines: readonly string[]): string {
  for (const line of lines) {
    const title = line.replace(MARKER_RE, '').trim();
    if (title) return title.length > 240 ? `${title.slice(0, 237)}...` : title;
  }
  return 'Error';
}

export function errorSignal(lines: readonly string[]): Signal {
  const body = [...lines];
  while (body.length > 0 && body[body.length - 1]!.trim() === '') body.pop();
  return { type: 'error', title: titleOf(body), body, file: extractFile(body) };
}

/** An open error block closes itself at this many lines or bytes, whichever comes first. */
export const MAX_BLOCK_LINES = 200;
export const MAX_BLOCK_BYTES = 64 * 1024;

/** True once a block has reached either cap and must be closed. */
export function blockFull(lines: readonly string[]): boolean {
  if (lines.length >= MAX_BLOCK_LINES) return true;
  let bytes = 0;
  for (const line of lines) {
    bytes += Buffer.byteLength(line) + 1;
    if (bytes >= MAX_BLOCK_BYTES) return true;
  }
  return false;
}
