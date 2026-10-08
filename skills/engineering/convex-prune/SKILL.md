---
name: convex-prune
description: >-
  Inventory unused Convex tables and leftover Cloud-import tables, then
  prune them dry-run first. Works on any Convex tree in __new-world__.
  Use for "/convex-prune", "unused convex tables", "leftover tables",
  "prune unused documents", "empty unused tables", or "drop tables
  after schema removal".
---

# convex-prune

Find unused tables and leftover documents on a Convex backend, then
empty and drop only what the operator named. Dry-run is the default.
Apply needs `--confirm DELETE` from the human in this chat.

This is **not** `/convex-selfhost` (cut over off Cloud). This is
**not** `/convex-migration` (NestJS to Convex).

Operator copy passes `x-unframed/agent-skills/unslop/SKILL.md`. No em
dashes.

## Hard rules

1. **Dry-run first.** Print the table list. Stop. Wait for the human to
   name tables and say apply.
2. **Apply is `--apply --confirm DELETE`.** Anything else is a dry-run.
3. **Never print an admin key**, deploy key, or `Authorization` header.
   Report the host only.
4. **Isolate the CLI.** Hide `.env.local`. `env -u CONVEX_DEPLOYMENT
   -u CONVEX_DEPLOY_KEY`. Self-host flags and Cloud flags never mix.
5. **Staging before prod** when the project has staging.
6. **System tables stay.** Any name starting with `_` is refused.
7. **Keep ledgers and seed tables** unless the human names them. See
   [keep-heuristics.md](references/keep-heuristics.md).
8. **One backend per run.** ATS and HR are separate deployments.

## Scripts (run these, do not rewrite them)

All live under this skill's `scripts/`. `--schema` is the project's
`convex/schema.ts` (or `convex-out/convex/schema.ts`).

| Script | Job | Needs key? |
|---|---|---|
| `scan-schema-usage.mjs` | Unused / write-only / seed-only from code | no |
| `live-inventory.mjs` | Live tables vs schema, leftover, empty, largest | yes |
| `prune-tables.mjs` | Empty named tables. `--drop-empty` drops leftover | yes |

```bash
SKILL=~/.cursor/skills/convex-prune   # or this folder, if not installed

node $SKILL/scripts/scan-schema-usage.mjs \
  --schema <convex>/schema.ts \
  --convex-dir <convex>

CONVEX_SELF_HOSTED_URL=https://<host> \
CONVEX_SELF_HOSTED_ADMIN_KEY=… \
  node $SKILL/scripts/live-inventory.mjs --schema <convex>/schema.ts

CONVEX_SELF_HOSTED_URL=https://<host> \
CONVEX_SELF_HOSTED_ADMIN_KEY=… \
  node $SKILL/scripts/prune-tables.mjs \
    --schema <convex>/schema.ts \
    --tables foo,bar
```

Admin call shapes: [admin-api.md](references/admin-api.md).

## Sequence

Done when each step's bound is true. Do not skip ahead to apply.

### 0. Inventory the project

Find every Convex tree. Look for `convex.json`, then `schema.ts` beside
it. If `convex-deployments.manifest.json` exists, use those rows for
host + `adminKeyVar` names.

Bound: a written table of app, env, schema path, client URL host,
`adminKeyVar` name, mode (`cloud` / `self-hosted`). Human can reject it.

### 1. Code scan

Run `scan-schema-usage.mjs` on each tree. Report `unused` only. Mention
write-only and seed-only as keep.

Bound: JSON from the script, not a remembered list.

### 2. Live inventory

If the admin key env is set, run `live-inventory.mjs`. That is the only
way to see leftover tables that left `schema.ts` but still sit on disk
after a Cloud import.

If the key is missing, print the `adminKeyVar` name and stop on this
step. Do not guess counts.

Bound: leftover names and empty names from the script, or a written
"no key, live scan skipped".

### 3. Propose, then wait

One list the human can edit:

- Unused in code (from step 1)
- Leftover not in schema (from step 2)
- Existing document-cleanup scripts in that repo, if any (x-unframed:
  `hideAliasTestContent`, `cleanupIncompleteOnboarding`,
  `deleteEmptyUnusedCompany`, `company/purgeCompany`)

Stop. The next message must name tables or say abort.

### 4. Dry-run prune

`prune-tables.mjs --tables <named>` with no `--apply`. Show host,
`before` counts, `wouldDrop`.

Bound: dry-run JSON. `dryRun: true`.

### 5. Apply one backend

Only after the human says apply and `DELETE`. Same command with
`--apply --confirm DELETE`. Add `--drop-empty` only for leftover tables
already absent from `schema.ts`.

For unused-in-schema tables: empty documents here. Then remove the
`defineTable` from `schema.ts`, deploy, then `--drop-empty` if the
table still appears in a live inventory.

Bound: apply JSON. `remaining: false` or a note that another pass is
needed (`MAX_CLEAR_PAGES`).

## Project-local Convex scripts

Prefer the skill scripts. They do not need a functions deploy.

If the repo already has `scripts/inventoryUnusedTables` /
`scripts/pruneUnusedTables` (x-unframed ATS/HR), those are an
allowlisted alternative after they are deployed. Same dry-run rule.
`npx convex run` still follows Isolate the CLI.

## Done

A run is done when:

1. The inventory table was shown.
2. Unused and leftover lists came from the scripts.
3. Apply ran only on tables the human named, or the run stopped at dry-run.
4. The report names hosts, not keys, and says which tables were emptied
   or dropped.

Report the JSON. Do not say "pruned" without the apply output.
