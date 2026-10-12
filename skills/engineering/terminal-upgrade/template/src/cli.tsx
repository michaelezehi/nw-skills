#!/usr/bin/env tsx
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convexService, EXIT_CANNOT_RUN, EXIT_SIGHUP, EXIT_SIGINT, EXIT_SIGTERM } from './config.ts';
import { startConvexFeed } from './convexFeed.ts';
import { startIpc } from './ipc.ts';
import { buildMeta } from './meta.ts';
import { startPlain } from './plain.ts';
import { parseArgs, planJson, resolveDeck, StartError, type ResolvedDeck } from './resolve.ts';
import { exitStatus, finalOutput, runDeck, runMode } from './runMode.ts';
import { killPid, startSampler } from './sampler.ts';
import { cleanedText, prepareStart } from './startup.ts';
import { createDeckStore } from './store.ts';
import { createSupervisor } from './supervisor.ts';
import type { DeckControls } from './types.ts';

// Before the UI import below flips NODE_ENV: services start from the caller's environment.
const callerEnv: NodeJS.ProcessEnv = { ...process.env };

async function main(): Promise<void> {
  // An in-repo devdeck.config.ts sits in the package dir, one level above src/.
  const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
  let deck: ResolvedDeck;
  let plan = false;
  let run: string[] | undefined;
  try {
    const args = parseArgs(process.argv.slice(2));
    plan = args.plan;
    run = args.run;
    deck = run ? runDeck(run, args.root !== undefined ? resolve(args.root) : process.cwd()) : await resolveDeck(args, { packageDir });
  } catch (err) {
    // StartError means "cannot run here": the shell hook then runs `<pm> dev` untouched.
    process.stderr.write(`${err instanceof StartError ? err.message : `devdeck: ${String(err)}`}\n`);
    process.exit(err instanceof StartError ? EXIT_CANNOT_RUN : 1);
  }
  if (plan) {
    // Exit once the JSON is flushed: a pipe on macOS is written asynchronously.
    process.stdout.write(planJson(deck), () => process.exit(0));
    return;
  }
  const { config, root } = deck;
  const { services, packageManager } = config;
  // A one-off command shares the repo with a running dev deck: it owns no socket, no pids.json
  // and no Convex feed, and it never cleans up or blocks on the dev deck's servers.
  const convex = run ? undefined : convexService(services);
  // Before any UI or spawn: a second devdeck would only fight the first over every port.
  const check = run ? { cleaned: 0 } : await prepareStart(root);
  if (check.blocked !== undefined) {
    process.stderr.write(`${check.blocked}\n`);
    process.exit(EXIT_CANNOT_RUN);
  }
  const store = createDeckStore(services, { ...buildMeta(root, config.title, convex?.dir), ...(run ? { mode: runMode(deck) } : {}) });
  if (check.cleaned > 0) store.getState().addEvent('devdeck', { kind: 'info', text: cleanedText(check.cleaned) });
  for (const text of deck.warnings) store.getState().addEvent('devdeck', { kind: 'info', text });
  const runStarted = Date.now();
  let finished: number | undefined;
  const supervisor = createSupervisor(store, services, root, {
    packageManager,
    env: callerEnv,
    pidFile: !run,
    // The command wraps its output to the width the deck's log pane shows it at.
    ptySize: { cols: Math.max(40, (process.stdout.columns ?? 120) - 4), rows: Math.max(10, process.stdout.rows ?? 30) },
    // The command ended on its own: the deck ends with it and passes its status on.
    onExit: run
      ? (_id, code, signal) => {
          finished = exitStatus(code, signal);
          void shutdown(finished);
        }
      : undefined,
  });
  let feed: ReturnType<typeof startConvexFeed> | undefined;
  let ui: { unmount(): void } | undefined;
  let stopPlain: (() => void) | undefined;

  // Last resort: whatever path the process exits by, no service group survives it.
  process.on('exit', () => {
    supervisor.killAllSync();
    feed?.killSync();
  });

  let shuttingDown: Promise<void> | undefined;
  let sampler: ReturnType<typeof startSampler> | undefined;
  let closeIpc: () => Promise<void> = () => Promise.resolve();

  const shutdown = (code = 0): Promise<void> => {
    if (shuttingDown) return shuttingDown;
    shuttingDown = (async () => {
      try {
        sampler?.stop();
        await closeIpc().catch(() => undefined);
        await Promise.all([feed?.stop(), supervisor.stopAll()]);
      } finally {
        try {
          ui?.unmount();
        } catch {
          // Already unmounted.
        }
        stopPlain?.();
        if (run) {
          const id = services[0]?.id ?? '';
          const peak = Math.max(0, ...(store.getState().services[id]?.memHistory ?? []));
          process.stdout.write(finalOutput(supervisor.rawLines(id), run, code, Date.now() - runStarted, peak), () => process.exit(code));
          return;
        }
        process.exit(code);
      }
    })();
    return shuttingDown;
  };

  const SIGNAL_EXIT: Record<string, number> = { SIGINT: EXIT_SIGINT, SIGTERM: EXIT_SIGTERM, SIGHUP: EXIT_SIGHUP };
  // A second signal while stopping means "now": SIGKILL everything and leave.
  const onSignal = (signal: NodeJS.Signals): void => {
    const code = SIGNAL_EXIT[signal] ?? EXIT_SIGTERM;
    if (shuttingDown) {
      supervisor.killAllSync();
      feed?.killSync();
      process.exit(code);
    }
    void shutdown(code);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, onSignal);

  const controls: DeckControls = {
    restart: (id) => void supervisor.restart(id),
    open: (id) => supervisor.open(id),
    // Quitting a one-off command before it ends is an interrupt, so a `&&` chain stops there.
    quit: (code = 0) => void shutdown(run && finished === undefined ? EXIT_SIGINT : code),
    rawLines: (id) => supervisor.rawLines(id),
    onRaw: (id, cb) => supervisor.onRaw(id, cb),
    killPid: (pid) => killPid(pid, { self: process.pid, roots: Object.values(supervisor.pids()) }),
    write: (id, data, secret) => supervisor.write(id, data, secret),
  };

  const tty = Boolean(process.stdout.isTTY) && process.env.DEVDECK_PLAIN !== '1';
  if (tty) {
    // The UI calls controls.quit on q and Ctrl-C (Ink runs with exitOnCtrlC off).
    // React and Ink pick their build from NODE_ENV when first loaded, and nothing has
    // loaded them yet. The development build kept a heap near 900 MB after 25 minutes.
    process.env.NODE_ENV = 'production';
    const { renderDeck } = await import('./ui/App.tsx');
    const app = renderDeck(store, controls, {
      serviceDirs: Object.fromEntries(services.map((s) => [s.id, s.dir])),
      // A one-off command is its output: open on the log rather than the feed.
      ...(run ? { initialUi: { activity: 'logs' as const } } : {}),
    });
    ui = app;
    void app.waitUntilExit().then(() => shutdown(0), () => shutdown(1));
  } else {
    stopPlain = startPlain(store);
  }

  supervisor.start();
  sampler = startSampler(store, () => supervisor.pids());
  if (convex) feed = startConvexFeed(store, root, { serviceId: convex.id, dir: convex.dir, packageManager });
  if (run) return;
  const ipc = await startIpc(store, root);
  closeIpc = () => ipc.close();
  if (shuttingDown) await ipc.close();
}

main().catch((err: unknown) => {
  process.stderr.write(`devdeck: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
