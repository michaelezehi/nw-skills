/**
 * Bundle src/cli.tsx into dist/devdeck.mjs: one file plain node runs, with no tsx loader
 * and no esbuild service process alive for the session. React takes its production build
 * at bundle time, Ink's devtools branches fold away (they only run with DEV=true), and the
 * hashbang names node instead of tsx. scripts/build.ts writes it for `pnpm build`; the
 * bundle test and the benchmarks call `bundle()` with their own output path.
 */
import { build, type Plugin } from 'esbuild';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The package root: the nearest directory above this file holding package.json. Holds when this code is itself bundled, as the bench is. */
function packageDir(from: string): string {
  let dir = dirname(from);
  while (!existsSync(join(dir, 'package.json'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error(`no package.json above ${from}`);
    dir = up;
  }
  return dir;
}

export const PKG = packageDir(fileURLToPath(import.meta.url));

export const BUNDLE = join(PKG, 'dist', 'devdeck.mjs');

/**
 * Ink's devtools module imports react-devtools-core, an optional package nobody installs
 * here. Its module is only reached with DEV=true, but an ESM import hoists to the top of
 * the bundle, where node would resolve it at launch. An empty module stands in for it.
 */
const stubDevtools: Plugin = {
  name: 'stub-react-devtools-core',
  setup(api) {
    api.onResolve({ filter: /^react-devtools-core$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
    api.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  },
};

/**
 * Every width Ink measures goes through string-width, and so do wrap-ansi, widest-line and
 * cli-truncate under it. In the bundle they all get src/textWidth.ts, which answers from a
 * table for the deck's glyphs and defers to the real string-width otherwise; that one
 * import, from textWidth.ts itself, resolves as usual.
 */
const TEXT_WIDTH = join(PKG, 'src', 'textWidth.ts');
const fastWidth: Plugin = {
  name: 'fast-string-width',
  setup(api) {
    api.onResolve({ filter: /^string-width$/ }, (args) => (args.importer === TEXT_WIDTH ? undefined : { path: TEXT_WIDTH }));
  },
};

export interface BundleOptions {
  /** Packages left to node's own resolution at run time. */
  external?: string[];
}

/** Bundle `entry` (the CLI by default) into one file at `outfile`, and return that path. */
export async function bundle(outfile = BUNDLE, entry = join(PKG, 'src', 'cli.tsx'), options: BundleOptions = {}): Promise<string> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: options.external ?? [],
    plugins: [stubDevtools, fastWidth],
    // CommonJS modules inside Ink (signal-exit, yoga's loader) require node builtins by name; an ESM file has no require of its own.
    banner: { js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);" },
    define: { 'process.env.DEV': '"false"', 'process.env.NODE_ENV': '"production"' },
    // cli.tsx still assigns NODE_ENV for the tsx path; in the bundle the constant wins.
    logOverride: { 'assign-to-define': 'silent' },
    write: false,
    logLevel: 'warning',
  });
  const code = result.outputFiles[0]!.text.replace(/^#!.*\n/, '#!/usr/bin/env node\n');
  mkdirSync(dirname(outfile), { recursive: true });
  writeFileSync(outfile, code);
  chmodSync(outfile, 0o755);
  return outfile;
}
