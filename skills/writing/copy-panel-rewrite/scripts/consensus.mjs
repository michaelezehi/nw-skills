// Consensus across the blind panels.
//   node consensus.mjs --check     every panel has a verdict for every item
//   node consensus.mjs --round2    write round-2 packets for items with no 2-of-3 winner
//   node consensus.mjs --final     write FINAL.json (needs round-2 rankings where required)
//
// Verdicts: P*/verdicts-<set>-<n>.json, [{ pid, choice: "A" | "B" | ... | "WRITE", text?, reason }]
// Round 2:  P*/round2-verdicts.json, [{ pid, ranking: ["B", "A", "C"], reason }], best first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const j = (p) => JSON.parse(fs.readFileSync(path.join(HERE, p), 'utf8'));
const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const keyFiles = fs.readdirSync(path.join(HERE, 'key')).filter((f) => /\.json$/.test(f) && !/-auto\.json$|^round2\.json$/.test(f));
const key = keyFiles.flatMap((f) => j(`key/${f}`));
const PANELS = Object.keys(key[0]?.orders ?? { P1: 0, P2: 0, P3: 0 });
const NEED = Math.floor(PANELS.length / 2) + 1;

const verdicts = Object.fromEntries(PANELS.map((p) => {
  const m = new Map();
  const dir = path.join(HERE, p);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((x) => /^verdicts-.*\.json$/.test(x))) for (const v of j(`${p}/${f}`)) m.set(v.pid, v);
  return [p, m];
}));

if (process.argv.includes('--check')) {
  const missing = PANELS.map((p) => key.filter((k) => !verdicts[p].has(k.pid)).length);
  console.log(missing.every((n) => n === 0) ? 'verdicts-complete' : `missing ${PANELS.map((p, i) => `${p}:${missing[i]}`).join(' ')}`, key.length);
  process.exit(0);
}

function pick(k, p) {
  const v = verdicts[p].get(k.pid);
  if (!v) return null;
  const choice = String(v.choice).trim().toUpperCase();
  if (choice === 'WRITE') return v.text ? { text: norm(v.text), base: null, panel: p, reason: v.reason } : null;
  const base = k.orders[p][choice.charCodeAt(0) - 65];
  return base == null ? null : { text: k.versions[base], base, panel: p, reason: v.reason };
}

const results = key.map((k) => {
  const picks = PANELS.map((p) => pick(k, p)).filter(Boolean);
  const tally = new Map();
  for (const c of picks) tally.set(norm(c.text), [...(tally.get(norm(c.text)) ?? []), c]);
  const top = [...tally.values()].sort((a, b) => b.length - a.length)[0];
  return { k, picks, majority: top && top.length >= NEED ? top : null };
});

if (process.argv.includes('--round2')) {
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const r2key = [];
  const packets = Object.fromEntries(PANELS.map((p) => [p, []]));
  results.filter((r) => !r.majority).forEach((r, i) => {
    const cands = [...new Set(r.picks.map((c) => norm(c.text)))];
    const entry = { pid: r.k.pid, candidates: cands, orders: {} };
    PANELS.forEach((p, pi) => {
      const g = rng(i * 31 + pi * 977 + 5);
      const order = cands.map((_, x) => x).sort(() => g() - 0.5);
      entry.orders[p] = order;
      packets[p].push({ pid: r.k.pid, surface: r.k.surface, versions: Object.fromEntries(order.map((x, n) => [String.fromCharCode(65 + n), cands[x]])) });
    });
    r2key.push(entry);
  });
  fs.writeFileSync(path.join(HERE, 'key', 'round2.json'), JSON.stringify(r2key, null, 1));
  for (const p of PANELS) fs.writeFileSync(path.join(HERE, p, 'round2-packet.json'), JSON.stringify(packets[p], null, 1));
  console.log(`round2: ${r2key.length} items`);
  process.exit(0);
}

if (process.argv.includes('--final')) {
  const r2key = fs.existsSync(path.join(HERE, 'key', 'round2.json')) ? j('key/round2.json') : [];
  const r2 = Object.fromEntries(PANELS.map((p) => {
    const f = path.join(HERE, p, 'round2-verdicts.json');
    return [p, new Map(fs.existsSync(f) ? j(`${p}/round2-verdicts.json`).map((v) => [v.pid, v]) : [])];
  }));
  const out = results.map(({ k, picks, majority }) => {
    const base = { pid: k.pid, set: k.pid.replace(/\d+$/, ''), file: k.file, id: k.id, path: k.path, field: k.field, surface: k.surface, title: k.title,
      versions: k.versions, votes: picks.map((c) => ({ panel: c.panel, text: c.text, base: c.base, reason: c.reason })) };
    if (majority) return { ...base, final: majority[0].text, how: `${majority.length} of ${PANELS.length} panels`, winnerBase: majority[0].base };
    const rk = r2key.find((x) => x.pid === k.pid);
    if (!rk || PANELS.some((p) => !r2[p].has(k.pid))) return { ...base, final: null, how: 'awaiting round 2' };
    const score = rk.candidates.map(() => 0);
    const firsts = rk.candidates.map(() => 0);
    for (const p of PANELS) {
      const ranking = r2[p].get(k.pid).ranking.map((l) => rk.orders[p][String(l).toUpperCase().charCodeAt(0) - 65]);
      ranking.forEach((x, pos) => { if (x != null) score[x] += rk.candidates.length - pos; });
      if (ranking[0] != null) firsts[ranking[0]]++;
    }
    // Borda; ties go to more first places, then to a version the writers proposed.
    const order = rk.candidates.map((_, x) => x).sort((a, b) => score[b] - score[a] || firsts[b] - firsts[a]
      || (k.versions.indexOf(rk.candidates[b]) >= 0) - (k.versions.indexOf(rk.candidates[a]) >= 0));
    const win = rk.candidates[order[0]];
    return { ...base, final: win, how: firsts[order[0]] >= NEED ? `round 2, ${firsts[order[0]]} of ${PANELS.length} ranked it first` : `round 2, Borda ${score[order[0]]}`,
      winnerBase: k.versions.indexOf(win) >= 0 ? k.versions.indexOf(win) : null,
      round2: PANELS.map((p) => ({ panel: p, reason: r2[p].get(k.pid).reason })) };
  });
  for (const f of fs.readdirSync(path.join(HERE, 'key')).filter((x) => /-auto\.json$/.test(x))) {
    for (const a of j(`key/${f}`)) {
      out.push({ pid: null, set: f.replace(/-auto\.json$/, ''), file: a.file, id: a.id, path: a.path, field: a.field, surface: 'screen text',
        versions: [a.old, a.new], votes: [], final: a.new, how: 'house rule only', winnerBase: 1 });
    }
  }
  fs.writeFileSync(path.join(HERE, 'FINAL.json'), JSON.stringify(out, null, 1));
  const n = (f) => out.filter(f).length;
  console.log(`final ${out.length}: new kept ${n((o) => o.winnerBase === 1)}, old kept ${n((o) => o.winnerBase === 0)}, panel-written ${n((o) => o.final && o.winnerBase == null)}, unresolved ${n((o) => o.final == null)}`);
}
