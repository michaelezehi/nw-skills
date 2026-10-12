import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { terminate } from './sampler.ts';

/** One spawned service group, as written to `.devdeck/pids.json`. */
export interface GroupRecord {
  id: string;
  pgid: number;
  dir: string;
  startedAt: number;
}

export interface GroupRow {
  pid: number;
  pgid: number;
  /** Seconds since the process started. */
  age: number;
  command: string;
}

/** A live leader may have started this far from the recorded spawn time and still be ours. */
const LEADER_SLACK_MS = 15_000;

export const deckDir = (root: string): string => join(root, '.devdeck');
export const pidsPath = (root: string): string => join(deckDir(root), 'pids.json');

/** Create `.devdeck` readable by the owner only. Throws when it cannot be created. */
export function ensureDeckDir(root: string): string {
  const dir = deckDir(root);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
  } catch {
    // An existing directory we cannot chmod still works.
  }
  return dir;
}

/** Write the records atomically: a reader never sees a half-written file. Never throws. */
export function writePids(root: string, groups: GroupRecord[]): void {
  try {
    ensureDeckDir(root);
    const path = pidsPath(root);
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ groups }), { mode: 0o600 });
    renameSync(tmp, path);
  } catch {
    // Without the file the next run simply has nothing to clean up.
  }
}

export function removePids(root: string): void {
  try {
    unlinkSync(pidsPath(root));
  } catch {
    // Already gone.
  }
}

const isRecord = (g: unknown): g is GroupRecord => {
  if (!g || typeof g !== 'object') return false;
  const r = g as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.dir === 'string' && typeof r.startedAt === 'number' && Number.isInteger(r.pgid) && (r.pgid as number) > 1;
};

/** Records from `.devdeck/pids.json`; malformed entries and a missing file read as none. */
export function readPids(root: string): GroupRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(pidsPath(root), 'utf8')) as { groups?: unknown };
    return Array.isArray(parsed.groups) ? parsed.groups.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** "[[dd-]hh:]mm:ss" to seconds. */
export function parseEtime(s: string): number {
  const [days, rest] = s.includes('-') ? s.split('-', 2) : ['0', s];
  const parts = (rest ?? '').split(':').map(Number);
  while (parts.length < 3) parts.unshift(0);
  const [h, m, sec] = parts as [number, number, number];
  return Number(days) * 86400 + h * 3600 + m * 60 + sec;
}

/** Parse `ps -A -o pid=,pgid=,etime=,command=`. */
export function parseGroupRows(text: string): GroupRow[] {
  const rows: GroupRow[] = [];
  for (const line of text.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const age = parseEtime(m[3]!);
    if (!Number.isFinite(age)) continue;
    rows.push({ pid: Number(m[1]), pgid: Number(m[2]), age, command: m[4]! });
  }
  return rows;
}

const run = (cmd: string, args: string[]): Promise<string> =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (_err, stdout) => resolve(String(stdout ?? '')));
  });

/** Working directory of each pid: /proc on Linux, one lsof call for the rest. Unknown pids are left out. */
export async function cwdsByPid(pids: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const rest: number[] = [];
  for (const pid of pids) {
    try {
      out.set(pid, readlinkSync(`/proc/${pid}/cwd`));
    } catch {
      rest.push(pid);
    }
  }
  if (rest.length > 0) {
    // `p<pid>` opens each process's lines and `n<path>` is its cwd.
    const text = await run('lsof', ['-a', '-d', 'cwd', '-Fn', '-p', rest.join(',')]);
    let pid = 0;
    for (const line of text.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      else if (line.startsWith('n') && pid > 0) out.set(pid, line.slice(1));
    }
  }
  return out;
}

const rootsOf = (root: string): string[] => {
  const roots = new Set([root]);
  try {
    roots.add(realpathSync(root));
  } catch {
    // The plain path is enough.
  }
  return [...roots];
};

export interface RepoMatch {
  /** The path is the repo root or inside it. */
  holds(path: string): boolean;
  /** The command line names a path inside the repo. */
  named(command: string): boolean;
}

/** Tests against the repo root as given and as its real path, so a symlinked checkout still matches. */
export function repoMatch(root: string): RepoMatch {
  const prefixes = rootsOf(root);
  return {
    holds: (path) => prefixes.some((p) => path === p || path.startsWith(p + sep)),
    named: (command) => prefixes.some((p) => command.includes(p + sep)),
  };
}

/**
 * True only when the group proves it is a server this repo spawned: its leader (if alive)
 * started when the record says, it does not hold this process, and one of its processes
 * runs from inside the repo or names the repo path on its command line.
 */
export async function belongsToRepo(root: string, record: GroupRecord, rows: GroupRow[], now = Date.now()): Promise<boolean> {
  const members = rows.filter((r) => r.pgid === record.pgid);
  if (members.length === 0) return false;
  if (members.some((r) => r.pid === process.pid || r.pid === process.ppid)) return false;
  // A pgid is only reused once its whole group is gone, so a live leader must be the one we spawned.
  const leader = members.find((r) => r.pid === record.pgid);
  if (leader && Math.abs(now - leader.age * 1000 - record.startedAt) > LEADER_SLACK_MS) return false;

  const repo = repoMatch(root);
  if (members.some((r) => repo.named(r.command))) return true;
  return [...(await cwdsByPid(members.map((r) => r.pid))).values()].some(repo.holds);
}

/**
 * Kill the service groups a previous run left behind, when each proves it belongs to
 * this repo. Returns how many groups were cleaned up.
 */
export async function cleanupLeftovers(root: string, graceMs = 2000): Promise<number> {
  const records = readPids(root);
  if (records.length === 0) return 0;
  const rows = parseGroupRows(await run('ps', ['-A', '-o', 'pid=,pgid=,etime=,command=']));
  const owned = new Set<number>();
  for (const record of records) if (await belongsToRepo(root, record, rows)) owned.add(record.pgid);
  if (owned.size > 0) await terminate([...owned], graceMs);
  removePids(root);
  return owned.size;
}
