/**
 * Global mode: reads a repo's package.json and workspaces and works out every long-running
 * dev process, so devdeck runs in a repo that has no devdeck.config.ts of its own.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isExcluded, rootRunner } from './rootScript.ts';
import type { DeckConfig, PackageManager, ServiceConfig, ServiceKind } from './types.ts';
import { packageWorkspaceGlobs, pnpmWorkspaceGlobs, unquote, workspaceDirs } from './workspaces.ts';

export { expandGlob, packageWorkspaceGlobs, pnpmWorkspaceGlobs, workspaceDirs } from './workspaces.ts';

export interface Detection {
  config: DeckConfig;
  warnings: string[];
  /** Set when there is nothing to run; one plain line. */
  problem?: string;
}

interface PackageJson {
  name?: unknown;
  packageManager?: unknown;
  scripts?: Record<string, unknown>;
  workspaces?: unknown;
}

const MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun'];

function readJson(file: string): PackageJson | undefined {
  try {
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as PackageJson) : undefined;
  } catch {
    return undefined;
  }
}

const devScript = (pkg: PackageJson | undefined): string | undefined => {
  const script = pkg?.scripts?.dev;
  return typeof script === 'string' && script.trim() !== '' ? script : undefined;
};

const nameOf = (pkg: PackageJson | undefined): string | undefined => (typeof pkg?.name === 'string' && pkg.name !== '' ? pkg.name : undefined);

/** The `packageManager` field first, then whichever lockfile is present, then npm. */
export function detectPackageManager(declared: unknown, hasFile: (name: string) => boolean): PackageManager {
  const name = typeof declared === 'string' ? declared.split('@')[0] : '';
  if (MANAGERS.includes(name as PackageManager)) return name as PackageManager;
  if (hasFile('pnpm-lock.yaml')) return 'pnpm';
  if (hasFile('bun.lockb') || hasFile('bun.lock')) return 'bun';
  if (hasFile('yarn.lock')) return 'yarn';
  return 'npm';
}

const PORT_FLAG = /(?:--port|(?:^|\s)-p)[\s=]+(\d{2,5})\b/;
const ENV_PORT = /\bPORT=(\d{2,5})\b/;

/** Kind and port from the dev script text. A convex port comes from its .env.local instead. */
export function classifyScript(script: string): { kind: ServiceKind; port?: number } {
  const flag = Number(PORT_FLAG.exec(script)?.[1]) || undefined;
  const env = Number(ENV_PORT.exec(script)?.[1]) || undefined;
  if (/\bnext\s+dev\b/.test(script)) return { kind: 'next', port: flag ?? env ?? 3000 };
  if (/\bvite\b/.test(script) && !/\bvitest\b/.test(script)) return { kind: 'vite', port: flag ?? env ?? 5173 };
  if (/\bconvex\s+dev\b/.test(script)) return { kind: 'convex' };
  if (/\b(tsc|tsup)\b.*(--watch|\s-w\b)/.test(script)) return { kind: 'watch' };
  const port = env ?? flag;
  return port ? { kind: 'node', port } : { kind: 'node' };
}

/** The port of a local CONVEX_URL in an env file; undefined for a cloud URL or none. */
export function convexPortFromEnv(envText: string): number | undefined {
  const raw = /^\s*(?:export\s+)?CONVEX_URL\s*=\s*(.*)$/m.exec(envText)?.[1];
  if (raw === undefined) return undefined;
  const url = unquote(raw.replace(/\s+#.*$/, ''));
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) return undefined;
  try {
    return Number(new URL(url).port) || undefined;
  } catch {
    return undefined;
  }
}

function convexPort(root: string, dir: string): number | undefined {
  try {
    return convexPortFromEnv(readFileSync(join(root, dir, '.env.local'), 'utf8'));
  } catch {
    return undefined;
  }
}

const unscoped = (name: string): string => name.replace(/^@[^/]+\//, '');

export const titleCase = (s: string): string =>
  unscoped(s)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Header title: the root package name without its scope, dashes to spaces, upper case. */
export const deckTitle = (name: string | undefined, root: string): string => titleCase(name ?? basename(root)).toUpperCase();

/** A short id from `raw`, suffixed -2, -3 when taken. Adds it to `taken`. */
export function uniqueId(raw: string, taken: Set<string>): string {
  const base =
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'app';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

const KIND_ORDER: Record<ServiceKind, number> = { next: 0, vite: 0, node: 1, convex: 2, watch: 3 };

/** Next and Vite first, then node, convex, watch. Stable within a kind. */
export const sortServices = (services: readonly ServiceConfig[]): ServiceConfig[] =>
  [...services].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

/** One warning per port that two or more services claim. */
export function portWarnings(services: readonly ServiceConfig[]): string[] {
  const byPort = new Map<number, string[]>();
  for (const s of services) if (s.port) byPort.set(s.port, [...(byPort.get(s.port) ?? []), s.id]);
  return [...byPort]
    .filter(([, ids]) => ids.length > 1)
    .map(([port, ids]) => `Port ${port} is claimed by ${ids.join(', ')}. Give each its own --port.`);
}

const MANY_IN_ONE = /\bconcurrently\b|\bnpm-run-all\b|\brun-p\b|(?:^|[^&])&(?:[^&]|$)/;

/** A warning when one dev script starts several processes, which then share one card. */
export function scriptWarning(id: string, script: string): string | undefined {
  return MANY_IN_ONE.test(script)
    ? `The ${id} dev script starts several processes in one command, so they share one card. Split them into separate scripts for a card each.`
    : undefined;
}

function makeService(root: string, id: string, label: string, dir: string, script: string): ServiceConfig {
  const { kind, port: scriptPort } = classifyScript(script);
  const port = kind === 'convex' ? convexPort(root, dir) : scriptPort;
  const host = kind === 'convex' ? '127.0.0.1' : 'localhost';
  return { id, label: kind === 'watch' ? id : label, dir, kind, ...(port ? { port, url: `http://${host}:${port}` } : {}) };
}

/** Work out the deck for the repo at `root`. Never throws; `problem` says why nothing can run. */
export function detectConfig(root: string): Detection {
  const pkg = readJson(join(root, 'package.json'));
  const pm = detectPackageManager(pkg?.packageManager, (name) => existsSync(join(root, name)));
  const config: DeckConfig = { title: deckTitle(nameOf(pkg), root), root, packageManager: pm, services: [] };
  if (!pkg) return { config, warnings: [], problem: `No package.json at ${root}, so there is no dev script to run.` };
  const rootScript = devScript(pkg);
  if (rootScript && /devdeck/i.test(rootScript)) {
    return { config, warnings: [], problem: `The dev script in ${join(root, 'package.json')} already starts Devdeck, so it runs as it is.` };
  }

  const yaml = join(root, 'pnpm-workspace.yaml');
  let globs: string[] = [];
  try {
    globs = existsSync(yaml) ? pnpmWorkspaceGlobs(readFileSync(yaml, 'utf8')) : packageWorkspaceGlobs(pkg.workspaces);
  } catch {
    globs = [];
  }

  const warnings: string[] = [];
  const services: ServiceConfig[] = [];
  const taken = new Set<string>();
  const addRoot = (script: string): void => {
    const name = nameOf(pkg) ?? basename(root);
    const service = makeService(root, uniqueId(unscoped(name), taken), titleCase(name), '.', script);
    services.push({ ...service, command: [pm, 'run', 'dev'] });
    const warning = scriptWarning(service.id, script);
    if (warning) warnings.push(warning);
  };

  const runner = rootScript ? rootRunner(rootScript) : undefined;
  if (rootScript && !runner) {
    if (globs.length > 0) warnings.push('The root dev script is not a workspace runner such as turbo or pnpm -r, so it runs as one service.');
    addRoot(rootScript);
  } else {
    for (const dir of workspaceDirs(root, globs)) {
      if (dir === '.') continue;
      const child = readJson(join(root, dir, 'package.json'));
      const script = devScript(child);
      if (!script || /devdeck/i.test(dir) || /devdeck/i.test(script) || isExcluded(runner, nameOf(child), dir)) continue;
      const service = makeService(root, uniqueId(basename(dir), taken), titleCase(nameOf(child) ?? basename(dir)), dir, script);
      services.push(service);
      const warning = scriptWarning(service.id, script);
      if (warning) warnings.push(warning);
    }
    // Devdeck starts each package itself, so it runs what the script chains before its runner first.
    if (services.length > 0 && runner?.setup) config.setup = runner.setup;
    if (services.length === 0 && rootScript) {
      if (globs.length > 0) warnings.push('No workspace package has a dev script, so the root dev script runs as one service.');
      addRoot(rootScript);
    }
  }

  if (services.length === 0) {
    return { config, warnings, problem: `No dev script in ${join(root, 'package.json')} or its workspaces, so there is nothing to run.` };
  }
  config.services = sortServices(services);
  warnings.push(...portWarnings(config.services));
  return { config, warnings };
}
