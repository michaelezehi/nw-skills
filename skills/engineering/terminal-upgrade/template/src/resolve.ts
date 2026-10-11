/**
 * Which deck to run. In order: `--config <file>`; else devdeck.config.ts in this package
 * (an in-repo install); else global mode on the repo at `--root <dir>` or the git top level of
 * the working directory: that repo's own Devdeck config when it has one, else detection with
 * the user's overrides applied.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CONFIG_FILE, ConfigError, JSON_CONFIG_FILE, loadConfig } from './config.ts';
import { detectConfig } from './detect.ts';
import { applyOverride, overridesPath, readOverride } from './overrides.ts';
import type { DeckConfig } from './types.ts';

export interface CliArgs {
  config?: string;
  root?: string;
  plan: boolean;
}

export type DeckSource = 'file' | 'package' | 'repo' | 'global';

export interface ResolvedDeck {
  source: DeckSource;
  config: DeckConfig;
  root: string;
  /** Shown as info events on start and listed by --plan. */
  warnings: string[];
  /** The config file used, absent in global mode. */
  file?: string;
}

/** A one-line reason devdeck cannot start. */
export class StartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartError';
  }
}

export const USAGE = 'usage: devdeck [--plan] [--root <dir>] [--config <file>]';

/** Parse argv (without node and the script). Throws StartError on anything it does not know. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { plan: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--plan') {
      args.plan = true;
      continue;
    }
    const match = /^--(config|root)(?:=(.*))?$/.exec(arg);
    if (!match) throw new StartError(`devdeck: unknown argument "${arg}". ${USAGE}`);
    const value = match[2] ?? argv[++i];
    if (value === undefined || value === '') throw new StartError(`devdeck: --${match[1]} needs a value. ${USAGE}`);
    args[match[1] as 'config' | 'root'] = value;
  }
  return args;
}

/** The git top level of `cwd` when it holds a package.json, else `cwd` itself. */
export function repoRoot(cwd: string): string {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (top && (existsSync(join(top, 'package.json')) || !existsSync(join(cwd, 'package.json')))) return top;
  } catch {
    // Not a git repo.
  }
  return cwd;
}

export interface ResolveOptions {
  /** The devdeck package dir, where an in-repo devdeck.config.ts sits. */
  packageDir: string;
  cwd?: string;
  overridesFile?: string;
}

/** Where a repo keeps its Devdeck config, relative to the repo root: a JSON file at the root, or an in-repo install's config. */
export const REPO_CONFIGS = [JSON_CONFIG_FILE, ...['packages/devdeck', 'tools/devdeck'].map((dir) => `${dir}/${CONFIG_FILE}`)];

async function fromFile(file: string, source: DeckSource): Promise<ResolvedDeck> {
  try {
    const { config, root } = await loadConfig(file);
    return { source, config, root, warnings: [], file };
  } catch (err) {
    throw new StartError(err instanceof ConfigError ? err.message : new ConfigError(file, String(err)).message);
  }
}

/** Resolve the deck for these args. Throws StartError with one plain line when nothing can run. */
export async function resolveDeck(args: CliArgs, opts: ResolveOptions): Promise<ResolvedDeck> {
  const cwd = opts.cwd ?? process.cwd();
  if (args.config !== undefined) return fromFile(resolve(cwd, args.config), 'file');
  const local = join(opts.packageDir, CONFIG_FILE);
  if (existsSync(local)) return fromFile(local, 'package');

  const root = args.root !== undefined ? resolve(cwd, args.root) : repoRoot(cwd);
  const inRepo = REPO_CONFIGS.map((rel) => join(root, rel)).find((file) => existsSync(file));
  if (inRepo !== undefined) return fromFile(inRepo, 'repo');
  const detected = detectConfig(root);
  if (detected.problem) throw new StartError(`devdeck: ${detected.problem}`);
  const file = opts.overridesFile ?? overridesPath();
  const { override, warnings: readWarnings } = readOverride(root, file);
  const { config, warnings } = applyOverride(detected.config, override, file);
  if (config.services.length === 0) throw new StartError(`devdeck: every service in ${root} is hidden by ${file}, so there is nothing to run.`);
  return { source: 'global', config, root, warnings: [...detected.warnings, ...readWarnings, ...warnings] };
}

/** The JSON --plan prints. */
export function planJson(deck: ResolvedDeck): string {
  return `${JSON.stringify({ source: deck.source, root: deck.root, file: deck.file, config: deck.config, warnings: deck.warnings }, null, 2)}\n`;
}
