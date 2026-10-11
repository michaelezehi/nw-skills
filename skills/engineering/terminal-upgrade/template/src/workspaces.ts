/**
 * Workspace globs: reads them from pnpm-workspace.yaml or package.json, and expands them into
 * package dirs. Scanning stays cheap: it never enters node_modules, dot dirs, dist or build.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const unquote = (s: string): string => s.trim().replace(/^(['"])(.*)\1$/, '$2').trim();

/** The entries of the top-level `packages:` list in pnpm-workspace.yaml, block or inline form. */
export function pnpmWorkspaceGlobs(yaml: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const text = line.replace(/\s+#.*$/, '');
    const item = /^\s*-\s*(.*)$/.exec(text);
    if (item) {
      if (inPackages) globs.push(unquote(item[1] ?? ''));
      continue;
    }
    if (/^\S/.test(text)) {
      const inline = /^packages\s*:\s*\[(.*)\]\s*$/.exec(text);
      if (inline) globs.push(...(inline[1] ?? '').split(',').map(unquote).filter(Boolean));
      inPackages = /^packages\s*:\s*$/.test(text);
    }
  }
  return globs.filter(Boolean);
}

/** package.json `workspaces`, as an array or as `{ packages: [...] }`. */
export function packageWorkspaceGlobs(workspaces: unknown): string[] {
  const list = Array.isArray(workspaces)
    ? workspaces
    : typeof workspaces === 'object' && workspaces !== null
      ? (workspaces as { packages?: unknown }).packages
      : undefined;
  return Array.isArray(list) ? list.filter((g): g is string => typeof g === 'string' && g !== '') : [];
}

export const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** Dirs a wildcard never enters. Dot dirs are skipped as well. */
const SKIP = new Set(['node_modules', 'dist', 'build']);
/** How many levels below its base a `**` reaches. */
export const GLOBSTAR_DEPTH = 4;

/** `{a,b}` alternatives expanded, nested groups included. No ranges. */
export function expandBraces(glob: string): string[] {
  const group = /\{([^{}]*)\}/.exec(glob);
  if (!group) return [glob];
  const head = glob.slice(0, group.index);
  const tail = glob.slice(group.index + group[0].length);
  return [...new Set((group[1] ?? '').split(',').flatMap((alt) => expandBraces(`${head}${alt}${tail}`)))];
}

const sub = (dir: string, name: string): string => (dir === '' ? name : `${dir}/${name}`);

function subdirs(root: string, dir: string): string[] {
  try {
    return readdirSync(join(root, dir), { withFileTypes: true })
      .filter((e) => !SKIP.has(e.name) && !e.name.startsWith('.'))
      .filter((e) => e.isDirectory() || (e.isSymbolicLink() && isDir(join(root, dir, e.name))))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

const segmentPattern = (seg: string): RegExp =>
  new RegExp(`^${seg.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);

function walk(root: string, dir: string, segs: readonly string[], out: Set<string>): void {
  const [seg, ...rest] = segs;
  if (seg === undefined) {
    if (existsSync(join(root, dir, 'package.json'))) out.add(dir || '.');
    return;
  }
  if (seg === '**') return globstar(root, dir, rest, out, 0);
  if (!/[*?]/.test(seg)) {
    if (isDir(join(root, sub(dir, seg)))) walk(root, sub(dir, seg), rest, out);
    return;
  }
  const pattern = segmentPattern(seg);
  for (const name of subdirs(root, dir)) if (pattern.test(name)) walk(root, sub(dir, name), rest, out);
}

function globstar(root: string, dir: string, rest: readonly string[], out: Set<string>, depth: number): void {
  walk(root, dir, rest, out);
  if (depth >= GLOBSTAR_DEPTH) return;
  for (const name of subdirs(root, dir)) globstar(root, sub(dir, name), rest, out, depth + 1);
}

/** Package dirs a glob names: `*`, `?`, `**` (up to four levels), `{a,b}` and plain paths. */
export function expandGlob(root: string, glob: string): string[] {
  const out = new Set<string>();
  for (const one of expandBraces(glob)) {
    const segs = one
      .replace(/^\.\//, '')
      .split('/')
      .filter((s) => s !== '' && s !== '.');
    walk(root, '', segs, out);
  }
  return [...out];
}

/** Every workspace package dir, sorted, with `!negated` globs taken out. */
export function workspaceDirs(root: string, globs: readonly string[]): string[] {
  const excluded = new Set(globs.filter((g) => g.startsWith('!')).flatMap((g) => expandGlob(root, g.slice(1))));
  const dirs = globs.filter((g) => !g.startsWith('!')).flatMap((g) => expandGlob(root, g));
  return [...new Set(dirs)].filter((d) => !excluded.has(d)).sort();
}
