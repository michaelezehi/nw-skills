// Per-route first-load JS (gzip -6) for a Next 16 Turbopack build.
// usage: node first-load.mjs <app>/.next [routeFilter...]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';

const next = process.argv[2];
const filters = process.argv.slice(3);
const build = JSON.parse(readFileSync(join(next, 'build-manifest.json'), 'utf8'));
const root = new Set([...(build.rootMainFiles ?? []), ...(build.polyfillFiles ?? [])]);

const gz = new Map();
const size = (f) => {
  if (!gz.has(f)) {
    try { gz.set(f, gzipSync(readFileSync(join(next, f)), { level: 6 }).length); } catch { gz.set(f, 0); }
  }
  return gz.get(f);
};

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (e === 'page_client-reference-manifest.js') yield p;
  }
}

const rows = [];
for (const file of walk(join(next, 'server', 'app'))) {
  const ctx = { globalThis: {} };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(file, 'utf8'), ctx);
  for (const [route, m] of Object.entries(ctx.__RSC_MANIFEST ?? {})) {
    const files = new Set(root);
    for (const list of Object.values(m.entryJSFiles ?? {})) for (const f of list) files.add(f.replace(/^\/?_next\//, ''));
    const bytes = [...files].reduce((s, f) => s + size(f), 0);
    rows.push({ route, bytes });
  }
}
rows.sort((a, b) => a.route.localeCompare(b.route));
const shown = filters.length ? rows.filter((r) => filters.some((f) => r.route.includes(f))) : rows;
const kb = (b) => (b / 1024).toFixed(1);
const sorted = rows.map((r) => r.bytes).sort((a, b) => a - b);
console.log(`routes ${rows.length}  median ${kb(sorted[sorted.length >> 1])} KB  p90 ${kb(sorted[Math.floor(sorted.length * 0.9)])} KB  max ${kb(sorted.at(-1))} KB  root ${kb([...root].reduce((s, f) => s + size(f), 0))} KB`);
for (const r of shown) console.log(`${kb(r.bytes).padStart(8)} KB  ${r.route}`);
