import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { parseConvexJsonl } from './parsers/convex.ts';
import { stripAnsi } from './parsers/index.ts';
import type { DeckStore } from './store.ts';
import { killSync, terminate } from './sampler.ts';
import { createLineSplitter, truncate } from './lines.ts';
import { childEnv } from './supervisor.ts';
import { convexCommand } from './config.ts';
import type { PackageManager, ServiceStatus } from './types.ts';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30_000;
/** A tail that ran this long counts as healthy, so the next failure starts the backoff over. */
const HEALTHY_MS = 60_000;
const LIVE: ReadonlySet<ServiceStatus> = new Set(['ready', 'compiling', 'error']);
/** One JSONL row can carry a whole function's log output; rows are only dropped past this. */
export const MAX_ROW = 4 * 1024 * 1024;

export interface ConvexFeed {
  stop(): Promise<void>;
  killSync(): void;
}

export interface ConvexFeedOptions {
  /** The convex service whose status gates the tail. */
  serviceId: string;
  /** Where the Convex CLI runs, relative to the root: the convex service's dir. */
  dir: string;
  /** Default pnpm. */
  packageManager?: PackageManager;
}

/**
 * Tails `convex logs --jsonl --success` once the convex service is ready and turns
 * every function execution into a store call. Every call is kept; the UI filters.
 */
export function startConvexFeed(store: DeckStore, root: string, options: ConvexFeedOptions): ConvexFeed {
  const serviceId = options.serviceId;
  const cwd = join(root, options.dir);
  const [cmd, ...args] = convexCommand(options.packageManager ?? 'pnpm', ['logs', '--jsonl', '--success']);
  let child: ChildProcess | undefined;
  let pgid: number | undefined;
  let retry: NodeJS.Timeout | undefined;
  let backoff = MIN_BACKOFF_MS;
  let stopped = false;
  let stopping: Promise<void> | undefined;

  const convexLive = (): boolean => {
    const status = store.getState().services[serviceId]?.status;
    return status !== undefined && LIVE.has(status);
  };

  const launch = (): void => {
    if (stopped || child || retry || !convexLive()) return;
    const startedAt = Date.now();
    const proc = spawn(cmd!, args, {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv(),
    });
    child = proc;
    pgid = proc.pid;

    const splitter = createLineSplitter(MAX_ROW);
    proc.stdout?.setEncoding('utf8');
    proc.stdout?.on('data', (chunk: string) => {
      // One store update per chunk, however many calls it carries.
      const calls = [];
      for (const line of splitter.push(chunk)) {
        const call = parseConvexJsonl(stripAnsi(line));
        if (call) calls.push(call);
      }
      store.getState().addCalls(calls);
    });
    proc.stdout?.on('error', () => undefined);

    // The last thing the tail said on stderr is why it stopped.
    let lastErr = '';
    const errSplitter = createLineSplitter();
    const keep = (lines: string[]): void => {
      for (const line of lines) {
        const t = stripAnsi(line).trim();
        if (t) lastErr = truncate(t, 300);
      }
    };
    proc.stderr?.setEncoding('utf8');
    proc.stderr?.on('data', (chunk: string) => keep(errSplitter.push(chunk)));
    proc.stderr?.on('error', () => undefined);

    let ended = false;
    const onEnd = (reason: string): void => {
      if (ended || child !== proc) return;
      ended = true;
      child = undefined;
      const group = pgid;
      // Clear the group the tail left behind, then forget its id.
      if (group) void terminate([group], 1000).then((gone) => {
        if (gone && pgid === group) pgid = undefined;
      });
      if (stopped) return;
      backoff = Date.now() - startedAt > HEALTHY_MS ? MIN_BACKOFF_MS : backoff;
      const wait = backoff;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      // stderr can still be draining after 'exit': say why once it ends, or after a short wait.
      let said = false;
      const say = (): void => {
        if (said || stopped) return;
        said = true;
        keep(errSplitter.drain());
        store.getState().addEvent(serviceId, { kind: 'info', text: `call feed stopped: ${lastErr || reason}, retrying in ${Math.round(wait / 1000)}s` });
      };
      if (proc.stderr && !proc.stderr.readableEnded) {
        proc.stderr.once('end', say);
        setTimeout(say, 250).unref();
      } else say();
      retry = setTimeout(() => {
        retry = undefined;
        launch();
      }, wait);
      retry.unref();
    };
    proc.on('error', (err) => onEnd(err.message));
    proc.on('exit', (code, sig) => onEnd(code === null ? `exited on ${sig ?? 'signal'}` : `exited with code ${code}`));
  };

  // Start, or restart after a convex restart, whenever the service comes up.
  const unsubscribe = store.subscribe((state, prev) => {
    if (state.services[serviceId]?.status !== prev.services[serviceId]?.status) launch();
  });
  launch();

  return {
    stop() {
      if (stopping) return stopping;
      stopped = true;
      unsubscribe();
      clearTimeout(retry);
      retry = undefined;
      stopping = (pgid ? terminate([pgid], 2000) : Promise.resolve(true)).then(() => undefined);
      return stopping;
    },
    killSync() {
      if (pgid) killSync([pgid]);
    },
  };
}
