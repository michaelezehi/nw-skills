/**
 * Loads and checks devdeck.config.ts, and turns the package manager it names into the
 * argv devdeck spawns. Nothing here is specific to one repo.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DeckConfig, PackageManager, ServiceConfig, ServiceKind } from './types.ts';

export const CONFIG_FILE = 'devdeck.config.ts';
/** The same config as plain JSON at a repo root, for a repo that does not carry Devdeck itself. */
export const JSON_CONFIG_FILE = 'devdeck.config.json';

/**
 * Devdeck cannot run in this repo (EX_CONFIG): no package.json, nothing to run, a bad config,
 * a usage error, or a Devdeck already running here. The shell hook falls back to `<pm> dev`.
 */
export const EXIT_CANNOT_RUN = 78;
/** Quit by Ctrl-C or SIGINT, 128 + 2. */
export const EXIT_SIGINT = 130;
/** Stopped by SIGTERM, 128 + 15. */
export const EXIT_SIGTERM = 143;
/** Stopped by SIGHUP, 128 + 1. */
export const EXIT_SIGHUP = 129;

const MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun'];
const KINDS: readonly ServiceKind[] = ['next', 'convex', 'node', 'watch', 'vite'];

export interface LoadedConfig {
  config: DeckConfig;
  /** Absolute repo root: `config.root` resolved against the config file's directory. */
  root: string;
}

/** A config problem, worded as one line that names the file. */
export class ConfigError extends Error {
  constructor(file: string, reason: string) {
    super(`devdeck: ${file}: ${reason.split(/\r?\n/)[0]?.trim() || 'invalid config'}`);
    this.name = 'ConfigError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';

/** Why `raw` is not a ServiceConfig, naming it services[i]; undefined when it is one. */
export function checkService(raw: unknown, i: number): string | undefined {
  const at = `services[${i}]`;
  if (!isRecord(raw)) return `${at} must be an object`;
  for (const key of ['id', 'label', 'dir'] as const) {
    if (!isString(raw[key]) || raw[key] === '') return `${at}.${key} must be a non-empty string`;
  }
  if (!KINDS.includes(raw.kind as ServiceKind)) return `${at}.kind must be one of ${KINDS.join(', ')}`;
  if (raw.port !== undefined && (typeof raw.port !== 'number' || !Number.isInteger(raw.port) || raw.port <= 0)) return `${at}.port must be a positive integer`;
  if (raw.url !== undefined && !isString(raw.url)) return `${at}.url must be a string`;
  if (raw.command !== undefined) {
    const cmd = raw.command;
    if (!Array.isArray(cmd) || cmd.length === 0 || !cmd.every((part) => isString(part) && part !== '')) return `${at}.command must be a non-empty array of strings`;
  }
  return undefined;
}

/** Why `raw` is not a DeckConfig, or undefined when it is one. */
export function configProblem(raw: unknown): string | undefined {
  if (!isRecord(raw)) return 'the default export must be a config object';
  if (!isString(raw.title)) return 'title must be a string';
  if (!isString(raw.root) || raw.root === '') return 'root must be a non-empty string';
  if (!MANAGERS.includes(raw.packageManager as PackageManager)) return `packageManager must be one of ${MANAGERS.join(', ')}`;
  if (!Array.isArray(raw.services) || raw.services.length === 0) return 'services must be a non-empty array';
  const seen = new Set<string>();
  for (const [i, service] of raw.services.entries()) {
    const problem = checkService(service, i);
    if (problem) return problem;
    const id = (service as ServiceConfig).id;
    if (seen.has(id)) return `services[${i}].id "${id}" is used twice`;
    seen.add(id);
  }
  return undefined;
}

/** Import the config's default export, check it, and resolve its root. Throws ConfigError. */
export async function loadConfig(file: string): Promise<LoadedConfig> {
  let mod: { default?: unknown };
  try {
    mod = file.endsWith('.json') ? { default: JSON.parse(readFileSync(file, 'utf8')) as unknown } : ((await import(pathToFileURL(file).href)) as { default?: unknown });
  } catch (err) {
    throw new ConfigError(file, err instanceof Error ? err.message : String(err));
  }
  const problem = configProblem(mod.default);
  if (problem) throw new ConfigError(file, problem);
  const config = mod.default as DeckConfig;
  const root = resolve(dirname(file), config.root);
  let isDir = false;
  try {
    isDir = statSync(root).isDirectory();
  } catch {
    // Reported below.
  }
  if (!isDir) throw new ConfigError(file, `root "${config.root}" resolves to ${root}, which is not a directory`);
  return { config, root };
}

/** The argv a service runs: its own command, or the package manager's `run dev`. */
export function devCommand(service: ServiceConfig, pm: PackageManager): string[] {
  return service.command ?? [pm, 'run', 'dev'];
}

/** The argv for the Convex CLI, run through the package manager. */
export function convexCommand(pm: PackageManager, args: readonly string[]): string[] {
  switch (pm) {
    case 'pnpm':
      return ['pnpm', 'exec', 'convex', ...args];
    case 'npm':
      return ['npx', 'convex', ...args];
    case 'yarn':
      return ['yarn', 'convex', ...args];
    case 'bun':
      return ['bunx', 'convex', ...args];
  }
}

/** The first convex service, whose dir is where the Convex CLI runs. Undefined when there is none. */
export function convexService(services: readonly ServiceConfig[]): ServiceConfig | undefined {
  return services.find((s) => s.kind === 'convex');
}
