// Builds the blind judging packets for the three panels.
//   node build-packets.mjs --set <name> [--config ../copy-panel.config.json]
// Reads proposals/*.json matching the set's pattern, writes
// P<n>/packet-<set>-<chunk>.json (blind, own A/B order per panel),
// key/<set>.json (driver only) and key/<set>-auto.json (house-rule-only changes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const CONFIG_PATH = path.resolve(HERE, arg('--config', '../copy-panel.config.json'));
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SET_NAME = arg('--set');
const set = cfg.sets.find((s) => s.name === SET_NAME);
if (!set) { console.error(`--set must be one of: ${cfg.sets.map((s) => s.name).join(', ')}`); process.exit(1); }
const PANELS = cfg.panels ?? ['P1', 'P2', 'P3'];
const PROPOSALS = path.resolve(path.dirname(CONFIG_PATH), cfg.proposals ?? 'proposals');
const CHUNK = set.chunk ?? 200;

const surfaceOf = (r) => {
  if (r.surface) return r.surface;
  if (set.surface) return set.surface;
  if (/^option/.test(r.field)) return 'answer option';
  if (r.field === 'text' || r.field === 'question') return 'question';
  if (/intro/i.test(r.field)) return 'intro (read aloud)';
  if (/headline|body|recap/i.test(r.field)) return 'recap (read aloud)';
  if (/name/i.test(r.field)) return 'name';
  return 'screen text';
};

// A change that only applies a house rule (dash, spelling, casing) is not a
// judgement call: it passes without a panel and is labelled so.
const RULES = (cfg.houseRuleNormalise ?? []).map(([from, to]) => [new RegExp(from, 'gi'), to]);
const norm = (t) => {
  let s = String(t ?? '').toLowerCase();
  for (const [re, to] of RULES) s = s.replace(re, to);
  return s.replace(/([a-z])i[sz](e|ed|es|ing|ation)\b/g, '$1is$2').replace(/[—–]|\s-\s/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
};
const isTest = (id) => /__tests__|\.test\.|\.spec\.|\/e2e\//.test(String(id));
const pathOf = (r) => r.path ?? (/[\\/].+\.\w+(:\d+(-\d+)?)?$/.test(String(r.id)) ? String(r.id).replace(/:\d+(-\d+)?$/, '') : null);
const mustKeepFor = (file, surface, old) => (cfg.mustKeep ?? [])
  .filter((m) => new RegExp(m.match).test(file) && (!m.surface || m.surface === surface))
  .flatMap((m) => m.keywords.filter((k) => String(old).toLowerCase().includes(k.toLowerCase())));

const read = (f) => JSON.parse(fs.readFileSync(path.join(PROPOSALS, f), 'utf8'));
const files = fs.readdirSync(PROPOSALS).filter((f) => f.endsWith('.json') && new RegExp(set.match).test(f)).sort();
const items = [];
const auto = [];
for (const file of files) {
  const rows = read(file);
  const stems = new Map(rows.filter((r) => r.field === 'text' || r.field === 'question').map((r) => [r.id, r.new]));
  for (const r of rows) {
    if (r.field === 'glossary' || r.field === 'call') continue;
    if (!r.new || r.old === r.new) continue;
    if (set.skipTests && isTest(r.id)) continue;
    const base = { file, id: r.id, path: pathOf(r), field: r.field, old: r.old, new: r.new };
    if (set.autoHouseRule && norm(r.old) === norm(r.new)) { auto.push(base); continue; }
    const surface = surfaceOf(r);
    items.push({
      ...base, surface,
      context: r.context ?? (surface === 'answer option' && stems.get(r.id) ? `Answers the question: "${stems.get(r.id)}"` : String(r.id)),
      mustKeep: mustKeepFor(file, surface, r.old),
    });
  }
}
if (cfg.callsSet === SET_NAME) {
  for (const c of cfg.calls ?? []) items.push({ file: 'calls', id: c.id, path: null, field: 'call', surface: 'decision', context: c.context, versions: c.versions, title: c.title });
}

// Deterministic shuffle per panel, so each panel sees its own A/B order.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const key = [];
const packets = Object.fromEntries(PANELS.map((p) => [p, []]));
items.forEach((it, i) => {
  const pid = `${SET_NAME}${String(i + 1).padStart(4, '0')}`;
  const versions = it.versions ?? [it.old, it.new];
  const entry = { pid, file: it.file, id: it.id, path: it.path, field: it.field, surface: it.surface, title: it.title, versions, orders: {} };
  PANELS.forEach((p, pi) => {
    const r = rng(i * 7919 + pi * 104729 + 17);
    const order = versions.map((_, j) => j).sort(() => r() - 0.5);
    entry.orders[p] = order; // order[k] = index into versions shown as letter k
    const labelled = Object.fromEntries(order.map((j, k) => [String.fromCharCode(65 + k), versions[j]]));
    packets[p].push({ pid, surface: it.surface, context: it.context, mustKeep: it.mustKeep?.length ? it.mustKeep : undefined, versions: labelled });
  });
  key.push(entry);
});

fs.mkdirSync(path.join(HERE, 'key'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'key', `${SET_NAME}.json`), JSON.stringify(key, null, 1));
fs.writeFileSync(path.join(HERE, 'key', `${SET_NAME}-auto.json`), JSON.stringify(auto, null, 1));
for (const p of PANELS) {
  fs.mkdirSync(path.join(HERE, p), { recursive: true });
  for (let c = 0; c * CHUNK < packets[p].length; c++) {
    fs.writeFileSync(path.join(HERE, p, `packet-${SET_NAME}-${c + 1}.json`), JSON.stringify(packets[p].slice(c * CHUNK, (c + 1) * CHUNK), null, 1));
  }
}
console.log(`${SET_NAME}: ${auto.length} house rule only, ${items.length} to judge, ${Math.ceil(items.length / CHUNK)} chunks per panel`);
