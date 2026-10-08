# Keep heuristics

Default: empty only what the user named. The scan prints a keep list so
the agent does not offer those tables as prune candidates.

## Always keep unless the user names the table

- Write-only tables (`insert`, no `query`). Ledgers, crawl logs, outbox.
- Seed or script-only tables (`seed/`, `sandbox/`, `scripts/`, `demo.`).
- Names matching `audit`, `log`, `ledger`, or `event`.
- Anything in `convex-prune.keep.json` at the convex tree or repo root.

```json
{ "tables": ["audit_logs", "seed_assets"] }
```

## Never keep as a prune candidate

- `_storage`, `_scheduled_functions`, and any name starting with `_`.
- A table with live `query` and `insert` in app code. That is in use.

## Two leftovers

| Class | How you know | Safe empty? |
|---|---|---|
| Unused in code | `scan-schema-usage.mjs` kind `unused` | Yes, after the user names it |
| Leftover on disk | live table absent from `schema.ts` | Yes. Cloud import residue. Drop after empty |

A table that is unused in code and also empty is the cheapest win: drop
it from `schema.ts`, deploy, then `delete_tables` if it still shows.

## x-unframed known unused (2026-08-29 code scan)

ATS: `ai_usage`, `chat_conversations_v2`, `chat_messages_v2`,
`chat_participants_v2`, `chat_message_reads`, `email_send_log`,
`hiring_outreach_enrichment_cache`, `ingest_cursors`, `resume_templates`.

HR: `compliance_packs`.

Re-run the scan. Do not treat this list as live emptiness.
