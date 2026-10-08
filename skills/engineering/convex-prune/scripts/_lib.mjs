/** Shared helpers for convex-prune. Never log an admin key or Authorization header. */

import { readFileSync } from "node:fs";

export function originHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid url)";
  }
}

export function requireAdminEnv() {
  const baseUrl =
    process.env.CONVEX_SELF_HOSTED_URL || process.env.CONVEX_URL || "";
  const adminKey =
    process.env.CONVEX_SELF_HOSTED_ADMIN_KEY ||
    process.env.CONVEX_ADMIN_KEY ||
    "";
  if (!baseUrl || !adminKey) {
    console.error(
      "Set CONVEX_SELF_HOSTED_URL (or CONVEX_URL) and CONVEX_SELF_HOSTED_ADMIN_KEY (or CONVEX_ADMIN_KEY). Values are not printed.",
    );
    process.exit(2);
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), adminKey };
}

export function extractSchemaTables(src) {
  return new Set(
    [...src.matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(/gm)].map(
      (m) => m[1],
    ),
  );
}

/**
 * getTableMapping returns table-number → name. Also accept an array of
 * names or `{ name }` objects. Never treat numeric keys as table names.
 */
export function parseTableMapping(value) {
  const names = new Set();
  const push = (candidate) => {
    if (typeof candidate === "string" && candidate && !candidate.startsWith("_")) {
      names.add(candidate);
    } else if (candidate && typeof candidate === "object") {
      const name = candidate.name ?? candidate.tableName;
      if (typeof name === "string" && name && !name.startsWith("_")) names.add(name);
    }
  };
  const body = unwrapUdf(value);
  if (Array.isArray(body)) body.forEach(push);
  else if (body && typeof body === "object") Object.values(body).forEach(push);
  return names;
}

export function parseTableSizes(value) {
  const sizes = new Map();
  const read = (name, raw) => {
    if (!name || name.startsWith("_")) return;
    if (typeof raw === "number") {
      sizes.set(name, { rowCount: raw, bytes: null });
      return;
    }
    if (!raw || typeof raw !== "object") return;
    const count = [raw.rowCount, raw.count, raw.numDocuments, raw.numRows].find(
      (n) => typeof n === "number",
    );
    const bytes = [raw.size, raw.sizeBytes, raw.totalSize].find(
      (n) => typeof n === "number",
    );
    sizes.set(name, { rowCount: count ?? null, bytes: bytes ?? null });
  };
  const body = unwrapUdf(value);
  if (Array.isArray(body)) {
    for (const entry of body) {
      if (!entry || typeof entry !== "object") continue;
      const name = entry.name ?? entry.tableName;
      if (typeof name === "string") read(name, entry);
    }
  } else if (body && typeof body === "object") {
    for (const [name, raw] of Object.entries(body)) read(name, raw);
  }
  return sizes;
}

export function unwrapUdf(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

export async function adminQuery(baseUrl, adminKey, path, args = {}) {
  return adminUdf(baseUrl, adminKey, "/api/query", path, args);
}

export async function adminMutation(baseUrl, adminKey, path, args = {}) {
  return adminUdf(baseUrl, adminKey, "/api/mutation", path, args);
}

async function adminUdf(baseUrl, adminKey, route, path, args) {
  const res = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      Authorization: `Convex ${adminKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, args, format: "convex_encoded_json" }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} failed: HTTP ${res.status}`);
  }
  if (!res.ok || body.status === "error") {
    const msg = body.errorMessage || body.message || `HTTP ${res.status}`;
    throw new Error(`${path} failed: ${msg}`);
  }
  return body;
}

export async function adminRest(baseUrl, adminKey, path, body) {
  const res = await fetch(`${baseUrl}/api/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Convex ${adminKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new Error(`POST /api/${path} failed: HTTP ${res.status}`);
  }
  return parsed;
}

export function loadKeepFile(path) {
  if (!path) return new Set();
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.tables ?? [];
  return new Set(list.filter((n) => typeof n === "string"));
}

export function defaultKeepReason(name, kind) {
  if (/audit|log|ledger|event/i.test(name)) return "ledger-shaped name";
  if (kind === "write_only") return "write-only ledger";
  if (kind === "seed_or_script_only") return "seed or script only";
  return null;
}

export function parseClearPage(value) {
  const body = unwrapUdf(value) ?? {};
  const isDone = body.isDone === true || body.done === true;
  const cursor = body.continueCursor ?? body.cursor ?? body.nextCursor ?? null;
  return { isDone, cursor: typeof cursor === "string" ? cursor : null };
}
