import { chmodSync, unlinkSync } from 'node:fs';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { ensureDeckDir } from './pidfile.ts';
import { toSnapshot, type DeckStore } from './store.ts';

export const socketPath = (root: string): string => join(root, '.devdeck', 'devdeck.sock');

export interface Ipc {
  /** True when this process owns the socket. */
  active: boolean;
  path: string;
  close(): Promise<void>;
}

/** Who answered on the socket. `pid` is missing for a devdeck that predates /health. */
export interface LiveDeck {
  pid?: number;
}

/** Resolves to the live devdeck answering HTTP on the socket within `timeoutMs`, or null. */
export function probe(path: string, timeoutMs = 500): Promise<LiveDeck | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (live: LiveDeck | null): void => {
      if (done) return;
      done = true;
      resolve(live);
    };
    try {
      const req = request({ socketPath: path, path: '/health', method: 'GET', timeout: timeoutMs }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          if (body.length < 4096) body += c;
        });
        res.on('error', () => finish({}));
        res.on('end', () => {
          try {
            const pid = (JSON.parse(body) as { pid?: unknown }).pid;
            finish(Number.isInteger(pid) ? { pid: pid as number } : {});
          } catch {
            finish({});
          }
        });
      });
      req.on('timeout', () => {
        req.destroy();
        finish(null);
      });
      req.on('error', () => finish(null));
      req.end();
    } catch {
      finish(null);
    }
  });
}

/** The line to print when a live devdeck already serves this repo, or undefined when none does. */
export async function alreadyRunning(root: string): Promise<string | undefined> {
  const live = await probe(socketPath(root));
  if (!live) return undefined;
  const who = live.pid ? ` (pid ${live.pid})` : '';
  return `Devdeck is already running in this repo${who}. Switch to that terminal, or quit it first.`;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(json);
}

export function handle(store: DeckStore, req: IncomingMessage, res: ServerResponse): void {
  try {
    const url = new URL(req.url ?? '/', 'http://devdeck');
    if (req.method !== 'GET') return send(res, 404, { error: 'not found' });
    const state = store.getState();
    switch (url.pathname) {
      case '/health':
        return send(res, 200, { pid: process.pid });
      case '/state':
        return send(res, 200, toSnapshot(state));
      case '/events': {
        const since = Number(url.searchParams.get('since') ?? 0);
        const floor = Number.isFinite(since) ? since : 0;
        return send(res, 200, state.events.filter((e) => e.id > floor));
      }
      case '/errors':
        return send(res, 200, state.errors);
      default:
        return send(res, 404, { error: 'not found' });
    }
  } catch (err) {
    try {
      if (!res.headersSent) send(res, 500, { error: err instanceof Error ? err.message : 'internal error' });
      else res.end();
    } catch {
      // Socket already gone.
    }
  }
}

const removeSocket = (path: string): void => {
  try {
    unlinkSync(path);
  } catch {
    // Already gone.
  }
};

/**
 * Serve the snapshot on `<root>/.devdeck/devdeck.sock`. When another live devdeck already
 * answers there, run without IPC and say so in the event log. Never rejects.
 */
export async function startIpc(store: DeckStore, root: string): Promise<Ipc> {
  const path = socketPath(root);
  const inactive = (text: string): Ipc => {
    store.getState().addEvent('devdeck', { kind: 'info', text });
    return { active: false, path, close: () => Promise.resolve() };
  };

  try {
    ensureDeckDir(root);
  } catch (err) {
    return inactive(`ipc off: ${err instanceof Error ? err.message : 'cannot create .devdeck'}`);
  }

  if (await probe(path)) return inactive('ipc off: another devdeck is already serving .devdeck/devdeck.sock');
  removeSocket(path);

  const server = createServer((req, res) => {
    req.on('error', () => undefined);
    res.on('error', () => undefined);
    handle(store, req, res);
  });
  server.on('clientError', (_err, socket) => socket.destroy());

  const listening = await new Promise<boolean>((resolve) => {
    server.once('error', () => resolve(false));
    server.listen(path, () => resolve(true));
  });
  if (!listening) return inactive('ipc off: could not listen on .devdeck/devdeck.sock');
  server.on('error', () => undefined);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Permissions are a nicety; the directory is inside the repo already.
  }

  let closing: Promise<void> | undefined;
  return {
    active: true,
    path,
    close() {
      if (closing) return closing;
      closing = new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }).finally(() => removeSocket(path));
      return closing;
    },
  };
}
