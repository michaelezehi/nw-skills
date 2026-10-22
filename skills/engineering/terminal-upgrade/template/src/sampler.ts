import { execFile, execFileSync } from 'node:child_process';
import { classify } from './classify.ts';
import { agentPids, claudeLastActive, pickAgents } from './agents.ts';
import type { AgentContext } from './agents.ts';
import type { DeckStore } from './store.ts';
import type { Hog, HogScope, KillResult } from './types.ts';

export { appName, classifiedCount, hogName } from './classify.ts';

export interface PsRow {
  pid: number;
  ppid: number;
  /** Resident set size in KB, as ps reports it. */
  rss: number;
  cpu: number;
  /** Seconds since start, from `etime`; absent when the table has no such column. */
  ageSec?: number;
  /** The full command line, from `command`; absent when the table has no such column. */
  command?: string;
}

export interface Usage {
  memMb: number;
  cpu: number;
}

/** The hog scan: tree, memory, cpu, age and the full command (last, it holds spaces). */
export const PS_ARGS = ['-A', '-ww', '-o', 'pid=,ppid=,rss=,%cpu=,etime=,command='];
/** The tree alone, enough for the services' memory and cpu and for the exit handler. About half the ps time and an eighth of the bytes. */
export const PS_TREE_ARGS = ['-A', '-o', 'pid=,ppid=,rss=,%cpu='];

const ETIME = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/;

/** `[[dd-]hh:]mm:ss` to seconds; undefined when it is not an elapsed time. */
export function parseEtime(text: string): number | undefined {
  const m = ETIME.exec(text);
  if (!m) return undefined;
  const [, d, h, min, sec] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min) * 60 + Number(sec);
}

const PS_LINE = /^\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+)(?:\s+(.*?))?)?\s*$/;

/**
 * Parse `ps` output with the PS_ARGS or PS_TREE_ARGS columns. Malformed rows are skipped;
 * a row without the elapsed time and command columns keeps the first four.
 */
export function parsePs(text: string): PsRow[] {
  const rows: PsRow[] = [];
  for (const line of text.split('\n')) {
    const m = PS_LINE.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    const ppid = Number(m[2]);
    const rss = Number(m[3]);
    const cpu = Number(m[4]?.replace(',', '.'));
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) continue;
    const row: PsRow = { pid, ppid, rss: Number.isFinite(rss) ? rss : 0, cpu: Number.isFinite(cpu) ? cpu : 0 };
    const age = m[5] === undefined ? undefined : parseEtime(m[5]);
    if (age !== undefined) {
      row.ageSec = age;
      row.command = m[6] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function childrenMap(rows: PsRow[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.ppid);
    if (list) list.push(row.pid);
    else map.set(row.ppid, [row.pid]);
  }
  return map;
}

function walk(root: number, children: Map<number, number[]>): number[] {
  const seen = new Set<number>();
  const stack = [root];
  while (stack.length > 0) {
    const pid = stack.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    for (const child of children.get(pid) ?? []) stack.push(child);
  }
  return [...seen];
}

/** Every pid in the tree rooted at `root`, root included, if the root appears in the table. */
export function descendants(rows: PsRow[], root: number): number[] {
  if (!rows.some((r) => r.pid === root)) return [];
  return walk(root, childrenMap(rows));
}

/** Sum rss (KB to MB) and %cpu over each service's process tree. Pure. */
export function sumTrees(rows: PsRow[], roots: Record<string, number>): Record<string, Usage> {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const children = childrenMap(rows);
  const out: Record<string, Usage> = {};
  for (const [id, root] of Object.entries(roots)) {
    if (!byPid.has(root)) {
      out[id] = { memMb: 0, cpu: 0 };
      continue;
    }
    let rssKb = 0;
    let cpu = 0;
    for (const pid of walk(root, children)) {
      const row = byPid.get(pid);
      if (!row) continue;
      rssKb += row.rss;
      cpu += row.cpu;
    }
    out[id] = { memMb: Math.round(rssKb / 1024), cpu: Math.round(cpu * 10) / 10 };
  }
  return out;
}

export interface HogContext {
  /** Repo root: a command line naming it is platform, not system. */
  root: string;
  /** Service id to its root pid, as the sampler gets them. */
  roots: Record<string, number>;
  /** Devdeck's own pid. */
  self: number;
  /** Default 500 MB. */
  minMemMb?: number;
  /** Default 80%. */
  minCpu?: number;
  /** Default 8. */
  max?: number;
  /** Service id to its Next dev cache in MB, for each cache over the ceiling. */
  caches?: Record<string, number>;
  /** Pids left out of the scan: the agent sessions, which get their own rows. */
  skip?: ReadonlySet<number>;
}

export const HOG_MIN_MEM_MB = 500;
export const HOG_MIN_CPU = 80;
export const HOG_MAX = 8;
/** A reparented dev process older than this is an orphan. */
export const ORPHAN_AGE_SEC = 3600;

export interface OrphanTree {
  /** The reparented dev tool at the top. */
  root: PsRow;
  /** Every pid in the tree, the root first. */
  pids: number[];
}

/**
 * Trees an earlier run left behind. Each root is a platform dev tool reparented to launchd
 * (ppid 1) and alive for over ORPHAN_AGE_SEC; everything under it, workers included, is
 * part of its tree. A tree holding any pid in `keep` (devdeck, a service) is never one. Pure.
 */
export function orphanTrees(rows: PsRow[], root: string, keep: ReadonlySet<number> = new Set(), children = childrenMap(rows)): OrphanTree[] {
  const trees: OrphanTree[] = [];
  for (const row of rows) {
    if (row.ppid !== 1 || row.pid <= 1 || (row.ageSec ?? 0) <= ORPHAN_AGE_SEC || keep.has(row.pid)) continue;
    if (!classify(row.command ?? '', root).platform) continue;
    const pids = walk(row.pid, children);
    if (!pids.some((pid) => keep.has(pid))) trees.push({ root: row, pids });
  }
  return trees;
}

/**
 * The processes worth knowing about, largest memory first. Scope: inside a service tree
 * or devdeck itself is `run`; a dev tool or a command naming the repo root is
 * `platform`; anything else is `system`, where one app's helpers sum into one row under
 * the app's main process. An orphan tree sums into one platform row under its root that
 * carries every pid in it. A row counts at `minMemMb` memory or `minCpu` cpu. The list
 * stops at `max`, but keeps the largest of every scope that has one. Pure.
 */
export function pickHogs(rows: PsRow[], ctx: HogContext): Hog[] {
  const minMem = ctx.minMemMb ?? HOG_MIN_MEM_MB;
  const minCpu = ctx.minCpu ?? HOG_MIN_CPU;
  const max = ctx.max ?? HOG_MAX;
  const children = childrenMap(rows);
  const present = new Set<number>();
  for (const row of rows) present.add(row.pid);
  const service = new Map<number, string>();
  for (const [id, root] of Object.entries(ctx.roots)) {
    if (!present.has(root)) continue;
    for (const pid of walk(root, children)) if (!service.has(pid)) service.set(pid, id);
  }
  const run = new Set<number>(walk(ctx.self, children));
  const trees = orphanTrees(rows, ctx.root, new Set([...service.keys(), ...run]), children);
  const orphaned = new Set<number>();
  for (const tree of trees) for (const pid of tree.pids) orphaned.add(pid);

  const singles: Hog[] = [];
  const apps = new Map<string, PsRow[]>();
  for (const row of rows) {
    if (row.pid <= 1 || orphaned.has(row.pid) || ctx.skip?.has(row.pid)) continue;
    const command = row.command ?? '';
    const memMb = Math.round(row.rss / 1024);
    const cpu = Math.round(row.cpu * 10) / 10;
    const base = { pid: row.pid, ppid: row.ppid, command, memMb, cpu, ageSec: row.ageSec ?? 0, orphan: false };
    const serviceId = service.get(row.pid);
    if (serviceId !== undefined || run.has(row.pid)) {
      const self = row.pid === ctx.self;
      const cacheMb = serviceId !== undefined ? ctx.caches?.[serviceId] : undefined;
      singles.push({ ...base, name: self ? 'devdeck' : classify(command, ctx.root).name, scope: 'run', ...(serviceId !== undefined ? { serviceId } : {}), ...(cacheMb !== undefined ? { cacheMb } : {}), ...(self ? { self: true } : {}) });
      continue;
    }
    const { name, platform, app } = classify(command, ctx.root);
    if (platform) {
      singles.push({ ...base, name, scope: 'platform' });
      continue;
    }
    if (app) {
      const list = apps.get(app);
      if (list) list.push(row);
      else apps.set(app, [row]);
      continue;
    }
    singles.push({ ...base, name, scope: 'system' });
  }

  for (const [app, members] of apps) {
    const pids = new Set(members.map((m) => m.pid));
    // The main process: a member whose parent is outside the app, the largest such one.
    const tops = members.filter((m) => !pids.has(m.ppid));
    const main = (tops.length > 0 ? tops : members).reduce((a, b) => (b.rss > a.rss ? b : a));
    const rss = members.reduce((sum, m) => sum + m.rss, 0);
    const cpu = members.reduce((sum, m) => sum + m.cpu, 0);
    singles.push({
      pid: main.pid,
      ppid: main.ppid,
      name: app,
      command: main.command ?? '',
      memMb: Math.round(rss / 1024),
      cpu: Math.round(cpu * 10) / 10,
      ageSec: main.ageSec ?? 0,
      scope: 'system',
      orphan: false,
      ...(members.length > 1 ? { count: members.length } : {}),
    });
  }

  const byPid = new Map(rows.map((r) => [r.pid, r]));
  for (const { root, pids } of trees) {
    let rss = 0;
    let cpu = 0;
    for (const pid of pids) {
      rss += byPid.get(pid)?.rss ?? 0;
      cpu += byPid.get(pid)?.cpu ?? 0;
    }
    singles.push({
      pid: root.pid,
      ppid: root.ppid,
      name: classify(root.command ?? '', ctx.root).name,
      command: root.command ?? '',
      memMb: Math.round(rss / 1024),
      cpu: Math.round(cpu * 10) / 10,
      ageSec: root.ageSec ?? 0,
      scope: 'platform',
      orphan: true,
      pids,
      ...(pids.length > 1 ? { count: pids.length } : {}),
    });
  }

  const heavy = singles.filter((h) => h.memMb >= minMem || h.cpu >= minCpu).sort((a, b) => b.memMb - a.memMb || b.cpu - a.cpu || a.pid - b.pid);
  if (heavy.length <= max) return heavy;
  const keep = new Set<Hog>();
  for (const scope of ['run', 'platform', 'system'] as HogScope[]) {
    const top = heavy.find((h) => h.scope === scope);
    if (top) keep.add(top);
  }
  for (const h of heavy) {
    if (keep.size >= max) break;
    keep.add(h);
  }
  return heavy.filter((h) => keep.has(h));
}

/** Same list for the screen: pid, scope, orphan, process count, and memory and cache size to the nearest 100 MB. */
export function sameHogs(a: readonly Hog[], b: readonly Hog[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((h, i) => {
    const o = b[i]!;
    return h.pid === o.pid && h.scope === o.scope && h.orphan === o.orphan && h.count === o.count && h.name === o.name && Math.round(h.memMb / 100) === Math.round(o.memMb / 100) && sameCache(h.cacheMb, o.cacheMb) && h.stale === o.stale && minutes(h.idleSec) === minutes(o.idleSec);
  });
}

const minutes = (sec: number | undefined): number | undefined => (sec === undefined ? undefined : Math.floor(sec / 60));
const sameCache = (a: number | undefined, b: number | undefined): boolean => (a === undefined ? b === undefined : b !== undefined && Math.round(a / 100) === Math.round(b / 100));

/** One `ps` call, no shell. Resolves to an empty table when ps fails. */
export function readPs(args: readonly string[] = PS_ARGS): Promise<PsRow[]> {
  return new Promise((resolve) => {
    execFile('ps', [...args], { timeout: 5000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? [] : parsePs(stdout));
    });
  });
}

// Process-tree termination, shared by the supervisor and the convex feed.

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface TreeRow {
  pid: number;
  ppid: number;
  pgid: number;
}

/** `ps -A -o pid=,ppid=,pgid=`, or an empty table when ps fails. */
function readGroupTable(): Promise<TreeRow[]> {
  return new Promise((resolve) => {
    execFile('ps', ['-A', '-o', 'pid=,ppid=,pgid='], { timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve([]);
      const rows: TreeRow[] = [];
      for (const line of stdout.split('\n')) {
        const [pid, ppid, pgid] = line.trim().split(/\s+/).map(Number);
        if (Number.isInteger(pid) && Number.isInteger(ppid) && Number.isInteger(pgid)) rows.push({ pid: pid!, ppid: ppid!, pgid: pgid! });
      }
      resolve(rows);
    });
  });
}

/** Every pid in the given groups plus everything below any of them, even in another session. */
export function groupDescendants(rows: TreeRow[], pgids: number[]): number[] {
  const groups = new Set(pgids);
  const children = new Map<number, number[]>();
  for (const r of rows) {
    const list = children.get(r.ppid);
    if (list) list.push(r.pid);
    else children.set(r.ppid, [r.pid]);
  }
  const seen = new Set<number>();
  const stack = rows.filter((r) => groups.has(r.pgid) || groups.has(r.pid)).map((r) => r.pid);
  while (stack.length > 0) {
    const pid = stack.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    for (const c of children.get(pid) ?? []) stack.push(c);
  }
  return [...seen];
}

/** Signal a pid, or a whole group when given a negative pgid. False when nothing is there. */
function signal(target: number, sig: NodeJS.Signals | 0): boolean {
  try {
    process.kill(target, sig);
    return true;
  } catch {
    return false;
  }
}
const signalGroup = (pgid: number, sig: NodeJS.Signals | 0): boolean => signal(-pgid, sig);
const signalPid = signal;

/**
 * SIGTERM each group at once, then every descendant ps still finds under it (which catches
 * anything that moved to its own session), wait up to `graceMs`, SIGKILL survivors.
 * Resolves true once nothing is left, false if something survived 2s past the SIGKILL.
 */
export async function terminate(pgids: number[], graceMs: number): Promise<boolean> {
  if (pgids.length === 0) return true;
  // ps forks before the signal lands, but nothing waits on it: a slow ps never delays quit.
  const table = readGroupTable();
  for (const g of pgids) signalGroup(g, 'SIGTERM');
  const extra = new Set(groupDescendants(await table, pgids));
  const alive = (): boolean => pgids.some((g) => signalGroup(g, 0)) || [...extra].some((p) => signalPid(p, 0));
  const hit = (sig: NodeJS.Signals): void => {
    for (const g of pgids) signalGroup(g, sig);
    for (const p of extra) signalPid(p, sig);
  };

  for (const p of extra) signalPid(p, 'SIGTERM');
  const soft = Date.now() + graceMs;
  while (alive() && Date.now() < soft) await sleep(50);
  if (!alive()) return true;
  hit('SIGKILL');
  const hard = Date.now() + 2000;
  while (alive() && Date.now() < hard) await sleep(50);
  return !alive();
}

/** Synchronous SIGKILL for the process 'exit' handler. Never throws. */
export function killSync(pgids: number[]): void {
  let rows: PsRow[];
  try {
    rows = parsePs(execFileSync('ps', PS_TREE_ARGS, { encoding: 'utf8', timeout: 2000, maxBuffer: 8 * 1024 * 1024 }));
  } catch {
    rows = []; // Without ps, the group kill below still runs.
  }
  for (const pgid of pgids) {
    for (const pid of descendants(rows, pgid)) signalPid(pid, 'SIGKILL');
    signalGroup(pgid, 'SIGKILL');
  }
}

export interface KillGuard {
  /** Devdeck's own pid. */
  self: number;
  /** Service root pids; those restart instead. */
  roots: readonly number[];
}

/**
 * SIGTERM every pid, wait up to `graceMs` for them to go, then SIGKILL the rest and wait up
 * to 2 s more. Refuses the lot when any is pid 1 or below, devdeck itself or a service root,
 * and reports EPERM, as 'denied'; 'gone' when none was running.
 */
export async function killPids(pids: readonly number[], guard: KillGuard, graceMs = 3000): Promise<KillResult> {
  if (pids.length === 0 || pids.some((pid) => !Number.isInteger(pid) || pid <= 1 || pid === guard.self || guard.roots.includes(pid))) return 'denied';
  const send = (pid: number, sig: NodeJS.Signals | 0): 'ok' | 'gone' | 'denied' => {
    try {
      process.kill(pid, sig);
      return 'ok';
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === 'EPERM' ? 'denied' : 'gone';
    }
  };
  const first = pids.map((pid) => send(pid, 'SIGTERM'));
  const denied = first.includes('denied');
  let live = pids.filter((_, i) => first[i] === 'ok');
  if (live.length === 0) return denied ? 'denied' : 'gone';
  const prune = (): boolean => (live = live.filter((pid) => send(pid, 0) === 'ok')).length > 0;
  const soft = Date.now() + graceMs;
  while (prune() && Date.now() < soft) await sleep(50);
  if (!prune()) return denied ? 'denied' : 'stopped';
  if (live.map((pid) => send(pid, 'SIGKILL')).includes('denied')) return 'denied';
  const hard = Date.now() + 2000;
  while (prune() && Date.now() < hard) await sleep(50);
  return prune() ? 'survived' : denied ? 'denied' : 'stopped';
}

/** killPids for one pid. */
export const killPid = (pid: number, guard: KillGuard, graceMs = 3000): Promise<KillResult> => killPids([pid], guard, graceMs);

/**
 * An orphan tree as it stands now, for its Stop: the root and everything under it while
 * the root lives, which takes in workers started since the scan; else the listed pids
 * still running.
 */
export async function currentTree(root: number, listed: readonly number[]): Promise<number[]> {
  const rows = await readPs(PS_TREE_ARGS);
  if (rows.length === 0) return [...listed];
  const live = descendants(rows, root);
  if (live.length > 0) return live;
  const present = new Set(rows.map((r) => r.pid));
  return listed.filter((pid) => present.has(pid));
}

/** The hogs and the agent sessions from one scan with command lines; a session's processes are never also a hog. */
function scanHogs(rows: PsRow[], root: string, roots: Record<string, number>, options: SamplerOptions): { hogs: Hog[]; agents: Hog[] } {
  const keep = new Set([process.pid, ...Object.values(roots)]);
  const agents = pickAgents(rows, { keep, now: Date.now(), idleAfterSec: options.agentIdleSec, lastActive: options.lastActive ?? claudeLastActive });
  return { hogs: pickHogs(rows, { root, roots, self: process.pid, caches: options.caches?.(), skip: agentPids(agents) }), agents };
}

export interface Sampler {
  stop(): void;
}

/** Every this many ticks the scan carries the command lines and the hogs are picked again: 6 s at the default interval. */
export const HOG_EVERY = 3;

export interface SamplerOptions {
  /** Default 2000. */
  intervalMs?: number;
  /** Default HOG_EVERY. */
  hogEvery?: number;
  /** Test seam: the table for one tick, with the command column or the tree alone. */
  scan?: (withCommands: boolean) => Promise<PsRow[]>;
  /** The Next dev caches over the ceiling, by service id, in MB. */
  caches?: () => Record<string, number>;
  /** Seconds an AI session sits idle before it is stale. Default AGENT_IDLE_SEC. */
  agentIdleSec?: number;
  /** Test seam: a session's last activity, epoch ms. Default reads Claude transcripts. */
  lastActive?: AgentContext['lastActive'];
}

/**
 * Every `intervalMs`, sample memory and cpu for the pids `roots()` returns from the
 * process tree alone; every `hogEvery` ticks, the first included, read the command lines
 * too and pick the hogs from them.
 */
export function startSampler(store: DeckStore, roots: () => Record<string, number>, options: SamplerOptions = {}): Sampler {
  const intervalMs = options.intervalMs ?? 2000;
  const hogEvery = Math.max(1, options.hogEvery ?? HOG_EVERY);
  const scan = options.scan ?? ((withCommands: boolean) => readPs(withCommands ? PS_ARGS : PS_TREE_ARGS));
  let busy = false;
  let stopped = false;
  let ticks = 0;

  const tick = async (): Promise<void> => {
    if (busy || stopped) return;
    const current = roots();
    if (Object.keys(current).length === 0) return;
    busy = true;
    const withHogs = ticks % hogEvery === 0;
    ticks += 1;
    try {
      const rows = await scan(withHogs);
      if (!stopped && rows.length > 0) {
        const state = store.getState();
        const scanned = withHogs ? scanHogs(rows, state.meta.root, current, options) : undefined;
        state.setUsage(sumTrees(rows, current), scanned?.hogs, scanned?.agents);
      }
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
