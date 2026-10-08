# Admin API used by the scripts

Unversioned. Backend and dashboard versions must match. Auth header is
`Authorization: Convex <admin-key>`. Never print the key.

Documented public subset: `POST /api/query|mutation|action`, export and
import, `/api/v1/*`. Everything below is the dashboard surface Optic
already calls.

| Job | Call |
|---|---|
| Table names | `POST /api/query` `_system/frontend/getTableMapping:default` |
| Row counts | `POST /api/query` `_system/frontend/tableSize:sizeOfAllTables` |
| Empty one page | `POST /api/mutation` `_system/frontend/clearTablePage` `{ tableName, cursor }` |
| Drop empty tables | `POST /api/delete_tables` `{ tableNames: ["foo"] }` |

`getTableMapping` is table-number → name. Parse **values**, not keys.

`sizeOfAllTables` is keyed by table name. The value may be a number or
`{ rowCount, size }`.

`clearTablePage` clears one page. Loop until `isDone` or a follow-up
count is 0. Cap the loop (`MAX_CLEAR_PAGES` in `prune-tables.mjs`).

`delete_tables` is for tables **not** in the current schema, or for a
table you already removed from `schema.ts` and deployed. Dropping a
table that is still in the schema leaves the declaration pointing at
nothing until the next deploy.

## Isolate the CLI

Same rule as convex-selfhost. Hide `.env.local`. Unset
`CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` when talking to self-host.

```bash
cat > /tmp/convex-prune.env <<EOF
CONVEX_SELF_HOSTED_URL=https://<host>:<client-port>
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin-key>
EOF
```

Read the key from the env var the manifest names (`adminKeyVar`). Do
not paste it into chat, logs, or the report.
