import { execFile, execFileSync } from 'node:child_process';
import type { DeckStore } from './store.ts';
import type { Hog, HogScope, KillResult } from './types.ts';

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
}

export const HOG_MIN_MEM_MB = 500;
export const HOG_MIN_CPU = 80;
export const HOG_MAX = 8;
/** A reparented dev process older than this is an orphan. */
export const ORPHAN_AGE_SEC = 3600;

/** Tools that run by name, from a node script path or as their own binary. */
const KNOWN_TOOLS = new Set([
  'tsc', 'tsgo', 'vitest', 'tsup', 'esbuild', 'convex', 'convex-local-backend', 'turbo', 'next', 'next-server',
  'tsx', 'vite', 'eslint', 'prettier', 'jest', 'webpack', 'remotion', 'chrome-headless-shell', 'storybook', 'playwright',
]);
/** Runtimes and tools whose processes count as platform when outside the run. */
const DEV_TOOLS = new Set([...KNOWN_TOOLS, 'node']);
/** Node flags that take the next argument as their value. */
const NODE_VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions', '-e', '--eval', '-p', '--print']);

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const stripExt = (file: string): string => file.replace(/\.(?:[cm]?js|[cm]?ts|tsx|jsx)$/, '');

/** The outermost macOS app bundle the executable sits in: `Brave Browser` for its helpers too. */
export function appName(command: string): string | undefined {
  const at = command.indexOf('.app/');
  if (at < 0 || !command.startsWith('/')) return undefined;
  const prefix = command.slice(0, at);
  // A second path or a flag before `.app/` means the bundle is an argument, not the executable.
  if (prefix.includes(' -') || prefix.includes(' /')) return undefined;
  return prefix.slice(prefix.lastIndexOf('/') + 1) || undefined;
}

/** The tool a node script path belongs to: `tsc` for typescript/lib/tsc.js, `tsup` for tsup/dist/cli. */
function toolFromScript(script: string): string {
  const path = script.replace(/^file:\/\//, '');
  const base = stripExt(basename(path));
  if (KNOWN_TOOLS.has(base)) return base;
  const bin = /\/node_modules\/\.bin\/([^/]+)$/.exec(path);
  if (bin) return bin[1]!;
  const at = path.lastIndexOf('/node_modules/');
  if (at >= 0) {
    const parts = path.slice(at + '/node_modules/'.length).split('/');
    const pkg = parts[0]!.startsWith('@') && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0]!;
    if (pkg && pkg !== '.pnpm') return pkg;
  }
  return base || 'node';
}

/** A readable name for a command line: the process title, the node script's tool, the app, the binary. */
export function hogName(command: string): string {
  const titled = /^(\S+) \(([^)]*)\)\s*$/.exec(command);
  if (titled) {
    const exe = basename(titled[1]!);
    return exe === 'node' ? (titled[2]!.trim().split(/\s+/)[0] || exe) : exe;
  }
  const app = appName(command);
  if (app) return app;
  const args = command.trim().split(/\s+/);
  const exe = basename(args[0] ?? '');
  if (exe === 'node' || /^node\d+$/.test(exe)) {
    for (let i = 1; i < args.length; i++) {
      const arg = args[i]!;
      if (arg.startsWith('-')) {
        if (NODE_VALUE_FLAGS.has(arg)) i += 1;
        continue;
      }
      return toolFromScript(arg);
    }
    return 'node';
  }
  return exe || command;
}

function isDevTool(command: string, name: string): boolean {
  const exe = basename(command.trim().split(/\s+/)[0] ?? '');
  return DEV_TOOLS.has(exe) || DEV_TOOLS.has(name) || /chrome-headless-shell|remotion/.test(command);
}

function mentionsRoot(command: string, root: string): boolean {
  return root.length > 1 && command.includes(root);
}

interface Classified {
  name: string;
  /** A dev tool or a command naming the repo root. */
  platform: boolean;
  app: string | undefined;
}

/** Past this many distinct command lines the cache starts over, so it cannot grow without end. */
const CLASSIFY_CACHE_MAX = 4096;
let classifyRoot = '';
const classifyCache = new Map<string, Classified>();

/**
 * Name, platform test and app bundle for a command line. Each is pure in the command and
 * the root, and a process keeps its command line, so a scan two seconds later reads them
 * from the cache instead of running the regexes and splits again.
 */
function classify(command: string, root: string): Classified {
  if (root !== classifyRoot || classifyCache.size >= CLASSIFY_CACHE_MAX) {
    classifyCache.clear();
    classifyRoot = root;
  }
  let hit = classifyCache.get(command);
  if (!hit) {
    const name = hogName(command);
    hit = { name, platform: mentionsRoot(command, root) || isDevTool(command, name), app: appName(command) };
    classifyCache.set(command, hit);
  }
  return hit;
}

/** Test seam: how many command lines the classification cache holds. */
export function classifiedCount(): number {
  return classifyCache.size;
}

/**
 * The processes worth knowing about, largest memory first. Scope: inside a service tree
 * or devdeck itself is `run`; a dev tool or a command naming the repo root is
 * `platform`; anything else is `system`, where one app's helpers sum into one row under
 * the app's main process. A row counts at `minMemMb` memory or `minCpu` cpu. The list
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

  const singles: Hog[] = [];
  const apps = new Map<string, PsRow[]>();
  for (const row of rows) {
    if (row.pid <= 1) continue;
    const command = row.command ?? '';
    const memMb = Math.round(row.rss / 1024);
    const cpu = Math.round(row.cpu * 10) / 10;
    const base = { pid: row.pid, ppid: row.ppid, command, memMb, cpu, ageSec: row.ageSec ?? 0, orphan: false };
    const serviceId = service.get(row.pid);
    if (serviceId !== undefined || run.has(row.pid)) {
      const self = row.pid === ctx.self;
      singles.push({ ...base, name: self ? 'devdeck' : classify(command, ctx.root).name, scope: 'run', ...(serviceId !== undefined ? { serviceId } : {}), ...(self ? { self: true } : {}) });
      continue;
    }
    const { name, platform, app } = classify(command, ctx.root);
    if (platform) {
      const orphan = row.ppid === 1 && base.ageSec > ORPHAN_AGE_SEC;
      singles.push({ ...base, name, scope: 'platform', orphan });
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

/** Same list for the screen: pid, scope, orphan and memory to the nearest 100 MB. */
export function sameHogs(a: readonly Hog[], b: readonly Hog[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((h, i) => {
    const o = b[i]!;
    return h.pid === o.pid && h.scope === o.scope && h.orphan === o.orphan && h.name === o.name && Math.round(h.memMb / 100) === Math.round(o.memMb / 100);
  });
}

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
 * SIGTERM one pid, wait up to `graceMs` for it to go, then SIGKILL and wait up to 2 s more.
 * Refuses pid 1 and below, devdeck itself and a service root, and reports EPERM, as 'denied'.
 */
export async function killPid(pid: number, guard: KillGuard, graceMs = 3000): Promise<KillResult> {
  if (!Number.isInteger(pid) || pid <= 1 || pid === guard.self || guard.roots.includes(pid)) return 'denied';
  const send = (sig: NodeJS.Signals | 0): 'ok' | 'gone' | 'denied' => {
    try {
      process.kill(pid, sig);
      return 'ok';
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === 'EPERM' ? 'denied' : 'gone';
    }
  };
  const first = send('SIGTERM');
  if (first !== 'ok') return first;
  const alive = (): boolean => send(0) === 'ok';
  const soft = Date.now() + graceMs;
  while (alive() && Date.now() < soft) await sleep(50);
  if (!alive()) return 'stopped';
  if (send('SIGKILL') === 'denied') return 'denied';
  const hard = Date.now() + 2000;
  while (alive() && Date.now() < hard) await sleep(50);
  return alive() ? 'survived' : 'stopped';
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
        state.setUsage(sumTrees(rows, current), withHogs ? pickHogs(rows, { root: state.meta.root, roots: current, self: process.pid }) : undefined);
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
