/**
 * The repo's package scripts as things to run from the deck: the palette lists them, and
 * the socket runs one by name for Claude. Only names from the root package.json run, so
 * nothing on the socket can start an arbitrary command.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyScript, uniqueId } from './detect.ts';
import type { PackageManager, ScriptEntry, ServiceConfig } from './types.ts';

export type { ScriptEntry } from './types.ts';

/** Scripts that run as part of something else, or start the deck itself: not offered. */
const HIDDEN = /^(?:dev|install|preinstall|postinstall|prepare|prepublish|prepublishOnly|prepack|postpack|preversion|version|postversion)$/;

export function listScripts(root: string): ScriptEntry[] {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> };
    return Object.entries(pkg.scripts ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !HIDDEN.test(entry[0]) && !/devdeck/i.test(entry[1]))
      .map(([name, command]) => ({ name, command }));
  } catch {
    return [];
  }
}

/** Entries whose name holds every typed character in order, closest first. */
export function filterScripts(entries: readonly ScriptEntry[], query: string): ScriptEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  const score = (name: string): number => {
    const n = name.toLowerCase();
    if (n.startsWith(q)) return 0;
    if (n.includes(q)) return 1;
    let at = 0;
    for (const c of q) {
      at = n.indexOf(c, at);
      if (at < 0) return -1;
      at += 1;
    }
    return 2;
  };
  return entries
    .map((e) => ({ e, s: score(e.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map((x) => x.e);
}

/** The card for running `entry` from the repo root, its id kept apart from the servers'. */
export function scriptService(entry: ScriptEntry, pm: PackageManager, taken: ReadonlySet<string>): ServiceConfig {
  const id = uniqueId(`run-${entry.name}`, new Set(taken));
  const { kind } = classifyScript(entry.command);
  // A script that starts a server still runs once here: it gets no port, so no URL to open.
  return { id, label: entry.name, dir: '.', kind: kind === 'watch' ? 'watch' : 'node', pty: true, command: [pm, 'run', entry.name] };
}

interface Runner {
  getState(): { order: string[]; addService(config: ServiceConfig): void };
}

/**
 * Run a script by name as a card: a new card the first time, a rerun of that card after.
 * Undefined for a name that is not a script in the root package.json.
 */
export function createScriptRunner(root: string, pm: PackageManager, store: Runner, supervisor: { add(config: ServiceConfig): void; restart(id: string): Promise<void> }) {
  const cards = new Map<string, string>();
  return (name: string): string | undefined => {
    const entry = listScripts(root).find((e) => e.name === name);
    if (!entry) return undefined;
    const known = cards.get(name);
    if (known) {
      void supervisor.restart(known);
      return known;
    }
    const config = scriptService(entry, pm, new Set(store.getState().order));
    cards.set(name, config.id);
    store.getState().addService(config);
    supervisor.add(config);
    return config.id;
  };
}
