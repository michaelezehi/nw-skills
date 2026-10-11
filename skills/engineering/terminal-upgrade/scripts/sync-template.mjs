#!/usr/bin/env node
// Refresh template/ from a working Devdeck package (the tested development copy).
// Usage: node sync-template.mjs <path-to-devdeck-package>
import { cpSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source || !existsSync(join(source, 'src', 'cli.tsx'))) { console.error('Usage: node sync-template.mjs <path-to-devdeck-package>'); process.exit(2); }
const template = join(dirname(fileURLToPath(import.meta.url)), '..', 'template');
rmSync(template, { recursive: true, force: true });
cpSync(join(source, 'src'), join(template, 'src'), {
  recursive: true,
  filter: (p) => !/__tests__|__fixtures__/.test(p),
});
cpSync(join(source, 'tsconfig.json'), join(template, 'tsconfig.json'));
const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
pkg.name = 'devdeck';
pkg.scripts = { start: pkg.scripts.start, typecheck: pkg.scripts.typecheck };
delete pkg.devDependencies?.vitest;
writeFileSync(join(template, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
console.log(`Template refreshed from ${source}`);
