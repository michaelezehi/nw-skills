/** Text helpers. Everything here is pure and width-aware so columns line up. */

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u;
const ZERO = /[̀-ͯ​-‏️]/u;

const VS16 = '\u{fe0f}';

/**
 * Terminal cell width. Every glyph Devdeck draws is one cell; wide CJK and emoji count two,
 * and so does a narrow character followed by U+FE0F, which asks for emoji presentation.
 */
export function cellWidth(text: string): number {
  const chars = [...text];
  let width = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ZERO.test(ch)) continue;
    width += WIDE.test(ch) || chars[i + 1] === VS16 ? 2 : 1;
  }
  return width;
}

/** Characters with their trailing zero-width marks (combining marks, U+FE0F) kept attached. */
function clusters(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (ZERO.test(ch) && out.length > 0) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** Cut to `width` cells, keeping the end (good for file paths and function names). */
export function truncateStart(text: string, width: number): string {
  if (width <= 0) return '';
  if (cellWidth(text) <= width) return text;
  const parts = clusters(text);
  let out = '';
  let used = 1;
  for (let i = parts.length - 1; i >= 0; i--) {
    const w = cellWidth(parts[i]!);
    if (used + w > width) break;
    out = parts[i] + out;
    used += w;
  }
  return '…' + out;
}

/** Cut to `width` cells, keeping the start. */
export function truncateEnd(text: string, width: number): string {
  if (width <= 0) return '';
  if (cellWidth(text) <= width) return text;
  let out = '';
  let used = 1;
  for (const ch of clusters(text)) {
    const w = cellWidth(ch);
    if (used + w > width) break;
    out += ch;
    used += w;
  }
  return out + '…';
}

export function padEnd(text: string, width: number): string {
  const w = cellWidth(text);
  return w >= width ? truncateEnd(text, width) : text + ' '.repeat(width - w);
}

export function padStart(text: string, width: number): string {
  const w = cellWidth(text);
  return w >= width ? truncateStart(text, width) : ' '.repeat(width - w) + text;
}

/** 812 MB, 1.1 GB. */
export function formatMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return '0 MB';
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

/** Short memory for pills: 812M, 1.1G. */
export function formatMbShort(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return '0M';
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)}G`;
  return `${Math.round(mb)}M`;
}

/** <1ms, 182ms, 1.4s, 2m 03s. Convex reports fractional milliseconds for cached queries. */
export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** 03:45:19 for the uptime clock. */
export function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** 3h 45m, 12m, 40s: how long something has run, coarse enough not to tick. */
export function formatSpan(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** 2:43 wall clock, no seconds. */
export function formatClock(at: number): string {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 2:43:10 wall clock with seconds. */
export function formatClockSeconds(at: number): string {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** 2:43PM for the notice card. */
export function formatClockMeridiem(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
}

/** 1,204 */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** The last path segment plus `:line:col`, for tight columns. */
export function shortFile(file: string): string {
  const parts = file.split('/');
  return parts.length > 2 ? parts.slice(-2).join('/') : file;
}

/** `2d 9h`, `3h 05m`, `12m`, `40s`. */
export function formatAge(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
