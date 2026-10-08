#!/usr/bin/env node
/**
 * Classify schema tables by Convex query/insert usage.
 *
 *   node scan-schema-usage.mjs --schema path/to/convex/schema.ts
 *   node scan-schema-usage.mjs --convex-dir path/to/convex
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { extractSchemaTables, defaultKeepReason, loadKeepFile } from "./_lib.mjs";

function usage() {
  console.error(
    "Usage: node scan-schema-usage.mjs --schema convex/schema.ts [--convex-dir convex] [--keep-file convex-prune.keep.json]",
  );
  process.exit(2);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

const schemaPath = arg("--schema");
const convexDir = arg("--convex-dir") || (schemaPath ? dirname(schemaPath) : "");
const keepFile = arg("--keep-file");
if (!schemaPath) usage();

const QUERY_RE =
  /(?:\.query|db\.query)\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g;
const INSERT_RE =
  /(?:\.insert|db\.insert)\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g;
const SEED_MARKERS = ["seed/", "sandbox/", "scripts/", "__tests__/", "demo."];
const SKIP_DIR = new Set(["_generated", "node_modules", ".git"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".ts") || name.endsWith(".js")) out.push(p);
  }
  return out;
}

const tables = extractSchemaTables(readFileSync(schemaPath, "utf8"));
const keep = loadKeepFile(keepFile);
const usageMap = {};
for (const t of tables) {
  usageMap[t] = { query: 0, insert: 0, files: new Set(), seedOnly: true };
}

for (const file of walk(convexDir)) {
  if (file.endsWith("schema.ts")) continue;
  const text = readFileSync(file, "utf8");
  const rel = relative(convexDir, file);
  const seedish = SEED_MARKERS.some((m) => rel.includes(m));
  for (const re of [QUERY_RE, INSERT_RE]) re.lastIndex = 0;
  let m;
  while ((m = QUERY_RE.exec(text))) {
    const row = usageMap[m[1]];
    if (!row) continue;
    row.query += 1;
    row.files.add(rel);
    if (!seedish) row.seedOnly = false;
  }
  while ((m = INSERT_RE.exec(text))) {
    const row = usageMap[m[1]];
    if (!row) continue;
    row.insert += 1;
    row.files.add(rel);
    if (!seedish) row.seedOnly = false;
  }
}

const rows = [...tables].sort().map((table) => {
  const u = usageMap[table];
  let kind = "unused";
  if (u.query || u.insert) {
    if (u.query && u.insert) kind = "read_write";
    else if (u.query) kind = "read_only";
    else kind = "write_only";
    if (u.seedOnly && kind !== "unused") kind = "seed_or_script_only";
  }
  const keepReason = keep.has(table)
    ? "keep-file"
    : defaultKeepReason(table, kind);
  return {
    table,
    kind,
    queries: u.query,
    inserts: u.insert,
    files: u.files.size,
    keep: Boolean(keepReason),
    keepReason,
  };
});

const pruneCandidates = rows.filter((r) => r.kind === "unused" && !r.keep);

console.log(
  JSON.stringify(
    {
      schema: schemaPath,
      convexDir,
      tableCount: rows.length,
      unused: pruneCandidates.map((r) => r.table),
      keep: rows.filter((r) => r.keep).map((r) => ({
        table: r.table,
        kind: r.kind,
        reason: r.keepReason,
      })),
      byKind: Object.fromEntries(
        ["unused", "write_only", "read_only", "seed_or_script_only", "read_write"].map(
          (k) => [k, rows.filter((r) => r.kind === k).map((r) => r.table)],
        ),
      ),
      rows,
    },
    null,
    2,
  ),
);
