/**
 * Reads a root `dev` script and says whether it only fans out to every workspace's own dev
 * script (turbo, pnpm -r, nx run-many, lerna, npm -ws, yarn workspaces foreach). Such a runner is
 * replaced by one card per package; anything else runs at the root as one service.
 */

export interface RootRunner {
  /** Package names, or `./dir` paths, that the runner's `!filters` leave out. */
  excludes: string[];
  /** Commands chained before the runner, which Devdeck does not run. */
  setup?: string;
}

const tokens = (command: string): string[] =>
  command
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/(['"])(.*?)\1/g, '$2'));

const LAUNCHERS = new Set(['turbo', 'nx', 'lerna']);

/** Drops `VAR=value` prefixes, cross-env, and npx / bunx / pnpm exec / yarn in front of a runner. */
function command(raw: string): string[] {
  const t = tokens(raw);
  if (t[0] === 'cross-env') t.shift();
  while (t[0] !== undefined && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) t.shift();
  if (t[0] === 'npx' || t[0] === 'bunx') t.shift();
  else if (t[0] === 'pnpm' && t[1] === 'exec') t.splice(0, 2);
  else if ((t[0] === 'pnpm' || t[0] === 'yarn') && LAUNCHERS.has(t[1] ?? '')) t.shift();
  return t;
}

/** The values of every `--filter` / `-F` flag, in `--filter=x` and `--filter x` forms. */
function filters(t: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const arg = t[i] ?? '';
    const joined = /^(?:--filter|-F)=(.*)$/.exec(arg);
    if (joined) out.push(joined[1] ?? '');
    else if (arg === '--filter' || arg === '-F') out.push(t[++i] ?? '');
  }
  return out.filter(Boolean);
}

const positional = (t: readonly string[]): string[] => t.filter((x) => !x.startsWith('-'));

function isTurboDev(t: readonly string[]): boolean {
  if (t[0] !== 'turbo') return false;
  const pos = positional(t.slice(1));
  const at = pos.findIndex((x) => x === 'run' || x === 'dev');
  return pos[at] === 'dev' || (pos[at] === 'run' && pos[at + 1] === 'dev');
}

function isFanOut(t: readonly string[]): boolean {
  const pos = positional(t);
  switch (t[0]) {
    case 'turbo':
      return isTurboDev(t);
    case 'pnpm':
      return t.some((x) => x === '-r' || x === '--recursive' || x === '--parallel') && pos.includes('dev');
    case 'nx':
      return t[1] === 'run-many';
    case 'lerna':
      return t[1] === 'run' && pos.includes('dev');
    case 'npm':
      return t.some((x) => x === '--workspaces' || x === '--ws' || x === '-ws') && pos.includes('dev');
    case 'yarn':
      return t[1] === 'workspaces' && t[2] === 'foreach';
    default:
      return false;
  }
}

/**
 * The runner a root dev script ends with, or undefined when the script is not a fan-out to
 * every workspace. A positive filter (`--filter=web`) picks packages, so it is not a fan-out;
 * an exclude-only filter (`--filter=!x`) still is, minus the excluded packages.
 */
export function rootRunner(script: string): RootRunner | undefined {
  const steps = script.split(/&&|;/).map((s) => s.trim());
  const last = steps.pop() ?? '';
  const t = command(last);
  if (!isFanOut(t)) return undefined;
  const values = filters(t);
  if (values.some((v) => !v.startsWith('!'))) return undefined;
  const setup = steps.filter(Boolean).join(' && ');
  return { excludes: values.map((v) => v.slice(1)).filter(Boolean), ...(setup ? { setup } : {}) };
}

/** Whether a workspace package is left out by the runner's `!filters`. */
export const isExcluded = (runner: RootRunner | undefined, name: string | undefined, dir: string): boolean =>
  runner !== undefined && runner.excludes.some((x) => x === name || x === `./${dir}`);
