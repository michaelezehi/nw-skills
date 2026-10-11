#!/usr/bin/env node
// Detect a repo's long-running dev processes and print a Devdeck install plan as JSON.
// Usage: node detect.mjs [repoRoot]   (defaults to the git top level of cwd)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.argv[2] ?? gitRoot() ?? process.cwd();
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const pkg = readJson(join(root, 'package.json'));
if (!pkg) fail(`No package.json at ${root}. Devdeck wraps a Node dev script, so there is nothing to wrap here.`);

function gitRoot() {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch { return null; }
}
function fail(msg) { process.stdout.write(JSON.stringify({ ok: false, error: msg }, null, 2) + '\n'); process.exit(1); }

function packageManager() {
  const declared = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : '';
  if (['pnpm', 'npm', 'yarn', 'bun'].includes(declared)) return declared;
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/** Workspace globs from pnpm-workspace.yaml or package.json workspaces. Only `dir/*` and plain paths are expanded. */
function workspaceGlobs() {
  const yaml = join(root, 'pnpm-workspace.yaml');
  if (existsSync(yaml)) {
    // Only the `packages:` list. Items may sit at column 0; another top-level key ends it.
    const out = [];
    let inPackages = false;
    for (const line of readFileSync(yaml, 'utf8').split('\n')) {
      if (/^packages:\s*$/.test(line)) { inPackages = true; continue; }
      if (!inPackages || /^\s*(#.*)?$/.test(line)) continue;
      const item = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(#.*)?$/)?.[1];
      if (item) { if (!item.startsWith('!')) out.push(item); continue; }
      inPackages = false;
    }
    return out;
  }
  const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;
  return Array.isArray(ws) ? ws : [];
}
function expand(glob) {
  const clean = glob.replace(/\/$/, '');
  if (clean.endsWith('/**')) return expand(clean.slice(0, -3) + '/*');
  if (!clean.endsWith('/*')) return existsSync(join(root, clean, 'package.json')) ? [clean] : [];
  const base = clean.slice(0, -2);
  if (!existsSync(join(root, base))) return [];
  return readdirSync(join(root, base))
    .map((d) => `${base}/${d}`)
    .filter((d) => statSync(join(root, d)).isDirectory() && existsSync(join(root, d, 'package.json')));
}

const PORT_FLAG = /(?:--port|-p)[\s=]+(\d{2,5})\b/;
function classify(dir, script) {
  const portFlag = Number(script.match(PORT_FLAG)?.[1]) || undefined;
  const envPort = Number(script.match(/\bPORT=(\d{2,5})\b/)?.[1]) || undefined;
  if (/\bnext\s+dev\b/.test(script)) return { kind: 'next', port: portFlag ?? envPort ?? 3000 };
  if (/\bvite\b/.test(script) && !/\bvitest\b/.test(script)) return { kind: 'vite', port: portFlag ?? 5173 };
  if (/\bconvex\s+dev\b/.test(script)) return { kind: 'convex', port: convexPort(dir) };
  if (/\b(tsc|tsup)\b.*(--watch|\s-w\b)/.test(script)) return { kind: 'watch' };
  return { kind: 'node', port: envPort ?? portFlag };
}
function convexPort(dir) {
  try {
    const env = readFileSync(join(root, dir, '.env.local'), 'utf8');
    const url = env.match(/^CONVEX_URL\s*=\s*['"]?(\S+?)['"]?\s*$/m)?.[1];
    const port = url && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url) ? Number(new URL(url).port) : undefined;
    return port || undefined;
  } catch { return undefined; }
}

const titleCase = (s) => s.replace(/^@[^/]+\//, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
function shortId(name, dir, taken) {
  let id = basename(dir === '.' ? (pkg.name ?? 'app').replace(/^@[^/]+\//, '') : dir).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  const base = id; let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

const pm = packageManager();
const rootDev = pkg.scripts?.dev ?? '';
const warnings = [];
// A root dev script that is not a recursive workspace runner (say `turbo dev --filter=web`, or
// `dotenv -- next dev`) is what the user runs; keep it as one service instead of starting every package.
const POSITIVE_FILTER = /--filter[=\s]+['"]?(?!!)[^\s'"]+/;
const EXCLUDED = [...rootDev.matchAll(/--filter[=\s]+['"]?!([^\s'"]+)/g)].map((m) => m[1]);
const RECURSIVE = /\bturbo\s+(run\s+)?dev\b|\bpnpm\b[^&|;]*\s(-r|--recursive|--parallel)\b|\bnx\s+run-many\b|\blerna\s+run\b|\bnpm\s+run\s+dev\b[^&|;]*\s(--workspaces|-ws)\b|\byarn\s+workspaces\s+foreach\b/;
const globs = workspaceGlobs();
const rootIsRunner = !rootDev || (RECURSIVE.test(rootDev) && !POSITIVE_FILTER.test(rootDev));
if (rootIsRunner && /&&/.test(rootDev)) warnings.push(`The root dev script runs a setup step before the workspace runner (${rootDev.split('&&')[0].trim()}). Devdeck starts packages directly, so run that step yourself or add it as a service.`);
const layout = globs.length > 0 && rootIsRunner ? 'workspace' : 'single';
if (globs.length > 0 && !rootIsRunner) warnings.push('The root dev script is not a recursive workspace runner, so Devdeck runs it as one service. Remove it or switch to turbo/pnpm -r to get one card per package.');
const services = [];
const taken = new Set();

if (/devdeck/.test(rootDev)) warnings.push('The root dev script already starts Devdeck. Use the update path instead of installing again.');

if (layout === 'workspace') {
  const dirs = [...new Set(globs.flatMap(expand))].sort();
  for (const dir of dirs) {
    const p = readJson(join(root, dir, 'package.json'));
    const script = p?.scripts?.dev;
    if (!script || /devdeck/.test(dir) || /devdeck/.test(script)) continue;
    if (EXCLUDED.some((x) => x === p.name || x.replace(/^\.\//, '') === dir)) continue;
    const { kind, port } = classify(dir, script);
    const id = shortId(p.name ?? dir, dir, taken);
    services.push({ id, label: kind === 'watch' ? id : titleCase(p.name ?? dir), dir, kind, ...(port ? { port, url: `http://${kind === 'convex' ? '127.0.0.1' : 'localhost'}:${port}` } : {}), script });
  }
} else if (rootDev) {
  const { kind, port } = classify('.', rootDev);
  services.push({ id: shortId(pkg.name ?? 'app', '.', taken), label: titleCase(pkg.name ?? 'App'), dir: '.', kind, ...(port ? { port, url: `http://localhost:${port}` } : {}), command: [pm, 'run', 'dev:raw'], script: rootDev });
  if (/concurrently|npm-run-all|run-p\b|&\s/.test(rootDev)) warnings.push('The dev script runs several processes in one command. Devdeck will show them as one service; split them into separate scripts to get one card each.');
} else {
  fail('No dev script in the root package.json and no workspaces with dev scripts.');
}

if (services.length === 0) fail('No package has a dev script, so there is nothing for Devdeck to run.');
const byPort = new Map();
for (const s of services) if (s.port) byPort.set(s.port, [...(byPort.get(s.port) ?? []), s.id]);
for (const [port, ids] of byPort) if (ids.length > 1) warnings.push(`Port ${port} is claimed by ${ids.join(', ')}. Give each its own --port before relying on the dashboard.`);

const kindOrder = { next: 0, vite: 0, node: 1, convex: 2, watch: 3 };
services.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);

const packagesDir = layout === 'workspace' && globs.some((g) => /^packages\/\*/.test(g)) ? 'packages/devdeck' : 'tools/devdeck';
const plan = {
  ok: true,
  root,
  title: titleCase(pkg.name ?? basename(root)).toUpperCase(),
  packageManager: pm,
  layout,
  installDir: layout === 'workspace' ? packagesDir : 'tools/devdeck',
  rootDev,
  services,
  warnings,
};
process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
