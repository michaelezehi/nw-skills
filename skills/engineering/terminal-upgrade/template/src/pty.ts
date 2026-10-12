/**
 * node-pty, loaded on first use. It is a native module: when it cannot load (no prebuilt
 * binary for this platform, a broken install) the caller falls back to plain pipes, and
 * the command runs without taking input.
 */
import { accessSync, chmodSync, constants, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type * as NodePty from 'node-pty';

let loaded: typeof NodePty | null | undefined;

/**
 * node-pty's macOS spawn helper ships without its execute bit when the package manager
 * skipped install scripts (pnpm does by default), and every spawn then fails with
 * "posix_spawnp failed". Set it, once, where it is missing.
 */
export function ensureHelperExecutable(packageDir: string): void {
  const helper = join(packageDir, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
  if (!existsSync(helper)) return;
  try {
    accessSync(helper, constants.X_OK);
  } catch {
    try {
      chmodSync(helper, 0o755);
    } catch {
      // Read-only install: the spawn reports the failure itself.
    }
  }
}

/** The node-pty module, or null when it cannot load here. */
export function loadPty(): typeof NodePty | null {
  if (loaded !== undefined) return loaded;
  try {
    const require = createRequire(import.meta.url);
    ensureHelperExecutable(dirname(require.resolve('node-pty/package.json')));
    loaded = require('node-pty') as typeof NodePty;
  } catch {
    loaded = null;
  }
  return loaded;
}
