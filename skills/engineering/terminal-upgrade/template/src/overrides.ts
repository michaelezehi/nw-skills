/**
 * Per-user changes to a detected deck, kept outside every repo in
 * `$XDG_CONFIG_HOME/devdeck/repos.json` (or ~/.config/devdeck/repos.json), keyed by repo root:
 *
 *   { "/abs/repo": { "title": "Acme", "services": { "web": { "port": 3001 }, "docs": null }, "add": [ ...ServiceConfig ], "cleanup": { "orphans": "ask" } } }
 *
 * `null` hides a service. `cleanup` and `convexFeed` take the same values as in a config file. Anything malformed is skipped with a warning; a bad file never stops devdeck.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkCleanup, checkService } from './config.ts';
import type { CleanupConfig, DeckConfig, ServiceConfig } from './types.ts';

export interface RepoOverride {
  title?: unknown;
  services?: unknown;
  add?: unknown;
  cleanup?: unknown;
  convexFeed?: unknown;
}

export interface Overridden {
  config: DeckConfig;
  warnings: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Where the overrides file lives for this environment. */
export function overridesPath(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const xdg = env.XDG_CONFIG_HOME;
  return join(xdg && xdg.startsWith('/') ? xdg : join(home, '.config'), 'devdeck', 'repos.json');
}

function canonical(path: string, home: string): string {
  const expanded = path === '~' ? home : path.startsWith('~/') ? join(home, path.slice(2)) : path;
  const abs = resolve(expanded);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/** The entry for `root` in the overrides file, or undefined. Reports an unreadable file as a warning. */
export function readOverride(root: string, file: string = overridesPath(), home: string = homedir()): { override?: RepoOverride; warnings: string[] } {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { warnings: [] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { warnings: [`${file} is not valid JSON, so it was ignored.`] };
  }
  if (!isRecord(raw)) return { warnings: [`${file} must hold an object keyed by repo root, so it was ignored.`] };
  const want = canonical(root, home);
  for (const [key, value] of Object.entries(raw)) {
    if (canonical(key, home) !== want) continue;
    if (!isRecord(value)) return { warnings: [`${file}: the entry for ${key} must be an object, so it was ignored.`] };
    return { override: value, warnings: [] };
  }
  return { warnings: [] };
}

/** Merge one repo's override onto a detected config. Never throws; skips what is malformed. */
export function applyOverride(config: DeckConfig, override: RepoOverride | undefined, file = 'repos.json'): Overridden {
  if (!override) return { config, warnings: [] };
  const warnings: string[] = [];
  const skip = (what: string, why: string): void => void warnings.push(`${file}: ${what} ignored, ${why}.`);
  let title = config.title;
  if (override.title !== undefined) {
    if (typeof override.title === 'string' && override.title.trim() !== '') title = override.title;
    else skip('title', 'it must be a non-empty string');
  }

  const patches = override.services === undefined ? {} : isRecord(override.services) ? override.services : undefined;
  if (!patches) skip('services', 'it must be an object keyed by service id');
  const services: ServiceConfig[] = [];
  for (const [i, service] of config.services.entries()) {
    const patch = patches?.[service.id];
    if (patch === null) continue;
    if (patch === undefined) {
      services.push(service);
      continue;
    }
    if (!isRecord(patch)) {
      skip(`services.${service.id}`, 'it must be an object or null');
      services.push(service);
      continue;
    }
    const merged = { ...service, ...patch, id: service.id };
    const problem = checkService(merged, i);
    if (problem) {
      skip(`services.${service.id}`, problem.replace(/^services\[\d+\]\.?/, '').trim() || 'it is not a service');
      services.push(service);
      continue;
    }
    services.push(merged as ServiceConfig);
  }
  for (const id of Object.keys(patches ?? {})) {
    if (!config.services.some((s) => s.id === id)) skip(`services.${id}`, 'no detected service has that id');
  }

  if (override.add !== undefined && !Array.isArray(override.add)) skip('add', 'it must be an array of services');
  for (const [i, extra] of (Array.isArray(override.add) ? override.add : []).entries()) {
    const problem = checkService(extra, i);
    if (problem) {
      skip(`add[${i}]`, problem.replace(/^services\[\d+\]\.?/, '').trim() || 'it is not a service');
      continue;
    }
    const service = extra as ServiceConfig;
    if (services.some((s) => s.id === service.id)) {
      skip(`add[${i}]`, `the id "${service.id}" is already in use`);
      continue;
    }
    services.push(service);
  }

  let cleanup = config.cleanup;
  const cleanupProblem = checkCleanup(override.cleanup);
  if (cleanupProblem) skip('cleanup', cleanupProblem);
  else if (override.cleanup !== undefined) cleanup = override.cleanup as CleanupConfig;

  let convexFeed = config.convexFeed;
  if (typeof override.convexFeed === 'boolean') convexFeed = override.convexFeed;
  else if (override.convexFeed !== undefined) skip('convexFeed', 'it must be true or false');

  return { config: { ...config, title, services, ...(cleanup ? { cleanup } : {}), ...(convexFeed !== undefined ? { convexFeed } : {}) }, warnings };
}
