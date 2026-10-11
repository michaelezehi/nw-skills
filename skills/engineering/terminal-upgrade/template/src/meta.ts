import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeckMeta } from './types.ts';

function gitBranch(root: string): string | undefined {
  try {
    const out = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/** CONVEX_DEPLOYMENT from an env file, with quotes and any inline `# comment` removed. */
export function readConvexDeployment(envText: string): string | undefined {
  for (const line of envText.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?CONVEX_DEPLOYMENT\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = (match[1] ?? '').replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
    return value || undefined;
  }
  return undefined;
}

function convexDeployment(root: string, convexDir: string | undefined): string | undefined {
  if (convexDir === undefined) return undefined;
  try {
    return readConvexDeployment(readFileSync(join(root, convexDir, '.env.local'), 'utf8'));
  } catch {
    return undefined;
  }
}

/** `convexDir` is the convex service's dir; without one there is no deployment to read. */
export function buildMeta(root: string, title: string, convexDir?: string): DeckMeta {
  return {
    title,
    startedAt: Date.now(),
    branch: gitBranch(root),
    node: process.version,
    root,
    convexDeployment: convexDeployment(root, convexDir),
  };
}
