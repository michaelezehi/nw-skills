import type { LineParser, Signal } from '../types.ts';
import { blockFull, errorSignal, toMs } from './block.ts';

/** `10:31:02 AM [vite] (client) `: the clock, the tag and the environment are all optional. */
const PREFIX_RE = /^(?:\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\s+)?\[vite\]\s*(?:\((?:client|ssr)\)\s*)?/i;
const BANNER_RE = /^VITE\s+v(\S+)\s+ready in\s+([\d.]+)\s*(ms|s)\b/;
const LOCAL_RE = /^(?:➜\s*)?Local:\s+https?:\/\/[^\s/]+:(\d{2,5})\b/;
const ARROW_RE = /^➜/;
const HMR_RE = /^hmr update\s+(\S.*)$/;
const PAGE_RELOAD_RE = /^page reload\s+(\S+)/;
/** Vite's sparkle (U+2728) before dependency news, escaped so the source holds no emoji. */
const SPARKLE_RE = /^\u2728\s*(.+)$/u;
/** Vite's own error lines, then esbuild's, then a plain thrown error. */
const VITE_ERROR_RE = /^(?:Internal server error|Pre-transform error):/;
const ESBUILD_ERROR_RE = /^✘\s*\[ERROR\]/;
const THROWN_RE = /^\w*Error:/;

function unprefix(t: string): { body: string; prefixed: boolean } {
  const m = PREFIX_RE.exec(t);
  return m && m[0].length > 0 ? { body: t.slice(m[0].length).trim(), prefixed: true } : { body: t, prefixed: false };
}

export function createViteParser(): LineParser {
  let block: string[] | null = null;
  /** An empty line went by inside the block; only indented lines may carry it on. */
  let gap = false;

  const close = (): Signal[] => {
    if (!block) return [];
    const lines = block;
    block = null;
    gap = false;
    return [errorSignal(lines)];
  };

  const capped = (): Signal[] => (block && blockFull(block) ? close() : []);

  const recognise = (body: string): Signal[] | null => {
    let m = BANNER_RE.exec(body);
    if (m) {
      const ms = toMs(m[2]!, m[3]!);
      return [
        { type: 'meta', runtime: `Vite ${m[1]}`, bootMs: ms },
        { type: 'status', status: 'ready' },
        { type: 'event', kind: 'ready', text: `ready in ${m[2]}${m[3]}`, ms },
      ];
    }
    m = LOCAL_RE.exec(body);
    if (m) return [{ type: 'meta', port: Number(m[1]) }];
    if (ARROW_RE.test(body)) return [];
    m = HMR_RE.exec(body);
    // A new update supersedes the last error; a still-broken file reports a fresh one.
    if (m) return [{ type: 'reload', route: m[1]!.split(/[,\s]+/)[0] }, { type: 'recovered' }];
    m = PAGE_RELOAD_RE.exec(body);
    if (m) return [{ type: 'reload', route: m[1] }, { type: 'recovered' }];
    m = SPARKLE_RE.exec(body);
    if (m) return [{ type: 'event', kind: 'info', text: m[1]!.trim() }];
    return null;
  };

  return {
    push(line) {
      const t = line.trim();
      if (line === '' || t === '') {
        if (!block) return [];
        // A second empty line ends the block; one may sit inside an esbuild frame.
        if (gap) return close();
        if (line === '') gap = true;
        block.push('');
        return capped();
      }
      const { body, prefixed } = unprefix(t);
      const known = recognise(body);
      if (known) return [...close(), ...known];
      if (VITE_ERROR_RE.test(body) || ESBUILD_ERROR_RE.test(body) || THROWN_RE.test(body)) {
        const done = close();
        block = [body];
        return [...done, ...capped()];
      }
      if (block) {
        if (prefixed || (gap && !/^\s/.test(line))) return close();
        gap = false;
        block.push(line.trimEnd());
        return capped();
      }
      return [];
    },
    flush: close,
  };
}
