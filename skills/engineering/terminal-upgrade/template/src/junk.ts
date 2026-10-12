/**
 * Disk junk that dev runs pile up: each app's Next dev cache (Turbopack let one grow to
 * 20 GB) and Convex local storage. Every directory is sized with `du -sk`, all at once, at
 * start. A Next cache over the ceiling is cleared when no live process has its app open;
 * Convex storage is only reported, since a module blob in use cannot be told apart from a
 * dead one.
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync, type Dirent } from 'node:fs';
import { readdir, rename } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { classify } from './classify.ts';
import { cwdsByPid, repoMatch } from './pidfile.ts';
import type { PsRow } from './sampler.ts';
import type { CleanupMode, ServiceConfig } from './types.ts';
import { formatMb } from './ui/format.ts';

/** A Next app's dev cache, relative to its package dir. */
export const NEXT_CACHE = join('.next', 'dev', 'cache');
export const CACHE_CEILING_GB = 8;
/** Resets the HR app's local Convex backend, when the repo carries it. */
export const RESET_SCRIPT = join('scripts', 'dev', 'reset-hr-local.mjs');
/** A cleared cache is renamed with this suffix and deleted in the background. */
const TRASH = '.devdeck-old-';
/** How often a run looks at its Next dev caches again. */
export const CACHE_WATCH_MS = 5 * 60_000;
/** How far below the root the search for `.convex` reaches. */
const CONVEX_DEPTH = 4;
const SKIP = new Set(['node_modules', 'dist', 'build']);

export interface JunkDir {
  /** The service whose app it is; absent for Convex storage. */
  id?: string;
  /** What the summary calls it: the service id, or the Convex project dir. */
  label: string;
  path: string;
  mb: number;
}

export interface JunkSizes {
  next: JunkDir[];
  convex: JunkDir[];
}

/** Size of a directory in MB by `du -sk`, or undefined when it is missing or du fails. */
export function duMb(path: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    execFile('du', ['-sk', path], { timeout: 10_000 }, (err, stdout) => {
      const kb = Number(/^\s*(\d+)/.exec(String(stdout ?? ''))?.[1]);
      resolve(err || !Number.isFinite(kb) ? undefined : Math.round(kb / 1024));
    });
  });
}

const subdirs = async (dir: string): Promise<Dirent[]> => {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
};

/** Every `<dir>/.convex/local/<deployment>/convex_local_storage/modules` up to CONVEX_DEPTH below the root. */
export async function convexModuleDirs(root: string): Promise<string[]> {
  const found: string[] = [];
  const visit = async (dir: string, level: number): Promise<void> => {
    const tasks: Promise<void>[] = [];
    for (const e of await subdirs(dir)) {
      if (e.name === '.convex') tasks.push(deployments(join(dir, e.name, 'local')));
      else if (level < CONVEX_DEPTH && !SKIP.has(e.name) && !e.name.startsWith('.')) tasks.push(visit(join(dir, e.name), level + 1));
    }
    await Promise.all(tasks);
  };
  const deployments = async (local: string): Promise<void> => {
    for (const e of await subdirs(local)) {
      const modules = join(local, e.name, 'convex_local_storage', 'modules');
      if (existsSync(modules)) found.push(modules);
    }
  };
  await visit(root, 0);
  return found.sort();
}

/** Rename-then-delete leftovers of an earlier clear that did not finish, next to the cache. */
async function removeTrash(nextCache: string): Promise<void> {
  const parent = join(nextCache, '..');
  for (const e of await subdirs(parent)) if (e.name.startsWith(`cache${TRASH}`)) removeLater(join(parent, e.name));
}

/** Every service dir's Next dev cache that exists, sized, the first service per dir naming it. */
async function nextCaches(root: string, services: readonly ServiceConfig[], du: (path: string) => Promise<number | undefined>): Promise<JunkDir[]> {
  const dirs = new Map<string, string>();
  for (const s of services) if (!dirs.has(s.dir)) dirs.set(s.dir, s.id);
  const sized = await Promise.all(
    [...dirs].map(async ([dir, id]): Promise<JunkDir | undefined> => {
      const path = join(root, dir, NEXT_CACHE);
      const mb = existsSync(path) ? await du(path) : undefined;
      return mb === undefined ? undefined : { id, label: id, path, mb };
    }),
  );
  return sized.filter((d): d is JunkDir => d !== undefined);
}

/** Size every service's Next dev cache and every Convex module store, all in parallel. */
export async function sizeJunk(root: string, services: readonly ServiceConfig[], du = duMb): Promise<JunkSizes> {
  for (const s of services) void removeTrash(join(root, s.dir, NEXT_CACHE));
  const next = nextCaches(root, services, du);
  const convex = convexModuleDirs(root).then((paths) =>
    Promise.all(
      paths.map(async (path): Promise<JunkDir | undefined> => {
        const mb = await du(path);
        // The project dir: the one holding `.convex`.
        return mb === undefined ? undefined : { label: relative(root, path.slice(0, path.lastIndexOf(`${sep}.convex${sep}`))) || '.', path, mb };
      }),
    ),
  );
  const [n, c] = await Promise.all([next, convex]);
  return { next: n, convex: c.filter((d): d is JunkDir => d !== undefined) };
}

export interface CacheWatch {
  /** Service id to MB, for each Next dev cache over the ceiling at the last look. */
  over(): Record<string, number>;
  /** That service's cache was just cleared: it is under the ceiling until the next look. */
  cleared(id: string): void;
  stop(): void;
}

/** Size each service's Next dev cache now and every `everyMs` after, for the hog panel's Clear cache. */
export function watchCaches(root: string, services: readonly ServiceConfig[], ceilingGb: number, everyMs = CACHE_WATCH_MS, du = duMb): CacheWatch {
  let over: Record<string, number> = {};
  let stopped = false;
  const look = async (): Promise<void> => {
    const next = await nextCaches(root, services, du);
    if (!stopped) over = Object.fromEntries(next.filter((d) => d.mb > ceilingGb * 1024).map((d) => [d.id!, d.mb]));
  };
  void look();
  const timer = setInterval(() => void look(), everyMs);
  timer.unref();
  return {
    over: () => over,
    cleared(id) {
      over = Object.fromEntries(Object.entries(over).filter(([key]) => key !== id));
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

const removeLater = (path: string): void => {
  // Detached, so a 20 GB delete never holds up the start or devdeck's own exit.
  const rm = spawn('rm', ['-rf', path], { detached: true, stdio: 'ignore' });
  rm.on('error', () => undefined);
  rm.unref();
};

/**
 * Clear a cache directory at once: rename it aside, so the next compile starts empty, and
 * delete the renamed copy in the background. False when there was nothing to rename.
 */
export async function clearCache(path: string): Promise<boolean> {
  const old = `${path}${TRASH}${Date.now()}`;
  try {
    await rename(path, old);
  } catch {
    return false;
  }
  removeLater(old);
  return true;
}

/**
 * The app dirs, of those given, that a live dev tool outside devdeck runs in or names on its
 * command line: their `.next` is open, so their cache stays. One lsof call for the cwds.
 */
export async function openApps(root: string, appDirs: readonly string[], rows: PsRow[], cwds = cwdsByPid): Promise<Set<string>> {
  const tools = rows.filter((r) => r.pid !== process.pid && r.pid > 1 && classify(r.command ?? '', root).platform);
  const where = tools.length > 0 && appDirs.length > 0 ? await cwds(tools.map((r) => r.pid)) : new Map<number, string>();
  const open = new Set<string>();
  for (const dir of appDirs) {
    const app = repoMatch(dir);
    if (tools.some((r) => app.named(r.command ?? '') || app.holds(where.get(r.pid) ?? ''))) open.add(dir);
  }
  return open;
}

/** What the start did about the junk. */
export interface JunkReport {
  cleared: JunkDir[];
  /** Over the ceiling and left in place: `asked` by the mode, `open` because a process has the app open. */
  kept: Array<JunkDir & { why: 'asked' | 'open' }>;
  /** Convex stores over the ceiling, reported only. */
  convex: JunkDir[];
  ceilingGb: number;
  /** RESET_SCRIPT, when the repo carries it. */
  resetScript?: string;
}

/**
 * Settle the sized junk against the ceiling. In `auto`, each Next cache over it is cleared
 * unless a live process has its app open; in `ask` it is only reported. Convex storage over
 * it is always only reported.
 */
export async function settleJunk(root: string, sizes: JunkSizes, mode: CleanupMode, ceilingGb: number, scan: () => Promise<PsRow[]>, cwds = cwdsByPid): Promise<JunkReport> {
  const ceilingMb = ceilingGb * 1024;
  const over = sizes.next.filter((d) => d.mb > ceilingMb);
  const report: JunkReport = { cleared: [], kept: [], convex: sizes.convex.filter((d) => d.mb > ceilingMb), ceilingGb, ...(existsSync(join(root, RESET_SCRIPT)) ? { resetScript: RESET_SCRIPT } : {}) };
  if (mode === 'ask') report.kept.push(...over.map((d) => ({ ...d, why: 'asked' as const })));
  else if (mode === 'auto' && over.length > 0) {
    const appOf = (d: JunkDir): string => join(d.path, '..', '..', '..');
    const open = await openApps(root, over.map(appOf), await scan(), cwds);
    for (const d of over) {
      if (open.has(appOf(d))) report.kept.push({ ...d, why: 'open' });
      else if (await clearCache(d.path)) report.cleared.push(d);
    }
  }
  return report;
}

/** `a`, `a and b`, `a, b and c`. */
const listed = (items: string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const sized = (dirs: readonly JunkDir[]): string => listed(dirs.map((d) => `${d.label} (${formatMb(d.mb)})`));

/** One feed line per outcome, in the style of cleanedText; none when nothing was over the ceiling. */
export function junkLines(report: JunkReport): string[] {
  const lines: string[] = [];
  const caches = (n: number) => (n === 1 ? 'the Next dev cache' : 'the Next dev caches');
  if (report.cleared.length > 0) {
    lines.push(`cleared ${caches(report.cleared.length)} of ${sized(report.cleared)}, ${formatMb(report.cleared.reduce((sum, d) => sum + d.mb, 0))} freed`);
  }
  const asked = report.kept.filter((d) => d.why === 'asked');
  if (asked.length > 0) lines.push(`${caches(asked.length)} of ${sized(asked)} ${asked.length === 1 ? 'is' : 'are'} over the ${report.ceilingGb} GB ceiling, left as cleanup.caches is ask`);
  const open = report.kept.filter((d) => d.why === 'open');
  if (open.length > 0) lines.push(`kept ${caches(open.length)} of ${sized(open)}, a process outside devdeck has ${open.length === 1 ? 'that app' : 'those apps'} open`);
  if (report.convex.length > 0) {
    const where = listed(report.convex.map((d) => `${formatMb(d.mb)} in ${d.label}`));
    lines.push(`Convex local storage holds ${where}, over the ${report.ceilingGb} GB ceiling${report.resetScript ? `, node ${report.resetScript} resets it` : ''}`);
  }
  return lines;
}
