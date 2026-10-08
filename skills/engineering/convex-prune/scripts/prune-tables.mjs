#!/usr/bin/env node
/**
 * Empty named tables, then optionally drop them. Dry-run by default.
 *
 *   CONVEX_SELF_HOSTED_URL=… CONVEX_SELF_HOSTED_ADMIN_KEY=… \
 *     node prune-tables.mjs --schema convex/schema.ts --tables a,b
 *
 *   … node prune-tables.mjs --schema convex/schema.ts --tables a,b \
 *       --apply --confirm DELETE --drop-empty
 */
import { readFileSync } from "node:fs";
import {
  adminMutation,
  adminQuery,
  adminRest,
  extractSchemaTables,
  loadKeepFile,
  originHost,
  parseClearPage,
  parseTableSizes,
  requireAdminEnv,
} from "./_lib.mjs";

const MAX_CLEAR_PAGES = 400;

function usage() {
  console.error(
    "Usage: node prune-tables.mjs --schema convex/schema.ts --tables a,b [--apply --confirm DELETE] [--drop-empty] [--keep-file file]",
  );
  process.exit(2);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

const schemaPath = arg("--schema");
const tablesArg = arg("--tables");
if (!schemaPath || !tablesArg) usage();

const apply = process.argv.includes("--apply");
const confirm = arg("--confirm");
const dropEmpty = process.argv.includes("--drop-empty");
const keep = loadKeepFile(arg("--keep-file"));
const schema = extractSchemaTables(readFileSync(schemaPath, "utf8"));
const { baseUrl, adminKey } = requireAdminEnv();

const requested = tablesArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const refused = [];
const tables = [];
for (const name of requested) {
  if (name.startsWith("_")) {
    refused.push({ table: name, reason: "system table" });
    continue;
  }
  if (keep.has(name)) {
    refused.push({ table: name, reason: "keep-file" });
    continue;
  }
  tables.push(name);
}

if (apply && confirm !== "DELETE") {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        host: originHost(baseUrl),
        message: "Refusing apply without --confirm DELETE.",
        tables,
        refused,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

async function rowCount(name) {
  try {
    const sizes = parseTableSizes(
      await adminQuery(
        baseUrl,
        adminKey,
        "_system/frontend/tableSize:sizeOfAllTables",
      ),
    );
    return sizes.get(name)?.rowCount ?? null;
  } catch {
    return null;
  }
}

const results = [];
for (const name of tables) {
  const before = await rowCount(name);
  const inSchema = schema.has(name);
  if (!apply) {
    results.push({
      table: name,
      inSchema,
      before,
      wouldClear: (before ?? 1) > 0,
      wouldDrop: dropEmpty && !inSchema,
    });
    continue;
  }

  let pages = 0;
  let cursor = null;
  let cleared = false;
  while (pages < MAX_CLEAR_PAGES) {
    const page = parseClearPage(
      await adminMutation(baseUrl, adminKey, "_system/frontend/clearTablePage", {
        tableName: name,
        cursor,
      }),
    );
    pages += 1;
    if (page.isDone) {
      cleared = true;
      break;
    }
    if (page.cursor == null) {
      const peek = await rowCount(name);
      cleared = peek === 0 || peek === null;
      break;
    }
    cursor = page.cursor;
  }

  let dropped = false;
  const after = await rowCount(name);
  if (dropEmpty && !inSchema && (after === 0 || after === null)) {
    await adminRest(baseUrl, adminKey, "delete_tables", { tableNames: [name] });
    dropped = true;
  }

  results.push({
    table: name,
    inSchema,
    before,
    after,
    pages,
    cleared,
    dropped,
    remaining: !cleared,
  });
}

console.log(
  JSON.stringify(
    {
      dryRun: !apply,
      host: originHost(baseUrl),
      schema: schemaPath,
      dropEmpty,
      refused,
      tables: results,
    },
    null,
    2,
  ),
);
