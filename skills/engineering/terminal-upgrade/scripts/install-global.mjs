#!/usr/bin/env node
// Install Devdeck machine-wide: ~/.devdeck/app, a `devdeck` command, a shell hook that turns
// `<pm> dev` at any repo root into Devdeck, and `.devdeck/` in the global git excludes.
// Nothing is written inside any repo.
// Usage: node install-global.mjs [--dry-run] [--uninstall]
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const dry = process.argv.includes('--dry-run');
const uninstall = process.argv.includes('--uninstall');
const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();
const deck = join(home, '.devdeck');
const app = join(deck, 'app');
const BEGIN = '# >>> devdeck >>>';
const END = '# <<< devdeck <<<';
const BLOCK = `${BEGIN}\n[ -f "$HOME/.devdeck/shell.sh" ] && . "$HOME/.devdeck/shell.sh"\n${END}\n`;
const IGNORE_BLOCK = '# Devdeck runtime (socket, pids)\n.devdeck/\n';
const zshrc = join(process.env.ZDOTDIR || home, '.zshrc');
const rcFiles = [zshrc, join(home, '.bashrc')].filter((f, i) => i === 0 || existsSync(f));
const done = [];
const step = (what, fn) => { done.push(what); if (!dry) fn(); };

/** The global excludes file git actually reads, as an absolute path, or null when unusable. */
function excludesFile() {
  try {
    const set = execFileSync('git', ['config', '--global', '--includes', '--type=path', '--get', 'core.excludesFile'], { encoding: 'utf8' }).trim();
    if (set) return isAbsolute(set) ? set : null;
  } catch { /* unset */ }
  return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'git', 'ignore');
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripBlock = (text) => text.replace(new RegExp(`\\n?${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}\\n?`, 'g'), '\n');

if (uninstall) {
  for (const rc of rcFiles) if (existsSync(rc) && readFileSync(rc, 'utf8').includes(BEGIN)) {
    step(`remove these lines from ${rc}:\n${indent(BLOCK)}`, () => writeFileSync(rc, stripBlock(readFileSync(rc, 'utf8'))));
  }
  const ex = excludesFile();
  // Only the block install wrote; a .devdeck/ line the user had before stays.
  if (ex && existsSync(ex) && readFileSync(ex, 'utf8').includes(IGNORE_BLOCK)) {
    step(`remove these lines from ${ex}:\n${indent(IGNORE_BLOCK)}`, () => writeFileSync(ex, readFileSync(ex, 'utf8').replace(IGNORE_BLOCK, '')));
  }
  if (existsSync(deck)) step(`delete ${deck} (your palette and overrides in ~/.config/devdeck stay)`, () => rmSync(deck, { recursive: true, force: true }));
  report('Devdeck is uninstalled. Open a new terminal; `pnpm dev` runs as before.');
  process.exit(0);
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) { console.error(`Devdeck needs Node 22 or later to run its terminal UI; this is Node ${process.versions.node}. Run the installer with a newer node.`); process.exit(1); }
const template = join(skill, 'template');
if (!existsSync(join(template, 'src', 'cli.tsx'))) { console.error(`Template missing at ${template}.`); process.exit(1); }

// Build beside the live copy and swap only after the install succeeds, so a failed update
// never leaves the hook pointing at a half-installed app.
const next = join(deck, 'app.next');
const old = join(deck, 'app.old');
step(`build Devdeck in ${next} and install its dependencies (npm, production only)`, () => {
  rmSync(next, { recursive: true, force: true });
  mkdirSync(next, { recursive: true });
  cpSync(join(template, 'src'), join(next, 'src'), { recursive: true });
  if (existsSync(join(template, 'scripts'))) cpSync(join(template, 'scripts'), join(next, 'scripts'), { recursive: true });
  for (const f of ['package.json', 'tsconfig.json']) cpSync(join(template, f), join(next, f));
  if (existsSync(join(template, 'package-lock.json'))) cpSync(join(template, 'package-lock.json'), join(next, 'package-lock.json'));
  try {
    execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: next, stdio: 'inherit' });
  } catch {
    rmSync(next, { recursive: true, force: true });
    console.error('npm install failed. The installed Devdeck, if any, is untouched.');
    process.exit(1);
  }
  if (!existsSync(join(next, 'node_modules', 'tsx', 'dist', 'cli.mjs'))) {
    rmSync(next, { recursive: true, force: true });
    console.error('tsx did not install. The installed Devdeck, if any, is untouched.');
    process.exit(1);
  }
});
// One bundled file plain node runs: the first frame in about 140 ms instead of 350, and no
// esbuild child process. Optional: when it cannot be built the launcher runs the source with tsx.
const bundle = join(app, 'dist', 'devdeck.mjs');
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
// Under the bundle a repo's devdeck.config.ts loads through node's own type stripping (22.18+).
const bundleNode = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 18);
let bundled = false;
if (bundleNode && existsSync(join(next, 'scripts', 'build.ts'))) {
  step(`bundle Devdeck into ${bundle}`, () => {
    const dev = JSON.parse(readFileSync(join(next, 'package.json'), 'utf8')).devDependencies ?? {};
    const tools = ['esbuild', 'string-width'].filter((name) => dev[name]).map((name) => `${name}@${dev[name]}`);
    try {
      execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--loglevel=error', ...tools], { cwd: next, stdio: 'inherit' });
      execFileSync(process.execPath, [join(next, 'node_modules', 'tsx', 'dist', 'cli.mjs'), '--tsconfig', join(next, 'tsconfig.json'), join(next, 'scripts', 'build.ts')], { cwd: next, stdio: 'ignore' });
      bundled = existsSync(join(next, 'dist', 'devdeck.mjs'));
    } catch {
      bundled = false;
    }
    if (!bundled) console.error('The bundle did not build; devdeck runs the source through tsx instead.');
  });
}
step(`swap it in as ${app}`, () => {
  rmSync(old, { recursive: true, force: true });
  if (existsSync(app)) renameSync(app, old);
  renameSync(next, app);
  rmSync(old, { recursive: true, force: true });
});
// The command runs on the node that installed it, not the one a repo pins through nvm or
// volta: a repo on Node 16 would otherwise crash Devdeck instead of starting its server.
step(`write the devdeck command to ${join(deck, 'bin', 'devdeck')} (runs on ${process.execPath})`, () => {
  mkdirSync(join(deck, 'bin'), { recursive: true });
  const shim = join(deck, 'bin', 'devdeck');
  writeFileSync(shim, [
    '#!/bin/sh',
    '# Devdeck launcher, written by /terminal-upgrade. Exit 78 means "cannot run here".',
    `NODE_BIN='${process.execPath.replace(/'/g, "'\\''")}'`,
    `BUNDLE=${bundled ? '"$HOME/.devdeck/app/dist/devdeck.mjs"' : "''"}`,
    'if [ ! -x "$NODE_BIN" ]; then',
    // Another node may be too old for the bundle's type stripping; the tsx path works on 22.
    '  BUNDLE=',
    '  NODE_BIN=$(command -v node) || { echo "devdeck: node not found" >&2; exit 78; }',
    '  "$NODE_BIN" -e "process.exit(Number(process.versions.node.split(\'.\')[0]) >= 22 ? 0 : 1)" || { echo "devdeck: needs Node 22 or later; run /terminal-upgrade update" >&2; exit 78; }',
    'fi',
    '[ -n "$BUNDLE" ] && [ -f "$BUNDLE" ] && exec "$NODE_BIN" "$BUNDLE" "$@"',
    // tsx reads the tsconfig of the directory it starts in, so a repo whose tsconfig sets
    // classic JSX would compile Devdeck to React.createElement with no React in scope.
    'exec "$NODE_BIN" "$HOME/.devdeck/app/node_modules/tsx/dist/cli.mjs" --tsconfig "$HOME/.devdeck/app/tsconfig.json" "$HOME/.devdeck/app/src/cli.tsx" "$@"',
    '',
  ].join('\n'));
  chmodSync(shim, 0o755);
});
step(`write the shell hook to ${join(deck, 'shell.sh')}`, () => cpSync(join(skill, 'scripts', 'shell', 'devdeck.sh'), join(deck, 'shell.sh')));
for (const rc of rcFiles) {
  const text = existsSync(rc) ? readFileSync(rc, 'utf8') : '';
  if (!text.includes(BEGIN)) step(`append to ${rc}:\n${indent(BLOCK)}`, () => appendFileSync(rc, (text.endsWith('\n') || !text ? '' : '\n') + BLOCK));
}
const ex = excludesFile();
if (!ex) {
  done.push('skip the global git excludes: core.excludesFile is a relative path. Add `.devdeck/` to it by hand.');
} else if (!existsSync(ex) || !/^\.devdeck\/?$/m.test(readFileSync(ex, 'utf8'))) {
  step(`append to ${ex}:\n${indent(IGNORE_BLOCK)}`, () => {
    mkdirSync(dirname(ex), { recursive: true });
    const cur = existsSync(ex) ? readFileSync(ex, 'utf8') : '';
    appendFileSync(ex, (cur && !cur.endsWith('\n') ? '\n' : '') + IGNORE_BLOCK);
  });
}
report('Open a new terminal (or `source ~/.zshrc`), then run `pnpm dev`, or any script such as `pnpm build`, at a repo root. `DEVDECK=0 pnpm build` skips it once.');

function indent(text) { return text.trimEnd().split('\n').map((l) => `      ${l}`).join('\n'); }
function report(nextStep) {
  console.log(`${dry ? 'Would' : 'Did'}:`);
  for (const d of done) console.log(`  - ${d}`);
  if (!dry) console.log(`\n${nextStep}`);
}
