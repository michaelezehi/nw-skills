/** Words for the memory hogs: the one-line hint per row and the notices after a stop. */
import type { Hog, KillResult } from '../types.ts';
import { formatAge, formatMb } from './format.ts';

const BROWSERS = /Brave|Chrome|Chromium|Safari|Firefox|^Arc$|Edge|Opera|Vivaldi|Orion|^Zen/;
const EDITORS = /Visual Studio Code|^Code$|Cursor|^Zed$|Xcode|WebStorm|IntelliJ|Windsurf/;
const COMPILERS = new Set(['next', 'next-server', 'tsc', 'tsgo', 'tsup', 'vite', 'esbuild', 'webpack', 'turbo', 'tsx']);
const TEST_RUNNERS = new Set(['vitest', 'jest', 'playwright']);

/** What to do about it, in one plain line: the full wording first, then shorter ones for narrow rows. */
export function hogHints(hog: Hog): string[] {
  if (hog.self) return ['devdeck itself'];
  if (hog.scope === 'agent') return agentHints(hog);
  if (hog.orphan) {
    return [`left behind by an earlier ${TEST_RUNNERS.has(hog.name) ? 'test run' : 'run'}, stop it`, 'left behind, stop it', 'stop it'];
  }
  if (hog.scope === 'run') {
    if (!hog.serviceId) return ['part of this run'];
    // A restart gives the memory back; only clearing touches the cache on disk.
    if (clearable(hog)) return [`restart frees memory, clearing frees the ${formatMb(hog.cacheMb!)} cache`, `clearing frees ${formatMb(hog.cacheMb!)}`, 'restart it'];
    return ['restart frees its memory', 'restart it'];
  }
  if (hog.scope === 'platform') return ['started outside devdeck, stop it if unused', 'stop it if unused'];
  if (BROWSERS.test(hog.name)) return [`browser tabs, close some in ${hog.name.replace(/ Browser$/, '')}`, 'close some tabs', 'close tabs'];
  if (EDITORS.test(hog.name)) return ['editor windows, close some', 'close some windows', 'close windows'];
  return [`quit ${hog.name} if you are not using it`, 'quit it if unused'];
}

/** An agent session: how long it has been idle, and whether to stop it. */
function agentHints(hog: Hog): string[] {
  const who = hog.title ? `${hog.title}, ` : '';
  if (hog.stale) {
    const idle = hog.idleSec !== undefined ? `idle ${formatAge(hog.idleSec)}` : `quiet, started ${formatAge(hog.ageSec)} ago`;
    return [`${who}${idle}, stop it`, `${idle}, stop it`, 'stop it'];
  }
  if (hog.idleSec !== undefined) return [`${who}last active ${formatAge(hog.idleSec)} ago`, `active ${formatAge(hog.idleSec)} ago`, 'in use'];
  return [`${who}an agent session in use`, 'in use'];
}

/** A compiler in a service whose Next dev cache is over the ceiling: its row offers Clear cache. */
export const clearable = (hog: Hog): boolean => hog.cacheMb !== undefined && hog.serviceId !== undefined && !hog.self && COMPILERS.has(hog.name);

/** The notice after Clear cache: the MB it freed, or why nothing was freed. */
export function clearNotice(hog: Hog, mb: number | undefined): { ok: boolean; text: string } {
  const id = hog.serviceId ?? hog.name;
  return mb === undefined ? { ok: false, text: `${id} had no Next cache to clear, restarted it` } : { ok: true, text: `Cleared the ${id} Next cache, ${formatMb(mb)} freed` };
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

/** The notice after one stop. An orphan tree counts the processes that went with its root: `vitest ×12`. */
export function killNotice(hog: Hog, result: KillResult): { ok: boolean; text: string } {
  const tree = hog.pids && hog.pids.length > 1 ? ` ×${hog.pids.length}` : '';
  switch (result) {
    case 'stopped':
      return { ok: true, text: `Stopped ${hog.name}${tree} (pid ${hog.pid}), ${formatMb(hog.memMb)} back` };
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

/** The notice after stopping every stale agent session. */
export function idleNotice(sessions: readonly Hog[], results: readonly KillResult[]): { ok: boolean; text: string } {
  const done = sessions.filter((_, i) => results[i] === 'stopped' || results[i] === 'gone');
  const freed = done.reduce((sum, h) => sum + h.memMb, 0);
  const noun = (n: number) => (n === 1 ? 'idle session' : 'idle sessions');
  if (done.length === sessions.length) return { ok: true, text: `Stopped ${done.length} ${noun(done.length)}, ${formatMb(freed)} back` };
  return { ok: false, text: `Stopped ${done.length} of ${sessions.length} ${noun(sessions.length)}` };
}

/** `4.1 GB held by 5 processes`. */
export function hogTotal(hogs: readonly Hog[]): string {
  const mb = hogs.reduce((sum, h) => sum + h.memMb, 0);
  const count = hogs.reduce((sum, h) => sum + (h.count ?? 1), 0);
  return `${formatMb(mb)} held by ${count} ${count === 1 ? 'process' : 'processes'}`;
}
