import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { alreadyRunning } from './ipc.ts';
import { CACHE_CEILING_GB, duMb, settleJunk, sizeJunk, type JunkReport } from './junk.ts';
import { createLineSplitter } from './lines.ts';
import { stripAnsi } from './parsers/index.ts';
import { cleanupLeftovers, cwdsByPid, repoMatch } from './pidfile.ts';
import { orphanTrees, PS_ARGS, readPs, terminate, type OrphanTree, type PsRow } from './sampler.ts';
import type { CleanupConfig, CleanupMode, ServiceConfig } from './types.ts';
import { formatMb, formatMs } from './ui/format.ts';

/** The orphans of this repo found at start: how many trees, their memory, and what became of them. */
export interface OrphanSweep {
  count: number;
  memMb: number;
  outcome: 'stopped' | 'asked' | 'survived';
}

export type StartCheck = { blocked: string } | { blocked?: undefined; cleaned: number; orphans?: OrphanSweep; junk?: JunkReport };

export interface StartOptions {
  cleanup?: CleanupConfig;
  /** Whose Next dev caches are sized, and cleared over the ceiling. */
  services?: readonly ServiceConfig[];
  /** Test seam: the process table with command lines. */
  scan?: () => Promise<PsRow[]>;
  /** Test seam: the working directory of each pid. */
  cwds?: (pids: readonly number[]) => Promise<Map<number, string>>;
  /** Test seam: a directory's size in MB. */
  du?: (path: string) => Promise<number | undefined>;
}

/**
 * Runs before anything is spawned. A live devdeck in this repo blocks the start (and its
 * servers are left alone); otherwise servers a previous run left behind are killed first,
 * then the orphan trees of this repo, then a Next dev cache over the ceiling. The caches
 * are sized while the processes are dealt with.
 */
export async function prepareStart(root: string, graceMs?: number, options: StartOptions = {}): Promise<StartCheck> {
  const blocked = await alreadyRunning(root);
  if (blocked) return { blocked };
  const { cleanup = {} } = options;
  const caches = cleanup.caches ?? 'auto';
  const sizing = caches === 'off' ? undefined : sizeJunk(root, options.services ?? [], options.du ?? duMb);
  const cleaned = await cleanupLeftovers(root, graceMs);
  const orphans = await sweepOrphans(root, cleanup.orphans ?? 'auto', graceMs ?? 2000, options);
  const scan = options.scan ?? (() => readPs(PS_ARGS));
  const junk = sizing ? await settleJunk(root, await sizing, caches, cleanup.cacheCeilingGb ?? CACHE_CEILING_GB, scan, options.cwds) : undefined;
  const found = junk && junk.cleared.length + junk.kept.length + junk.convex.length > 0;
  return { cleaned, ...(orphans ? { orphans } : {}), ...(found ? { junk } : {}) };
}

/**
 * The orphan trees (see orphanTrees) that belong to this repo: a process in the tree names a
 * path in the repo on its command line or runs from inside it. One lsof call reads the
 * working directories of every tree the command lines did not settle.
 */
export async function repoOrphans(root: string, rows: PsRow[], cwds: (pids: readonly number[]) => Promise<Map<number, string>> = cwdsByPid): Promise<OrphanTree[]> {
  const repo = repoMatch(root);
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const named = (tree: OrphanTree): boolean => tree.pids.some((pid) => repo.named(byPid.get(pid)?.command ?? ''));
  const trees = orphanTrees(rows, root, new Set([process.pid]));
  const unsure = trees.filter((t) => !named(t));
  const where = unsure.length > 0 ? await cwds(unsure.flatMap((t) => t.pids)) : new Map<number, string>();
  const inside = (pid: number): boolean => {
    const cwd = where.get(pid);
    return cwd !== undefined && repo.holds(cwd);
  };
  return trees.filter((t) => named(t) || t.pids.some(inside));
}

/** Find this repo's orphan trees and, in `auto`, kill each whole tree. Undefined when there are none or the mode is `off`. */
async function sweepOrphans(root: string, mode: CleanupMode, graceMs: number, options: StartOptions): Promise<OrphanSweep | undefined> {
  if (mode === 'off') return undefined;
  const rows = await (options.scan ?? (() => readPs(PS_ARGS)))();
  const trees = await repoOrphans(root, rows, options.cwds);
  if (trees.length === 0) return undefined;
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const rssKb = trees.reduce((sum, t) => sum + t.pids.reduce((kb, pid) => kb + (byPid.get(pid)?.rss ?? 0), 0), 0);
  const found = { count: trees.length, memMb: Math.round(rssKb / 1024) };
  if (mode === 'ask') return { ...found, outcome: 'asked' };
  // Each root's group and everything ps finds under it, so a worker in its own session goes too.
  const gone = await terminate(trees.map((t) => t.root.pid), graceMs);
  return { ...found, outcome: gone ? 'stopped' : 'survived' };
}

/** How many of the setup's last lines a failure shows. */
export const SETUP_TAIL = 20;

export interface SetupResult {
  ok: boolean;
  /** The exit code; null when a signal ended it. */
  code: number | null;
  ms: number;
  /** Its last SETUP_TAIL lines of output, stdout and stderr together. */
  tail: string[];
}

/**
 * Run the deck's setup once at the repo root, the way the package manager runs a script:
 * `sh -c` with the root's node_modules/.bin first on PATH. Its output is kept, not shown,
 * so a failure can show the end of it. Never rejects.
 */
export function runSetup(root: string, command: string, env: NodeJS.ProcessEnv = process.env): Promise<SetupResult> {
  const started = Date.now();
  const tail: string[] = [];
  const keep = (lines: string[]): void => {
    for (const line of lines) tail.push(stripAnsi(line));
    if (tail.length > SETUP_TAIL) tail.splice(0, tail.length - SETUP_TAIL);
  };
  return new Promise((resolve) => {
    const path = [join(root, 'node_modules', '.bin'), env.PATH].filter(Boolean).join(delimiter);
    const child = spawn('sh', ['-c', command], { cwd: root, env: { ...env, PATH: path }, stdio: ['ignore', 'pipe', 'pipe'] });
    const splitters = [child.stdout, child.stderr].map((stream) => {
      const splitter = createLineSplitter();
      stream.setEncoding('utf8').on('data', (chunk: string) => keep(splitter.push(chunk)));
      return splitter;
    });
    let done = false;
    const finish = (code: number | null, extra?: string): void => {
      if (done) return;
      done = true;
      for (const s of splitters) keep(s.drain());
      if (extra) keep([extra]);
      resolve({ ok: code === 0, code, ms: Date.now() - started, tail });
    };
    child.on('error', (err) => finish(127, err.message));
    child.on('close', (code) => finish(code));
  });
}

export const setupText = (command: string, ms: number): string => `ran setup in ${formatMs(ms)}: ${command}`;

/** What the terminal shows when the setup fails: one line naming it, then the end of its output. */
export function setupFailure(command: string, result: SetupResult): string {
  const how = result.code === null ? 'was stopped by a signal' : `exited with code ${result.code}`;
  return [`devdeck: setup ${how} after ${formatMs(result.ms)}, so no service was started: ${command}`, ...result.tail].join('\n');
}

export const cleanedText = (n: number): string => `cleaned up ${n} ${n === 1 ? 'server' : 'servers'} left by a previous run`;

export function orphansText({ count, memMb, outcome }: OrphanSweep): string {
  const what = `${count} ${count === 1 ? 'orphan' : 'orphans'} left by an earlier run`;
  if (outcome === 'stopped') return `cleaned up ${what}, ${formatMb(memMb)} freed`;
  if (outcome === 'asked') return `found ${what} holding ${formatMb(memMb)}, left running as cleanup.orphans is ask`;
  return `found ${what} holding ${formatMb(memMb)}, and some would not stop`;
}
