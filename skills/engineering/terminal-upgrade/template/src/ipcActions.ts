/**
 * What Claude can ask a running deck to do over the socket, beside reading it:
 *   POST /run      {"script":"build"}  run a package script as a card (or rerun its card)
 *   POST /restart  {"id":"web"}        restart a service
 *   GET  /result?id=                   status, exit code, progress, prompt, errors, last lines
 *   GET  /wait?id=&until=exit|ready&timeoutMs=
 *                                      answer when the service exits (or is ready), waits on a
 *                                      prompt only a person can answer, or the time runs out
 * Only package.json scripts run: the socket never starts an arbitrary command.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DeckState, DeckStore } from './store.ts';
import type { Progress, Prompt, ScriptEntry, ServiceStatus } from './types.ts';

export interface IpcActions {
  scripts(): ScriptEntry[];
  runScript(name: string): string | undefined;
  restart(id: string): void;
  rawLines(id: string): readonly string[];
}

export interface RunResult {
  id: string;
  label: string;
  status: ServiceStatus;
  running: boolean;
  exitCode?: number | null;
  /** Milliseconds since it started. */
  ranMs?: number;
  progress?: Progress;
  /** Set while it waits for an answer only a person can give in the deck. */
  prompt?: Prompt;
  errors: { title: string; body: string[]; file?: string }[];
  /** The last lines of output, passwords already scrubbed. */
  tail: string[];
}

export type WaitReason = 'exit' | 'ready' | 'prompt' | 'timeout' | 'gone';

const TAIL_LINES = 40;
const MAX_BODY = 4096;
export const MAX_WAIT_MS = 10 * 60_000;

export function resultOf(state: DeckState, id: string, lines: readonly string[], now = Date.now()): RunResult | undefined {
  const s = state.services[id];
  if (!s) return undefined;
  return {
    id,
    label: s.label,
    status: s.status,
    running: s.pid !== undefined,
    ...(s.exitCode !== undefined ? { exitCode: s.exitCode } : {}),
    ...(s.startedAt ? { ranMs: now - s.startedAt } : {}),
    ...(s.progress ? { progress: s.progress } : {}),
    ...(s.prompt ? { prompt: s.prompt } : {}),
    errors: state.errors.filter((e) => e.service === id).map((e) => ({ title: e.title, body: e.body, ...(e.file ? { file: e.file } : {}) })),
    tail: lines.slice(-TAIL_LINES),
  };
}

/** Why a wait is over now, or undefined while it should go on. */
export function waitDone(state: DeckState, id: string, until: 'exit' | 'ready'): WaitReason | undefined {
  const s = state.services[id];
  if (!s) return 'gone';
  if (s.pid === undefined && (s.status === 'stopped' || s.status === 'crashed')) return 'exit';
  if (s.prompt) return 'prompt';
  if (until === 'ready' && (s.status === 'ready' || s.status === 'error')) return 'ready';
  return undefined;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => {
      body += c;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(body || '{}');
        resolve(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/** Answer an action route. False when the path is not one, so the caller can 404. */
export function handleAction(store: DeckStore, actions: IpcActions, req: IncomingMessage, res: ServerResponse, url: URL): boolean {
  const { pathname } = url;
  const method = req.method ?? 'GET';
  const result = (id: string) => resultOf(store.getState(), id, actions.rawLines(id));

  if (method === 'POST' && pathname === '/run') {
    void readJson(req).then((body) => {
      const name = typeof body.script === 'string' ? body.script : '';
      const id = name ? actions.runScript(name) : undefined;
      if (!id) return send(res, 404, { error: `no script named "${name}" in package.json`, scripts: actions.scripts().map((s) => s.name) });
      send(res, 200, result(id));
    });
    return true;
  }
  if (method === 'POST' && pathname === '/restart') {
    void readJson(req).then((body) => {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!store.getState().services[id]) return send(res, 404, { error: `no service "${id}"`, services: store.getState().order });
      actions.restart(id);
      send(res, 200, { id });
    });
    return true;
  }
  if (method === 'GET' && pathname === '/result') {
    const out = result(url.searchParams.get('id') ?? '');
    send(res, out ? 200 : 404, out ?? { error: 'no such service' });
    return true;
  }
  if (method === 'GET' && pathname === '/wait') {
    const id = url.searchParams.get('id') ?? '';
    const until = url.searchParams.get('until') === 'ready' ? 'ready' : 'exit';
    const asked = Number(url.searchParams.get('timeoutMs') ?? 60_000);
    const timeoutMs = Math.max(0, Math.min(MAX_WAIT_MS, Number.isFinite(asked) ? asked : 60_000));
    let finished = false;
    let stop = (): void => undefined;
    const finish = (reason: WaitReason): void => {
      if (finished) return;
      finished = true;
      stop();
      send(res, reason === 'gone' ? 404 : 200, { reason, result: result(id) ?? null });
    };
    const now = waitDone(store.getState(), id, until);
    if (now) {
      finish(now);
      return true;
    }
    const unsubscribe = store.subscribe((state) => {
      const reason = waitDone(state, id, until);
      if (reason) finish(reason);
    });
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    stop = () => {
      unsubscribe();
      clearTimeout(timer);
    };
    // A caller that hangs up stops the wait.
    res.on('close', () => {
      finished = true;
      stop();
    });
    return true;
  }
  return false;
}
