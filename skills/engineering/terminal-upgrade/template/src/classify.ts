/**
 * Names and classifies a process by its command line: the tool a node script belongs to,
 * the macOS app a helper sits in, and whether it is a dev tool. Pure, and cached per line.
 */

/** Tools that run by name, from a node script path or as their own binary. */
const KNOWN_TOOLS = new Set([
  'tsc', 'tsgo', 'vitest', 'tsup', 'esbuild', 'convex', 'convex-local-backend', 'turbo', 'next', 'next-server',
  'tsx', 'vite', 'eslint', 'prettier', 'jest', 'webpack', 'remotion', 'chrome-headless-shell', 'storybook', 'playwright',
]);
/** Package managers: a reparented `pnpm run dev` or `npm exec vitest` is a dev tool too. */
const PACKAGE_MANAGERS = ['npm', 'npx', 'pnpm', 'yarn', 'bun', 'bunx'];
/** Runtimes and tools whose processes count as platform when outside the run. */
const DEV_TOOLS = new Set([...KNOWN_TOOLS, ...PACKAGE_MANAGERS, 'node']);
/** Package-manager verbs whose next word is the tool they run: `npm exec vitest`, `pnpm dlx convex`. */
const RUNNER_VERBS = new Set(['exec', 'x', 'dlx']);
/** Node flags that take the next argument as their value. */
const NODE_VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions', '-e', '--eval', '-p', '--print']);

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const stripExt = (file: string): string => file.replace(/\.(?:[cm]?js|[cm]?ts|tsx|jsx)$/, '');

/** The outermost macOS app bundle the executable sits in: `Brave Browser` for its helpers too. */
export function appName(command: string): string | undefined {
  const at = command.indexOf('.app/');
  if (at < 0 || !command.startsWith('/')) return undefined;
  const prefix = command.slice(0, at);
  // A second path or a flag before `.app/` means the bundle is an argument, not the executable.
  if (prefix.includes(' -') || prefix.includes(' /')) return undefined;
  return prefix.slice(prefix.lastIndexOf('/') + 1) || undefined;
}

/** The tool a node script path belongs to: `tsc` for typescript/lib/tsc.js, `tsup` for tsup/dist/cli. */
function toolFromScript(script: string): string {
  const path = script.replace(/^file:\/\//, '');
  const base = stripExt(basename(path));
  if (KNOWN_TOOLS.has(base)) return base;
  const bin = /\/node_modules\/\.bin\/([^/]+)$/.exec(path);
  if (bin) return bin[1]!;
  const at = path.lastIndexOf('/node_modules/');
  if (at >= 0) {
    const parts = path.slice(at + '/node_modules/'.length).split('/');
    const pkg = parts[0]!.startsWith('@') && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0]!;
    if (pkg && pkg !== '.pnpm') return pkg;
  }
  return base || 'node';
}

/** A readable name for a command line: the process title, the node script's tool, the app, the binary. */
export function hogName(command: string): string {
  const titled = /^(\S+) \(([^)]*)\)\s*$/.exec(command);
  if (titled) {
    const exe = basename(titled[1]!);
    return exe === 'node' ? (titled[2]!.trim().split(/\s+/)[0] || exe) : exe;
  }
  const app = appName(command);
  if (app) return app;
  const args = command.trim().split(/\s+/);
  const exe = basename(args[0] ?? '');
  // `npx tsc` and `npm exec vitest run` are named for the tool, not the package manager.
  const verb = exe === 'npx' || exe === 'bunx' ? 0 : ['npm', 'pnpm', 'yarn'].includes(exe) && RUNNER_VERBS.has(args[1] ?? '') ? 1 : -1;
  const tool = verb < 0 ? undefined : args.slice(verb + 1).find((a) => !a.startsWith('-'));
  if (tool) return basename(tool).replace(/(.)@.*$/, '$1');
  if (exe === 'node' || /^node\d+$/.test(exe)) {
    for (let i = 1; i < args.length; i++) {
      const arg = args[i]!;
      if (arg.startsWith('-')) {
        if (NODE_VALUE_FLAGS.has(arg)) i += 1;
        continue;
      }
      return toolFromScript(arg);
    }
    return 'node';
  }
  return exe || command;
}

function isDevTool(command: string, name: string): boolean {
  const exe = basename(command.trim().split(/\s+/)[0] ?? '');
  return DEV_TOOLS.has(exe) || DEV_TOOLS.has(name) || /chrome-headless-shell|remotion/.test(command);
}

function mentionsRoot(command: string, root: string): boolean {
  return root.length > 1 && command.includes(root);
}

export interface Classified {
  name: string;
  /** A dev tool or a command naming the repo root. */
  platform: boolean;
  app: string | undefined;
}

/** Past this many distinct command lines the cache starts over, so it cannot grow without end. */
const CLASSIFY_CACHE_MAX = 4096;
let classifyRoot = '';
const classifyCache = new Map<string, Classified>();

/**
 * Name, platform test and app bundle for a command line. Each is pure in the command and
 * the root, and a process keeps its command line, so a scan two seconds later reads them
 * from the cache instead of running the regexes and splits again.
 */
export function classify(command: string, root: string): Classified {
  if (root !== classifyRoot || classifyCache.size >= CLASSIFY_CACHE_MAX) {
    classifyCache.clear();
    classifyRoot = root;
  }
  let hit = classifyCache.get(command);
  if (!hit) {
    const name = hogName(command);
    hit = { name, platform: mentionsRoot(command, root) || isDevTool(command, name), app: appName(command) };
    classifyCache.set(command, hit);
  }
  return hit;
}

/** Test seam: how many command lines the classification cache holds. */
export function classifiedCount(): number {
  return classifyCache.size;
}
