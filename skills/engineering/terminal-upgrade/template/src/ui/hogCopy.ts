/** Words for the memory hogs: the one-line hint per row and the notices after a stop. */
import type { Hog, KillResult } from '../types.ts';
import { formatMb } from './format.ts';

const BROWSERS = /Brave|Chrome|Chromium|Safari|Firefox|^Arc$|Edge|Opera|Vivaldi|Orion|^Zen/;
const EDITORS = /Visual Studio Code|^Code$|Cursor|^Zed$|Xcode|WebStorm|IntelliJ|Windsurf/;
const COMPILERS = new Set(['next', 'next-server', 'tsc', 'tsgo', 'tsup', 'vite', 'esbuild', 'webpack', 'turbo', 'tsx']);
const TEST_RUNNERS = new Set(['vitest', 'jest', 'playwright']);

/** What to do about it, in one plain line: the full wording first, then shorter ones for narrow rows. */
export function hogHints(hog: Hog): string[] {
  if (hog.self) return ['devdeck itself'];
  if (hog.orphan) {
    return TEST_RUNNERS.has(hog.name) ? ['orphan from an old test run, safe to stop', 'old test run, safe to stop', 'safe to stop'] : ['orphan from an old session, safe to stop', 'old session, safe to stop', 'safe to stop'];
  }
  if (hog.scope === 'run') {
    if (!hog.serviceId) return ['part of this run'];
    return COMPILERS.has(hog.name) ? ['restart frees the compiler cache', 'restart frees its cache', 'restart it'] : ['restart frees its memory', 'restart it'];
  }
  if (hog.scope === 'platform') return ['started outside devdeck, stop it if unused', 'stop it if unused'];
  if (BROWSERS.test(hog.name)) return [`browser tabs, close some in ${hog.name.replace(/ Browser$/, '')}`, 'close some tabs', 'close tabs'];
  if (EDITORS.test(hog.name)) return ['editor windows, close some', 'close some windows', 'close windows'];
  if (hog.name === 'claude') return ['a Claude Code session, end it if idle', 'end it if idle'];
  return [`quit ${hog.name} if you are not using it`, 'quit it if unused'];
}

/** The full hint. */
export const hogHint = (hog: Hog): string => hogHints(hog)[0]!;

/** Name plus the process count when an app's helpers were summed: `Brave Browser ×50`. */
export function hogLabel(hog: Hog, withCount = true): string {
  return withCount && hog.count && hog.count > 1 ? `${hog.name} ×${hog.count}` : hog.name;
}

/** The inline confirmation, longest first; the caller takes the first that fits. */
export function confirmLines(hog: Hog): string[] {
  return [`press s or click Stop again to stop ${hog.name} (pid ${hog.pid})`, `press s again to stop ${hog.name} (pid ${hog.pid})`, 'press s again to stop'];
}

/** The notice after one stop. */
export function killNotice(hog: Hog, result: KillResult): { ok: boolean; text: string } {
  switch (result) {
    case 'stopped':
      return { ok: true, text: `Stopped ${hog.name} (pid ${hog.pid}), ${formatMb(hog.memMb)} back` };
    case 'gone':
      return { ok: true, text: `${hog.name} (pid ${hog.pid}) had already exited` };
    case 'denied':
      return { ok: false, text: `Not allowed to stop ${hog.name} (pid ${hog.pid})` };
    case 'survived':
      return { ok: false, text: `${hog.name} (pid ${hog.pid}) is still running after SIGKILL` };
  }
}

/** The notice after stopping every orphan. */
export function orphansNotice(orphans: readonly Hog[], results: readonly KillResult[]): { ok: boolean; text: string } {
  const done = orphans.filter((_, i) => results[i] === 'stopped' || results[i] === 'gone');
  const freed = done.reduce((sum, h) => sum + h.memMb, 0);
  const noun = (n: number) => (n === 1 ? 'orphan' : 'orphans');
  if (done.length === orphans.length) return { ok: true, text: `Stopped ${done.length} ${noun(done.length)}, ${formatMb(freed)} back` };
  return { ok: false, text: `Stopped ${done.length} of ${orphans.length} ${noun(orphans.length)}` };
}

/** `4.1 GB held by 5 processes`. */
export function hogTotal(hogs: readonly Hog[]): string {
  const mb = hogs.reduce((sum, h) => sum + h.memMb, 0);
  const count = hogs.reduce((sum, h) => sum + (h.count ?? 1), 0);
  return `${formatMb(mb)} held by ${count} ${count === 1 ? 'process' : 'processes'}`;
}
