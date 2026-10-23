// Applies the verdicts: where the panels chose something other than the
// writers' text (which is what the code holds now), swap it in. An edit is
// applied only when the current text occurs exactly once in its file and is
// not code-shaped; everything else is reported for the driver to do by hand.
//   node apply-copy.mjs [--dry] [--root <repo root>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--root');
const ROOT = i > 0 ? path.resolve(process.argv[i + 1]) : execSync('git rev-parse --show-toplevel', { cwd: HERE }).toString().trim();
const DRY = process.argv.includes('--dry');
const final = JSON.parse(fs.readFileSync(path.join(HERE, 'FINAL.json'), 'utf8'));
const CODE_SHAPED = /[{};]|=>|^\s*\w+\s*:\s*['"`]|<\/?[A-Za-z]/;

const edits = final.filter((x) => x.final != null && x.versions.length === 2 && x.final !== x.versions[1] && x.file !== 'calls');
const done = [], skipped = [];
for (const e of edits) {
  const current = e.versions[1];
  const target = e.final === '(removed)' ? '' : e.final;
  if (!e.path) { skipped.push({ id: e.id, why: 'no file path: apply by hand (bank item or seed)', from: current, to: target }); continue; }
  const file = path.join(ROOT, e.path);
  if (!fs.existsSync(file)) { skipped.push({ id: e.id, why: 'file not found', from: current, to: target }); continue; }
  if (CODE_SHAPED.test(current) || CODE_SHAPED.test(target)) { skipped.push({ id: e.id, why: 'code-shaped text: apply by hand', from: current, to: target }); continue; }
  const src = fs.readFileSync(file, 'utf8');
  const hits = src.split(current).length - 1;
  if (hits !== 1) { skipped.push({ id: e.id, why: `current text found ${hits} times`, from: current, to: target }); continue; }
  if (!DRY) fs.writeFileSync(file, src.replace(current, () => target));
  done.push({ path: e.path, id: e.id, from: current, to: target, how: e.how });
}
fs.writeFileSync(path.join(HERE, 'APPLY-RESULT.json'), JSON.stringify({ done, skipped }, null, 1));
console.log(`${DRY ? 'dry: ' : ''}applied ${done.length}, skipped ${skipped.length}, calls ${final.filter((x) => x.file === 'calls').length} (apply by hand)`);
for (const s of skipped) console.log(' skip', s.id, '|', s.why);
