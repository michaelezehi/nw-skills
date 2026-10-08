#!/usr/bin/env node
/**
 * Diff live Convex tables against schema.ts.
 *
 *   CONVEX_SELF_HOSTED_URL=… CONVEX_SELF_HOSTED_ADMIN_KEY=… \
 *     node live-inventory.mjs --schema path/to/convex/schema.ts
 */
import { readFileSync } from "node:fs";
import {
  adminQuery,
  extractSchemaTables,
  loadKeepFile,
  originHost,
  parseTableMapping,
  parseTableSizes,
  requireAdminEnv,
} from "./_lib.mjs";

function usage() {
  console.error(
    "Usage: node live-inventory.mjs --schema convex/schema.ts [--keep-file convex-prune.keep.json]",
  );
  process.exit(2);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

const schemaPath = arg("--schema");
if (!schemaPath) usage();
const { baseUrl, adminKey } = requireAdminEnv();
const schema = extractSchemaTables(readFileSync(schemaPath, "utf8"));
const keep = loadKeepFile(arg("--keep-file"));

const mappingBody = await adminQuery(
  baseUrl,
  adminKey,
  "_system/frontend/getTableMapping:default",
);
let sizesBody = {};
try {
  sizesBody = await adminQuery(
    baseUrl,
    adminKey,
    "_system/frontend/tableSize:sizeOfAllTables",
  );
} catch {
  sizesBody = {};
}

const liveNames = parseTableMapping(mappingBody);
const sizes = parseTableSizes(sizesBody);
const leftover = [...liveNames].filter((name) => !schema.has(name)).sort();
const missing = [...schema].filter((name) => !liveNames.has(name)).sort();
const sized = [...liveNames]
  .map((name) => {
    const size = sizes.get(name) ?? { rowCount: null, bytes: null };
    return {
      table: name,
      rowCount: size.rowCount,
      bytes: size.bytes,
      leftover: !schema.has(name),
      keep: keep.has(name),
    };
  })
  .sort((a, b) => (b.rowCount ?? -1) - (a.rowCount ?? -1));

console.log(
  JSON.stringify(
    {
      host: originHost(baseUrl),
      schema: schemaPath,
      schemaTables: schema.size,
      liveUserTables: liveNames.size,
      leftoverNotInSchema: leftover.filter((name) => !keep.has(name)),
      leftoverKept: leftover.filter((name) => keep.has(name)),
      inSchemaNotLive: missing,
      emptyLive: sized
        .filter((row) => row.rowCount === 0 && !row.keep)
        .map((row) => row.table),
      largest: sized.slice(0, 25),
    },
    null,
    2,
  ),
);
