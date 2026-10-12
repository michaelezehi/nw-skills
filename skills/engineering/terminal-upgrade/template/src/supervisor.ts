import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:os';
import { join } from 'node:path';
import type { IPty } from 'node-pty';
import { devCommand } from './config.ts';
import { createLineSplitter, truncate, type LineSplitter } from './lines.ts';
import { createParser, stripAnsi } from './parsers/index.ts';
import { parseProgress, progressMoved } from './progress.ts';
import { detectPrompt, samePrompt } from './prompt.ts';
import { loadPty } from './pty.ts';
import { removePids, writePids } from './pidfile.ts';
import { killSync, terminate } from './sampler.ts';
import type { DeckStore } from './store.ts';
import type { LineParser, PackageManager, ServiceConfig, ServiceKind, Signal } from './types.ts';

export const RAW_LINES = 2000;
/** The buffer runs this far past RAW_LINES before one trim, so a line costs no shift. */
const RAW_SLACK = 500;
/** Quiet time after which a parser closes a half-read block. */
const QUIET_MS = 1000;
/** Quiet time after which a pseudo-terminal's output is read for a prompt: past a spinner frame. */
const PROMPT_QUIET_MS = 400;
/** What a scrubbed password reads as. */
export const SECRET_MASK = '••••';
const RAW_THROTTLE_MS = 100;
/** Stored raw lines are cut to this many characters. */
export const RAW_LINE_MAX = 2048;

/** Shell vars turbo's strict env mode never passed on; each app's .env.local must win. */
const STRIPPED_ENV = new Set(['PORT', 'HOST', 'HOSTNAME']);

/** The environment every child gets: the shell's, minus vars that would override app config. */
export function childEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    if (STRIPPED_ENV.has(key) || key.startsWith('CONVEX_')) continue;
    if (key === 'NODE_ENV' && value === 'production') continue;
    env[key] = value;
  }
  env.FORCE_COLOR = '0';
  env.NO_COLOR = '1';
  return env;
}

interface Proc {
  config: ServiceConfig;
  child?: ChildProcess;
  /** The pseudo-terminal, for a service that runs in one. */
  term?: IPty;
  termAlive?: boolean;
  promptTimer?: NodeJS.Timeout;
  /** Passwords typed into this service, scrubbed from every line it keeps. */
  secrets: Set<string>;
  /** Group id of the latest spawn, kept after exit so orphans can still be reaped. */
  pgid?: number;
  startedAt: number;
  parser: LineParser;
  splitters: LineSplitter[];
  /** Up to RAW_LINES + RAW_SLACK lines; readers see the newest RAW_LINES. */
  raw: string[];
  /** The newest RAW_LINES as last read, dropped on every new line. */
  rawView?: readonly string[];
  listeners: Set<() => void>;
  rawTimer?: NodeJS.Timeout;
  lastRaw: number;
  quietTimer?: NodeJS.Timeout;
  stopping: boolean;
  restarting: boolean;
}

export interface Supervisor {
  start(): void;
  /** Start a service that was not in the config, such as a script from the palette. A known id is ignored. */
  add(config: ServiceConfig): void;
  /** Stop the service and start it again; `between` runs once it is down, before the new start. */
  restart(id: string, between?: () => Promise<void>): Promise<void>;
  stopAll(): Promise<void>;
  open(id: string): void;
  rawLines(id: string): readonly string[];
  onRaw(id: string, cb: () => void): () => void;
  /** Live root pid per service, for the sampler. */
  pids(): Record<string, number>;
  killAllSync(): void;
  /** Type into a pseudo-terminal service; see DeckControls.write. */
  write(id: string, data: string, secret?: boolean): boolean;
  /** The service runs in a live pseudo-terminal. */
  takesInput(id: string): boolean;
}

export interface SupervisorOptions {
  /** SIGTERM grace on stopAll. */
  graceMs?: number;
  /** SIGTERM grace on restart. */
  restartGraceMs?: number;
  parserFor?: (kind: ServiceKind) => LineParser;
  /** Runs each service without its own `command` as `<pm> run dev`. Default pnpm. */
  packageManager?: PackageManager;
  /**
   * The environment services start from, taken before devdeck switched its own UI to
   * NODE_ENV=production. Default: process.env at spawn time.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Keep `.devdeck/pids.json` for the next run's cleanup. Default true. `devdeck run` turns it
   * off so a one-off command never overwrites the dev deck's record.
   */
  pidFile?: boolean;
  /** Size of a service's pseudo-terminal. Default 120 by 30. */
  ptySize?: { cols: number; rows: number };
  /** A service exited without being asked to: its exit code, or null with the signal. */
  onExit?: (id: string, code: number | null, signal: NodeJS.Signals | null) => void;
}

export function createSupervisor(store: DeckStore, configs: ServiceConfig[], root: string, options: SupervisorOptions = {}): Supervisor {
  const graceMs = options.graceMs ?? 4000;
  const restartGraceMs = options.restartGraceMs ?? 3000;
  const parserFor = options.parserFor ?? createParser;
  const pm = options.packageManager ?? 'pnpm';
  const pidFile = options.pidFile ?? true;
  const procs = new Map<string, Proc>();
  let shutdown: Promise<void> | undefined;

  const makeProc = (config: ServiceConfig): Proc => ({ config, secrets: new Set(), startedAt: 0, parser: parserFor(config.kind), splitters: [], raw: [], listeners: new Set(), lastRaw: 0, stopping: false, restarting: false });
  for (const config of configs) procs.set(config.id, makeProc(config));

  /** A parser bug costs one line of parsing, never the whole dev stack. */
  const apply = (p: Proc, read: () => Signal[]): void => {
    let signals: Signal[] = [];
    try {
      signals = read();
    } catch {
      return;
    }
    if (signals.length > 0) store.getState().apply(p.config.id, signals);
  };

  /** Keep `.devdeck/pids.json` in step with the groups still to be reaped, for the next run. */
  const record = (): void => {
    if (!pidFile) return;
    const groups = [...procs.values()].flatMap((p) => (p.pgid ? [{ id: p.config.id, pgid: p.pgid, dir: p.config.dir, startedAt: p.startedAt }] : []));
    writePids(root, groups);
  };

  /** Kill a group, then forget its id once it is gone so a recycled pid is never signalled. */
  const reap = async (p: Proc, pgid: number, grace: number): Promise<void> => {
    if ((await terminate([pgid], grace)) && p.pgid === pgid) {
      p.pgid = undefined;
      if (!shutdown) record();
    }
  };

  const notifyRaw = (p: Proc): void => {
    if (p.listeners.size === 0 || p.rawTimer) return;
    const wait = Math.max(0, RAW_THROTTLE_MS - (Date.now() - p.lastRaw));
    p.rawTimer = setTimeout(() => {
      p.rawTimer = undefined;
      p.lastRaw = Date.now();
      // A broken subscriber must not take the supervisor down.
      for (const cb of p.listeners) void Promise.resolve().then(cb).catch(() => undefined);
    }, wait);
  };

  const ingest = (p: Proc, rawLine: string): void => {
    let line = stripAnsi(rawLine);
    for (const secret of p.secrets) line = line.split(secret).join(SECRET_MASK);
    if (p.term) {
      const progress = parseProgress(line);
      if (progress && progressMoved(store.getState().services[p.config.id]?.progress, progress)) store.getState().setProcess(p.config.id, { progress });
    }
    p.raw.push(truncate(line, RAW_LINE_MAX));
    if (p.raw.length > RAW_LINES + RAW_SLACK) p.raw.splice(0, p.raw.length - RAW_LINES);
    p.rawView = undefined;
    notifyRaw(p);
    apply(p, () => p.parser.push(line));
  };

  /** Close a half-read block after a quiet spell. Partial lines stay put until the stream ends. */
  const flushQuiet = (p: Proc): void => {
    clearTimeout(p.quietTimer);
    p.quietTimer = undefined;
    apply(p, () => p.parser.flush());
  };

  /** The process is gone: hand on every pending partial line, then close any open block. */
  const drainAll = (p: Proc): void => {
    for (const s of p.splitters) for (const line of s.drain()) ingest(p, line);
    flushQuiet(p);
  };

  /** Read the quiet output for a prompt, and publish it when it changed. */
  const checkPrompt = (p: Proc, splitter: LineSplitter): void => {
    let partial = stripAnsi(splitter.peek());
    for (const secret of p.secrets) partial = partial.split(secret).join(SECRET_MASK);
    const prompt = detectPrompt(p.raw.slice(-20), partial);
    if (!samePrompt(store.getState().services[p.config.id]?.prompt, prompt)) store.getState().setProcess(p.config.id, { prompt });
  };

  /** Same lifecycle as spawnProc, in a pseudo-terminal: one output stream, and input. */
  const spawnTerm = (p: Proc, pty: NonNullable<ReturnType<typeof loadPty>>): void => {
    const id = p.config.id;
    const [cmd, ...args] = devCommand(p.config, pm);
    p.parser = parserFor(p.config.kind);
    p.stopping = false;
    p.child = undefined;
    let term: IPty;
    try {
      term = pty.spawn(cmd!, args, {
        name: 'xterm-256color',
        cols: options.ptySize?.cols ?? 120,
        rows: options.ptySize?.rows ?? 30,
        cwd: join(root, p.config.dir),
        env: childEnv(options.env) as Record<string, string>,
      });
    } catch (err) {
      store.getState().setProcess(id, { status: 'crashed', pid: undefined });
      store.getState().addEvent(id, { kind: 'exit', text: `failed to start: ${err instanceof Error ? err.message : String(err)}` });
      options.onExit?.(id, 127, null);
      return;
    }
    const splitter = createLineSplitter();
    p.splitters = [splitter];
    p.term = term;
    p.termAlive = true;
    // The terminal's child leads its own session, so its pid is its group id.
    p.pgid = term.pid;
    p.startedAt = Date.now();
    record();
    store.getState().setProcess(id, { pid: term.pid, status: 'starting', startedAt: Date.now(), exitCode: undefined, detail: undefined, prompt: undefined, progress: undefined });

    term.onData((chunk) => {
      if (p.term !== term) return;
      for (const line of splitter.push(chunk)) ingest(p, line);
      clearTimeout(p.quietTimer);
      p.quietTimer = setTimeout(() => flushQuiet(p), QUIET_MS);
      // New output answers any open question; read again once it settles.
      if (store.getState().services[id]?.prompt) store.getState().setProcess(id, { prompt: undefined });
      clearTimeout(p.promptTimer);
      p.promptTimer = setTimeout(() => checkPrompt(p, splitter), PROMPT_QUIET_MS);
    });

    term.onExit(({ exitCode, signal }) => {
      if (p.term !== term) return;
      p.termAlive = false;
      clearTimeout(p.promptTimer);
      drainAll(p);
      const requested = p.stopping;
      const signalName = signal ? (Object.entries(constants.signals).find(([, n]) => n === signal)?.[0] as NodeJS.Signals | undefined) : undefined;
      const code = signalName ? null : exitCode;
      store.getState().setProcess(id, { status: !requested && code !== 0 ? 'crashed' : 'stopped', exitCode: code, pid: undefined, prompt: undefined });
      store.getState().addEvent(id, { kind: 'exit', text: code === null ? `exited on ${signalName ?? 'signal'}` : `exited with code ${code}`, status: code ?? undefined });
      if (!requested) void reap(p, term.pid, restartGraceMs);
      if (!requested) options.onExit?.(id, code, signalName ?? null);
    });
  };

  const spawnProc = (p: Proc): void => {
    const id = p.config.id;
    const pty = p.config.pty ? loadPty() : null;
    if (pty) return spawnTerm(p, pty);
    const [cmd, ...args] = devCommand(p.config, pm);
    // argv form, no shell: nothing in the config is ever parsed as shell syntax.
    const child = spawn(cmd!, args, {
      cwd: join(root, p.config.dir),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv(options.env),
    });
    p.child = child;
    p.pgid = child.pid;
    p.startedAt = Date.now();
    p.parser = parserFor(p.config.kind);
    p.splitters = [];
    p.stopping = false;
    record();
    store.getState().setProcess(id, { pid: child.pid, status: 'starting', startedAt: Date.now(), exitCode: undefined, detail: undefined });

    for (const stream of [child.stdout, child.stderr]) {
      if (!stream) continue;
      const splitter = createLineSplitter();
      p.splitters.push(splitter);
      stream.setEncoding('utf8').on('error', () => undefined);
      stream.on('data', (chunk: string) => {
        if (p.child !== child) return;
        for (const line of splitter.push(chunk)) ingest(p, line);
        clearTimeout(p.quietTimer);
        p.quietTimer = setTimeout(() => flushQuiet(p), QUIET_MS);
      });
      // Output can still arrive after 'exit'; whatever is left when the stream ends is complete.
      stream.on('end', () => {
        if (p.child !== child) return;
        for (const line of splitter.drain()) ingest(p, line);
        flushQuiet(p);
      });
    }

    child.on('error', (err) => {
      if (p.child !== child) return;
      store.getState().setProcess(id, { status: p.stopping ? 'stopped' : 'crashed', pid: undefined });
      store.getState().addEvent(id, { kind: 'exit', text: `failed to start: ${err.message}` });
      // No 'exit' follows a spawn that never started: 127 is the shell's "command not found".
      if (!p.stopping && child.pid === undefined) options.onExit?.(id, 127, null);
    });

    child.on('exit', (code, signal) => {
      if (p.child !== child) return;
      drainAll(p);
      const requested = p.stopping;
      store.getState().setProcess(id, { status: !requested && code !== 0 ? 'crashed' : 'stopped', exitCode: code, pid: undefined });
      store.getState().addEvent(id, { kind: 'exit', text: code === null ? `exited on ${signal ?? 'signal'}` : `exited with code ${code}`, status: code ?? undefined });
      // The leader died on its own: reap whatever it left in its group so no port stays held.
      if (!requested && child.pid) void reap(p, child.pid, restartGraceMs);
      if (!requested) options.onExit?.(id, code, signal);
    });
  };

  return {
    start() {
      for (const p of procs.values()) if (!p.child) spawnProc(p);
    },

    add(config) {
      if (shutdown || procs.has(config.id)) return;
      const p = makeProc(config);
      procs.set(config.id, p);
      spawnProc(p);
    },

    async restart(id, between) {
      const p = procs.get(id);
      if (!p || p.restarting || shutdown) return;
      p.restarting = true;
      try {
        p.stopping = true;
        if (p.pgid) await reap(p, p.pgid, restartGraceMs);
        if (shutdown) return;
        await between?.();
        if (shutdown) return;
        const restarts = (store.getState().services[id]?.restarts ?? 0) + 1;
        spawnProc(p);
        store.getState().setProcess(id, { restarts });
        store.getState().addEvent(id, { kind: 'restart', text: `restart #${restarts}` });
      } finally {
        p.restarting = false;
      }
    },

    stopAll() {
      if (shutdown) return shutdown;
      const pgids: number[] = [];
      for (const p of procs.values()) {
        p.stopping = true;
        clearTimeout(p.quietTimer);
        clearTimeout(p.rawTimer);
        clearTimeout(p.promptTimer);
        if (p.pgid) pgids.push(p.pgid);
      }
      shutdown = terminate(pgids, graceMs).then((gone) => {
        if (!gone) return; // Keep pids.json so the next run can finish the job.
        for (const p of procs.values()) p.pgid = undefined;
        if (pidFile) removePids(root);
      });
      return shutdown;
    },

    open(id) {
      const url = procs.get(id)?.config.url;
      if (!url) return;
      // Best effort: a missing opener only emits 'error', which is ignored.
      const opener = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
      opener.on('error', () => undefined).unref();
    },

    rawLines(id) {
      const p = procs.get(id);
      if (!p) return [];
      if (p.raw.length <= RAW_LINES) return p.raw;
      return (p.rawView ??= p.raw.slice(p.raw.length - RAW_LINES));
    },

    onRaw(id, cb) {
      const p = procs.get(id);
      if (!p) return () => undefined;
      p.listeners.add(cb);
      return () => void p.listeners.delete(cb);
    },

    write(id, data, secret) {
      const p = procs.get(id);
      if (!p?.term || !p.termAlive) return false;
      if (secret) {
        const typed = data.replace(/[\r\n]+$/, '');
        if (typed !== '') p.secrets.add(typed);
      }
      p.term.write(data);
      if (store.getState().services[id]?.prompt) store.getState().setProcess(id, { prompt: undefined });
      return true;
    },

    takesInput(id) {
      const p = procs.get(id);
      return Boolean(p?.term && p.termAlive);
    },

    pids() {
      const out: Record<string, number> = {};
      for (const [id, p] of procs) {
        if (p.term) {
          if (p.termAlive) out[id] = p.term.pid;
          continue;
        }
        const c = p.child;
        if (c?.pid && c.exitCode === null && c.signalCode === null) out[id] = c.pid;
      }
      return out;
    },

    killAllSync() {
      const pgids = [...procs.values()].map((p) => p.pgid).filter((g): g is number => typeof g === 'number');
      killSync(pgids);
    },
  };
}
