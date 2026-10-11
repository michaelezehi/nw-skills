#!/usr/bin/env node
// Inventory a repo for a TypeScript 7 upgrade. Read-only.
// Usage: node detect.mjs [repo-root] [--json]
// Prints, per package: its TypeScript spec and installed version, the scripts that run tsc,
// the tools that load the TypeScript JS API (which TS 7.0 does not ship), and the strategy.
// Also: install layout (hoisted or not), lockfiles, overrides pinning typescript, tsconfig
// options TS 7 rejects, Convex projects, CI steps that call tsc directly, Dockerfiles that
// build, Next ignoreBuildErrors, and which of the files an upgrade edits are already dirty.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const root = resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.expo', 'coverage', 'out', '.vercel', '.convex', '_generated', '.cache']);

// Packages that load the TypeScript compiler API (require('typescript'), resolveFrom(...,
// 'typescript'), readConfigFile). With any of them, `typescript` must stay 5.x/6.x and TS 7
// goes beside it under an alias. Expo 57 also pins typescript ~6.0.
const API_CONSUMERS = [
  'typescript-eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'eslint-config-next',
  'eslint-import-resolver-typescript', 'tsup', 'ts-jest', 'ts-morph', 'ts-node', 'vue-tsc', '@vue/language-core',
  'svelte-check', '@astrojs/check', '@angular/compiler-cli', 'rollup-plugin-dts', 'vite-plugin-dts', 'unplugin-dts',
  'vite-plugin-checker', 'typedoc', '@microsoft/api-extractor', 'fork-ts-checker-webpack-plugin', 'ts-loader',
  '@nestjs/cli', 'knip', 'ts-prune', 'tsd', 'dts-bundle-generator', 'react-docgen-typescript',
  '@storybook/react-docgen-typescript-plugin', 'expo', '@expo/cli', 'expo-module-scripts', 'nativewind',
  '@remotion/bundler', '@remotion/cli', 'cosmiconfig', 'ts-json-schema-generator', 'typescript-json-schema',
  '@graphql-codegen/cli', 'kysely-codegen',
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name), out);
    } else out.push(join(dir, e.name));
  }
  return out;
}

/** JSON with comments and trailing commas, as tsconfig allows. Null when unreadable. */
function readJsonc(file) {
  try {
    let s = readFileSync(file, 'utf8');
    s = s.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '');
    s = s.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function lineOf(file, needle) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const i = lines.findIndex((l) => l.includes(needle));
  return i < 0 ? undefined : i + 1;
}

/** The typescript version node resolves from `dir` (hoisting included), or undefined. */
function installedTs(dir, name = 'typescript') {
  try {
    const req = createRequire(join(dir, 'package.json'));
    const pkgPath = req.resolve(`${name}/package.json`);
    return { version: JSON.parse(readFileSync(pkgPath, 'utf8')).version, at: rel(dirname(pkgPath)) };
  } catch {
    return undefined;
  }
}

const files = walk(root);
const rel = (f) => relative(root, f) || '.';
const lockNames = ['pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'yarn.lock', 'package-lock.json'];

// Package manager and layout.
const rootPkg = readJsonc(join(root, 'package.json')) ?? {};
const rootLocks = lockNames.filter((l) => existsSync(join(root, l)));
const pm = rootPkg.packageManager?.split('@')[0]
  ?? (rootLocks.some((l) => l.startsWith('bun')) ? 'bun' : rootLocks.includes('pnpm-lock.yaml') ? 'pnpm' : rootLocks.includes('yarn.lock') ? 'yarn' : 'npm');
const npmrc = existsSync(join(root, '.npmrc')) ? readFileSync(join(root, '.npmrc'), 'utf8') : '';
const bunfig = existsSync(join(root, 'bunfig.toml')) ? readFileSync(join(root, 'bunfig.toml'), 'utf8') : '';
const hoisted = pm === 'pnpm' ? /shamefully-hoist\s*=\s*true|node-linker\s*=\s*hoisted/.test(npmrc)
  : pm === 'bun' ? !/linker\s*=\s*["']isolated["']/.test(bunfig)
    : true;
const nestedLocks = files.filter((f) => lockNames.some((l) => f.endsWith(`/${l}`)) && dirname(f) !== root).map(rel);
const notes = [];
if (rootLocks.length > 1) notes.push(`more than one lockfile at the root (${rootLocks.join(', ')}): work out which one CI and Docker install from before installing`);
if (existsSync(join(root, 'pnpm-workspace.yaml')) && pm !== 'pnpm') notes.push(`pnpm-workspace.yaml exists but the manager is ${pm}: check whether it is a leftover`);
if (nestedLocks.length) notes.push(`separate projects with their own lockfiles (install each on its own): ${nestedLocks.join(', ')}`);

// Overrides that pin typescript for the whole tree.
const pins = [];
for (const [where, obj] of [
  ['package.json overrides', rootPkg.overrides],
  ['package.json resolutions', rootPkg.resolutions],
  ['package.json pnpm.overrides', rootPkg.pnpm?.overrides],
]) {
  if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (/(^|>)typescript$/.test(k)) pins.push(`${where}: ${k} = ${JSON.stringify(v)}`);
}
const wsYaml = join(root, 'pnpm-workspace.yaml');
if (existsSync(wsYaml)) {
  readFileSync(wsYaml, 'utf8').split('\n').forEach((l, i) => {
    if (/^\s+["']?([^"'\s]*>)?typescript["']?\s*:/.test(l)) pins.push(`pnpm-workspace.yaml:${i + 1}: ${l.trim()}`);
  });
}

// Packages.
const packages = [];
for (const f of files.filter((f) => f.endsWith('/package.json'))) {
  const p = readJsonc(f);
  if (!p) continue;
  const dir = dirname(f);
  const deps = { ...p.dependencies, ...p.devDependencies };
  const tsSpec = deps.typescript;
  const nativeAlias = Object.entries(deps).find(([, v]) => typeof v === 'string' && /^npm:typescript@7/.test(v));
  const tscScripts = Object.entries(p.scripts ?? {}).filter(([, v]) => /(^|[\s;&|(/])(tsc|tsgo|vue-tsc)(\s|$)/.test(v)).map(([k, v]) => `${k}: ${v}`);
  const consumers = API_CONSUMERS.filter((c) => c in deps);
  const next = deps.next;
  const buildsNext = Object.values(p.scripts ?? {}).some((v) => /\bnext build\b/.test(v));
  // Next before 16.3 type-checks through the JS API inside `next build`.
  if (next && buildsNext && !/16\.(3|[4-9])|1[7-9]\.|[2-9]\d\./.test(next)) consumers.push(`next ${next} (API checker before 16.3)`);
  if (!tsSpec && tscScripts.length === 0 && !nativeAlias) continue;
  const isRoot = dir === root;
  const already = nativeAlias || /^(npm:typescript@)?[\^~]?7/.test(tsSpec ?? '');
  const strategy = already ? 'already on 7'
    : consumers.length > 0 ? 'side-by-side: keep typescript, add "@typescript/native": "npm:typescript@7.0.2"'
      : isRoot && hoisted && packages.length + 1 < files.filter((x) => x.endsWith('/package.json')).length
        ? 'side-by-side (hoisted root: shared tools load this copy)'
        : 'direct: typescript -> 7.0.2';
  const warn = [];
  if (strategy.startsWith('side-by-side') && !tscScripts.some((s) => s.startsWith('typecheck'))) warn.push('no typecheck script: add one');
  packages.push({ dir: rel(dir), name: p.name, typescript: tsSpec, installed: installedTs(dir), tscScripts, apiConsumers: consumers, next, convexCli: deps.convex, strategy, warn });
}

if (hoisted && packages.length > 1) notes.push('hoisted node_modules: the alias lands in the ROOT node_modules, so scripts call it by a path to the root; a package with no own typescript copy runs whatever the root .bin/tsc is; keep the ROOT typescript on 5.x/6.x if any shared tool (ts-api-utils, ESLint) loads it');

// tsconfig options TS 7 rejects or changes.
const REMOVED = [
  ['baseUrl', (v) => v !== undefined, 'removed: drop it, make paths "./"-relative'],
  ['alwaysStrict', (v) => v === false, 'false removed: drop it'],
  ['moduleResolution', (v) => typeof v === 'string' && /^(node|node10|classic)$/i.test(v), 'node/node10/classic removed: use bundler or nodenext'],
  ['module', (v) => typeof v === 'string' && /^(amd|umd|system|systemjs|none)$/i.test(v), 'removed module kind'],
  ['target', (v) => typeof v === 'string' && /^es(3|5)$/i.test(v), 'es5 removed: use es2015 or later'],
  ['downlevelIteration', (v) => v !== undefined, 'removed'],
  ['esModuleInterop', (v) => v === false, 'false removed'],
  ['allowSyntheticDefaultImports', (v) => v === false, 'false removed'],
];
const tsconfigs = [];
const noTypes = [];
for (const f of files.filter((f) => /\/tsconfig[^/]*\.json$/.test(f))) {
  const j = readJsonc(f);
  if (!j) {
    tsconfigs.push({ file: rel(f), issues: ['unreadable JSON'] });
    continue;
  }
  const co = j.compilerOptions ?? {};
  const issues = [];
  for (const [key, bad, note] of REMOVED) {
    if (key in co && bad(co[key])) issues.push(`${key}=${JSON.stringify(co[key])} (line ${lineOf(f, `"${key}"`) ?? '?'}): ${note}`);
  }
  if ('baseUrl' in co && co.paths) {
    for (const [alias, targets] of Object.entries(co.paths)) {
      for (const t of targets) if (!t.startsWith('./') && !t.startsWith('../') && !t.startsWith('/')) issues.push(`paths ${alias} -> "${t}": needs a ./ prefix once baseUrl goes`);
    }
  }
  if (!('types' in co) && !j.extends) noTypes.push(rel(f));
  if (issues.length) tsconfigs.push({ file: rel(f), issues });
}

// Convex: convex.json, a convex/ folder with its own tsconfig, or a convex dependency.
const convexDirs = new Set();
for (const f of files) {
  if (f.endsWith('/convex.json')) convexDirs.add(dirname(f));
  if (/\/convex\/tsconfig\.json$/.test(f)) convexDirs.add(dirname(dirname(f)));
}
const convex = [...convexDirs].map((d) => {
  const j = readJsonc(join(d, 'convex.json')) ?? {};
  const owner = packages.find((p) => resolve(root, p.dir) === d);
  return { dir: rel(d), typescriptCompiler: j.typescriptCompiler, sharesPackageWith: owner ? owner.strategy : 'no package.json here (uses a parent package)', installed: installedTs(d) };
});
const typecheckDisabled = files.filter((f) => f.endsWith('/package.json')).flatMap((f) => {
  const s = readFileSync(f, 'utf8');
  return /convex dev[^"]*--typecheck[ =]disable/.test(s) ? [`${rel(f)}: convex dev --typecheck disable`] : [];
});

// CI and Docker.
const ciDir = join(root, '.github', 'workflows');
const ciTsc = [];
if (existsSync(ciDir)) {
  for (const f of readdirSync(ciDir).filter((x) => /\.ya?ml$/.test(x))) {
    readFileSync(join(ciDir, f), 'utf8').split('\n').forEach((l, i) => {
      if (/(npx|bunx|pnpm exec|yarn|pnpm dlx)?\s*\btsc\b/.test(l) && !/run typecheck/.test(l)) ciTsc.push(`.github/workflows/${f}:${i + 1}: ${l.trim()}`);
    });
  }
}
const dockerfiles = files.filter((f) => /(^|\/)(Dockerfile[^/]*|[^/]*\.Dockerfile)$/.test(f)).flatMap((f) => {
  const s = readFileSync(f, 'utf8');
  return /next build|build:docker|run build/.test(s) ? [rel(f)] : [];
});
const ignoreBuildErrors = files.filter((f) => /\/next\.config\.[cm]?[jt]s$/.test(f)).flatMap((f) => {
  const n = lineOf(f, 'ignoreBuildErrors');
  return n ? [`${rel(f)}:${n}: ${readFileSync(f, 'utf8').split('\n')[n - 1].trim()}`] : [];
});

// Files an upgrade edits that another session already has dirty.
let dirty = [];
try {
  const status = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
  dirty = status.split('\n').filter(Boolean).map((l) => l.slice(3)).filter((p) => /(^|\/)(package\.json|tsconfig[^/]*\.json|Dockerfile[^/]*|[^/]*\.Dockerfile|next\.config\.[cm]?[jt]s|convex\.json)$/.test(p) || lockNames.some((l) => p.endsWith(l)) || p.startsWith('.github/workflows/'));
} catch {
  // Not a git repo.
}

const report = { root, packageManager: pm, hoisted, rootLockfiles: rootLocks, notes, dirtyUpgradeFiles: dirty, typescriptPins: pins, packages, tsconfigs, tsconfigsWithoutTypes: noTypes, convex, convexTypecheckDisabled: typecheckDisabled, ciTscCalls: ciTsc, dockerfiles, nextIgnoreBuildErrors: ignoreBuildErrors };

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  const out = [];
  out.push(`repo: ${root}`, `package manager: ${pm}${hoisted ? ' (hoisted node_modules)' : ''}  lockfiles: ${rootLocks.join(', ') || 'none'}`);
  for (const n of notes) out.push(`note: ${n}`);
  out.push(dirty.length ? `\nDIRTY files an upgrade would edit (another session holds them: wait, or leave them out):\n  ${dirty.join('\n  ')}` : '\ndirty upgrade files: none');
  out.push(`typescript pins: ${pins.length ? '\n  ' + pins.join('\n  ') : 'none'}`);
  out.push(`\npackages (${packages.length}):`);
  for (const p of packages) {
    out.push(`  ${p.dir}  [${p.name ?? '-'}]  typescript ${p.typescript ?? '-'}${p.installed ? ` (installed ${p.installed.version} at ${p.installed.at})` : ' (not installed)'}${p.next ? `  next ${p.next}` : ''}`);
    out.push(`    strategy: ${p.strategy}`);
    if (p.apiConsumers.length) out.push(`    loads the TS API: ${p.apiConsumers.join(', ')}`);
    for (const s of p.tscScripts) out.push(`    script ${s}`);
    for (const w of p.warn) out.push(`    warn: ${w}`);
  }
  out.push(`\ntsconfig changes (${tsconfigs.length} files):`);
  for (const t of tsconfigs) out.push(`  ${t.file}\n    ${t.issues.join('\n    ')}`);
  if (noTypes.length) out.push(`tsconfigs with no "types" (TS 7 defaults it to []; add "types": ["node", ...] if globals go missing): ${noTypes.length}`);
  out.push(`\nconvex: ${convex.length ? '' : 'none'}`);
  for (const c of convex) out.push(`  ${c.dir}  package: ${c.sharesPackageWith}  resolves typescript: ${c.installed ? `${c.installed.version} at ${c.installed.at}` : 'NONE (convex dev skips its typecheck)'}${c.typescriptCompiler ? `  typescriptCompiler=${c.typescriptCompiler}` : ''}`);
  for (const t of typecheckDisabled) out.push(`  ${t}`);
  out.push(`\nCI steps calling tsc directly: ${ciTsc.length ? '\n  ' + ciTsc.join('\n  ') : 'none'}`);
  out.push(`dockerfiles running a build: ${dockerfiles.length ? dockerfiles.join(', ') : 'none'}`);
  if (ignoreBuildErrors.length) out.push(`next ignoreBuildErrors:\n  ${ignoreBuildErrors.join('\n  ')}`);
  process.stdout.write(out.join('\n') + '\n');
}
