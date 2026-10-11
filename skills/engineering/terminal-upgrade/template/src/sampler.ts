import { execFile, execFileSync } from 'node:child_process';
import type { DeckStore } from './store.ts';

export interface PsRow {
  pid: number;
  ppid: number;
  /** Resident set size in KB, as ps reports it. */
  rss: number;
  cpu: number;
}

export interface Usage {
  memMb: number;
  cpu: number;
}

export const PS_ARGS =['-A', '-o', 'pid=,ppid=,rss=,%cpu='];

/** Parse `ps -A -o pid=,ppid=,rss=,%cpu=` output. Malformed rows are skipped. */
export function parsePs(text: string): PsRow[] {
  const rows: PsRow[] = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const pid = Number(parts[0]);
    const ppid = Number(parts[1]);
    const rss = Number(parts[2]);
    const cpu = Number(parts[3]?.replace(',', '.'));
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) continue;
    rows.push({ pid, ppid, rss: Number.isFinite(rss) ? rss : 0, cpu: Number.isFinite(cpu) ? cpu : 0 });
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

/** One `ps` call, no shell. Resolves to an empty table when ps fails. */
export function readPs(): Promise<PsRow[]> {
  return new Promise((resolve) => {
    execFile('ps', PS_ARGS, { timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
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
    rows = parsePs(execFileSync('ps', PS_ARGS, { encoding: 'utf8', timeout: 2000 }));
  } catch {
    rows = []; // Without ps, the group kill below still runs.
  }
  for (const pgid of pgids) {
    for (const pid of descendants(rows, pgid)) signalPid(pid, 'SIGKILL');
    signalGroup(pgid, 'SIGKILL');
  }
}

export interface Sampler {
  stop(): void;
}

/** Every `intervalMs`, sample memory and cpu for the pids `roots()` returns. */
export function startSampler(store: DeckStore, roots: () => Record<string, number>, intervalMs = 2000): Sampler {
  let busy = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (busy || stopped) return;
    const current = roots();
    if (Object.keys(current).length === 0) return;
    busy = true;
    try {
      const rows = await readPs();
      if (!stopped && rows.length > 0) store.getState().setUsage(sumTrees(rows, current));
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
