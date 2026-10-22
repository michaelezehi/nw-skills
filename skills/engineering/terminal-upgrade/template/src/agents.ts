/**
 * AI coding sessions on the machine: Claude Code, Codex, Gemini, Cursor's agent, OpenCode,
 * Aider. Each session is one row, summed over its whole tree (its MCP servers and shells
 * go with it), with how long it has been idle. A Claude session started with
 * `--session-id` reads its idle time from its transcript's last write; any other session
 * counts as idle only when it is quiet and older than the limit. A session past the limit
 * is stale. The deck lists them in the AGENT SESSIONS panel, stale ones first.
 */
import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PsRow } from './sampler.ts';
import type { Hog } from './types.ts';

/** Executables that are an agent session by their own name. */
const AGENT_BINS = new Set(['claude', 'codex', 'gemini', 'cursor-agent', 'opencode', 'aider']);
/** An agent run as a script under a runtime: the package path names it. */
const AGENT_SCRIPTS: Array<[RegExp, string]> = [
  [/@anthropic-ai\/claude-code\//, 'claude'],
  [/@openai\/codex\//, 'codex'],
  [/@google\/gemini-cli\//, 'gemini'],
  [/\/bin\/aider(?:\s|$)/, 'aider'],
];
const RUNTIMES = new Set(['node', 'bun', 'python', 'python3']);

/** Default idle limit: half a day. */
export const AGENT_IDLE_SEC = 12 * 3600;
/** Below this much cpu over its tree a session with no transcript counts as quiet. */
const QUIET_CPU = 2;

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/**
 * The agent a command line runs, or undefined. Paths may hold spaces, so each prefix up to
 * a space is a candidate executable until the first flag, or until an argument starts a
 * new absolute path: `/usr/bin/grep /x/claude` is grep.
 */
export function agentName(command: string): string | undefined {
  const head = command.split(' -')[0]!.trim();
  for (let at = head.indexOf(' '); ; at = head.indexOf(' ', at + 1)) {
    const bin = basename(at < 0 ? head : head.slice(0, at));
    if (AGENT_BINS.has(bin)) return bin;
    if (at < 0 || head[at + 1] === '/') break;
  }
  if (!RUNTIMES.has(basename(command.split(' ')[0] ?? '').replace(/\d+(?:\.\d+)?$/, ''))) return undefined;
  return AGENT_SCRIPTS.find(([re]) => re.test(command))?.[1];
}

/** The value after `flag` in a command line: `--session-id <uuid>`, `-n ch: acme`. */
function flagValue(command: string, flags: readonly string[]): string | undefined {
  for (const flag of flags) {
    const at = command.indexOf(` ${flag} `);
    if (at < 0) continue;
    const rest = command.slice(at + flag.length + 2);
    const end = rest.search(/ --?[a-zA-Z]/);
    const value = (end < 0 ? rest : rest.slice(0, end)).trim();
    if (value) return value;
  }
  return undefined;
}

/** The Claude session id a command resumes or starts. */
export const sessionId = (command: string): string | undefined => flagValue(command, ['--session-id', '--resume', '-r'])?.match(/^[0-9a-f-]{36}$/i)?.[0];

/** The session's display name, from `-n` or `--name`; a Cursor worker's `~/src/app @ host` reads as `app`. */
export function sessionTitle(command: string): string | undefined {
  const raw = flagValue(command, ['-n', '--name'])?.replace(/ @ .*$/, '').replace(/\/+$/, '');
  return raw ? basename(raw) || raw : undefined;
}

export interface AgentContext {
  /** Pids that must never be in a stoppable session: devdeck and the service roots. */
  keep: ReadonlySet<number>;
  /** Epoch ms. */
  now: number;
  /** Seconds idle before a session is stale. Default AGENT_IDLE_SEC. */
  idleAfterSec?: number;
  /** Epoch ms of the session's last transcript write, when it can be found. */
  lastActive?: (row: PsRow, name: string) => number | undefined;
}

/** Every agent session, stale ones first, then largest. A session whose tree holds a kept pid is left out. Pure. */
export function pickAgents(rows: readonly PsRow[], ctx: AgentContext): Hog[] {
  const idleAfter = ctx.idleAfterSec ?? AGENT_IDLE_SEC;
  const names = new Map<number, string>();
  for (const row of rows) {
    const name = row.command ? agentName(row.command) : undefined;
    if (name) names.set(row.pid, name);
  }
  const children = new Map<number, number[]>();
  for (const row of rows) {
    const list = children.get(row.ppid);
    if (list) list.push(row.pid);
    else children.set(row.ppid, [row.pid]);
  }
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const out: Hog[] = [];
  for (const [pid, name] of names) {
    const row = byPid.get(pid)!;
    // A wrapper's agent child belongs to the wrapper's session.
    if (names.has(row.ppid)) continue;
    const pids: number[] = [];
    const stack = [pid];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (pids.includes(next)) continue;
      pids.push(next);
      stack.push(...(children.get(next) ?? []));
    }
    if (pids.some((p) => ctx.keep.has(p))) continue;
    let rss = 0;
    let cpu = 0;
    for (const p of pids) {
      rss += byPid.get(p)?.rss ?? 0;
      cpu += byPid.get(p)?.cpu ?? 0;
    }
    const ageSec = row.ageSec ?? 0;
    const last = ctx.lastActive?.(row, name);
    const idleSec = last === undefined ? undefined : Math.max(0, Math.min(ageSec, Math.floor((ctx.now - last) / 1000)));
    const stale = idleSec !== undefined ? idleSec >= idleAfter && cpu < QUIET_CPU * 5 : ageSec >= idleAfter && cpu < QUIET_CPU;
    const title = row.command ? sessionTitle(row.command) : undefined;
    out.push({
      pid,
      ppid: row.ppid,
      name,
      command: row.command ?? '',
      memMb: Math.round(rss / 1024),
      cpu: Math.round(cpu * 10) / 10,
      ageSec,
      scope: 'agent',
      orphan: false,
      pids,
      ...(pids.length > 1 ? { count: pids.length } : {}),
      ...(idleSec !== undefined ? { idleSec } : {}),
      ...(stale ? { stale: true } : {}),
      ...(title ? { title } : {}),
    });
  }
  return out.sort((a, b) => Number(Boolean(b.stale)) - Number(Boolean(a.stale)) || b.memMb - a.memMb || a.pid - b.pid);
}

/** The pids every session holds, so the hog scan leaves them to the session rows. */
export function agentPids(agents: readonly Hog[]): Set<number> {
  const set = new Set<number>();
  for (const a of agents) for (const pid of a.pids ?? [a.pid]) set.add(pid);
  return set;
}

const CLAUDE_PROJECTS = join(homedir(), '.claude', 'projects');
/** A transcript path per session id; a miss is looked for again after a minute. */
const transcripts = new Map<string, { path?: string; at: number }>();

/** Epoch ms of a Claude session's transcript's last write, or undefined. Reads the disk; the path is cached. */
export function claudeLastActive(row: PsRow, name: string, projects = CLAUDE_PROJECTS): number | undefined {
  if (name !== 'claude' || !row.command) return undefined;
  const id = sessionId(row.command);
  if (!id) return undefined;
  let hit = transcripts.get(id);
  if (!hit || (!hit.path && Date.now() - hit.at > 60_000)) {
    let path: string | undefined;
    try {
      for (const dir of readdirSync(projects)) {
        const file = join(projects, dir, `${id}.jsonl`);
        try {
          statSync(file);
          path = file;
          break;
        } catch {
          // Not in this project.
        }
      }
    } catch {
      // No projects directory.
    }
    hit = { path, at: Date.now() };
    transcripts.set(id, hit);
  }
  if (!hit.path) return undefined;
  try {
    return statSync(hit.path).mtimeMs;
  } catch {
    transcripts.delete(id);
    return undefined;
  }
}
