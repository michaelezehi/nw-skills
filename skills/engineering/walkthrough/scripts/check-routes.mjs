#!/usr/bin/env node
// Every `route:` and `ctaRoute:` in the story files must be a real Next.js
// App Router page. Usage:
//   node check-routes.mjs <stories file or dir> <app dir>
// Prints each missing route and "N missing". Exit 1 when any are missing.
// Route groups `(name)` are ignored; dynamic segments `[id]` match any segment.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [storiesPath, appDir] = process.argv.slice(2);
if (!storiesPath || !appDir) {
  console.error('usage: check-routes.mjs <stories file or dir> <app dir>');
  process.exit(2);
}

function files(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { recursive: true })
    .map((f) => join(path, String(f)))
    .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f) && statSync(f).isFile());
}

const routes = new Set();
for (const file of files(storiesPath)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(?:route|ctaRoute)\s*:\s*['"`]([^'"`]+)['"`]/g)) {
    routes.add(m[1].split('?')[0].replace(/\/+$/, '') || '/');
  }
}

// Every page as a list of segments, groups removed.
const pages = [];
for (const f of readdirSync(appDir, { recursive: true }).map(String)) {
  if (!/(^|\/)page\.(tsx|ts|jsx|js|mdx)$/.test(f)) continue;
  const segs = f.split('/').slice(0, -1).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
  pages.push(segs);
}

function matches(route) {
  const segs = route.split('/').filter(Boolean);
  return pages.some((page) => {
    if (page.some((s) => s.startsWith('[...') || s.startsWith('[[...'))) {
      const fixed = page.findIndex((s) => s.startsWith('[...') || s.startsWith('[[...'));
      return page.slice(0, fixed).every((s, i) => s === segs[i] || /^\[.+\]$/.test(s));
    }
    return page.length === segs.length && page.every((s, i) => s === segs[i] || /^\[.+\]$/.test(s));
  });
}

const missing = [...routes].filter((r) => !matches(r)).sort();
for (const r of missing) console.log(`missing: ${r}`);
console.log(`${missing.length} missing`);
process.exit(missing.length ? 1 : 0);
