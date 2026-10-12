/**
 * `devdeck run <command…>`: any one command in the deck, a build, a test run or a script. The
 * deck closes when the command exits, prints its output where a plain run would have left it,
 * and exits with the command's code so `devdeck run pnpm build && pnpm ship` still chains.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { constants } from 'node:os';
import { basename, join, relative } from 'node:path';
import { classifyScript, deckTitle, detectPackageManager, titleCase, uniqueId } from './detect.ts';
import { repoRoot, StartError, type ResolvedDeck } from './resolve.ts';

const MANAGERS = new Set(['pnpm', 'npm', 'yarn', 'bun']);

function readPackage(dir: string): { name?: string; packageManager?: unknown; scripts: Record<string, string> } | undefined {
  try {
    const raw = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
    const scripts: Record<string, string> = {};
    if (typeof raw.scripts === 'object' && raw.scripts !== null) {
      for (const [k, v] of Object.entries(raw.scripts)) if (typeof v === 'string') scripts[k] = v;
    }
    return { name: typeof raw.name === 'string' ? raw.name : undefined, packageManager: raw.packageManager, scripts };
  } catch {
    return undefined;
  }
}

/** The package script `command` runs (`pnpm build`, `npm run build`, `yarn run build`), if any. */
export function scriptName(command: readonly string[], scripts: Record<string, string>): string | undefined {
  const [pm, first, second] = command;
  if (!MANAGERS.has(pm ?? '')) return undefined;
  const name = first === 'run' || first === 'run-script' ? second : first;
  return name !== undefined && Object.hasOwn(scripts, name) ? name : undefined;
}

/** One-service deck for `command`, run in `cwd`. */
export function runDeck(command: readonly string[], at: string): ResolvedDeck {
  if (command.length === 0 || command[0] === '') throw new StartError('devdeck: run needs a command, for example `devdeck run pnpm build`.');
  // git reports the real path (/private/var on macOS), so compare against the real cwd.
  const cwd = realpathSync(at);
  const root = repoRoot(cwd);
  const here = readPackage(cwd);
  const top = root === cwd ? here : readPackage(root);
  const script = scriptName(command, here?.scripts ?? {});
  const name = script ?? basename(command[0] ?? 'run');
  const { kind, port } = classifyScript(script !== undefined ? (here?.scripts[script] ?? '') : command.join(' '));
  const packageManager = detectPackageManager(top?.packageManager, (file) => existsSync(join(root, file)));
  const host = kind === 'convex' ? '127.0.0.1' : 'localhost';
  const service = {
    id: uniqueId(name, new Set()),
    label: titleCase(name),
    dir: relative(root, cwd) || '.',
    kind,
    command: [...command],
    pty: true,
    ...(port ? { port, url: `http://${host}:${port}` } : {}),
  };
  return {
    source: 'global',
    root,
    warnings: [],
    config: { title: deckTitle(top?.name, root), root, packageManager, services: [service] },
  };
}

/** The word in the header after the title: the script name, else RUN. */
export const runMode = (deck: ResolvedDeck): string => {
  const command = deck.config.services[0]?.command ?? [];
  return /^[\w:.-]+$/.test(deck.config.services[0]?.id ?? '') && MANAGERS.has(command[0] ?? '') ? (deck.config.services[0]?.id ?? 'run') : 'run';
};

/** A shell's exit status for how the command ended: its code, or 128 plus the signal number. */
export function exitStatus(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  const n = signal ? constants.signals[signal] : undefined;
  return typeof n === 'number' ? 128 + n : 1;
}

const seconds = (ms: number): string => (ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);

/** What stays in the terminal after the deck closes: the command's output, then one summary line. */
export function finalOutput(lines: readonly string[], command: readonly string[], status: number, ms: number, peakMb: number): string {
  const verdict = status === 0 ? 'finished' : `failed with exit code ${status}`;
  const peak = peakMb > 0 ? `, peak memory ${peakMb >= 1024 ? `${(peakMb / 1024).toFixed(1)} GB` : `${Math.round(peakMb)} MB`}` : '';
  const body = lines.length > 0 ? `${lines.join('\n')}\n` : '';
  return `${body}devdeck: ${command.join(' ')} ${verdict} in ${seconds(ms)}${peak}\n`;
}
