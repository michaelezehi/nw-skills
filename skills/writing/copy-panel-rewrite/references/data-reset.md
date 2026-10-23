# Questionnaire data reset (optional step)

Only when the owner asked for it in Step 0. Built, tested, documented. Never
run by this skill, against any shared environment.

## Why it is coupled to the copy

If saved answers hold the option TEXT and a scorer reads that text, rewording
options orphans every saved answer: scores silently drop or misfile. So either

1. a legacy mapping (old option text to new) ships with the new wording, or
2. the reset ships in the same step as the new wording, never after it.

Write this ordering rule into the report and into project memory. On
production, the reseed with new wording and the reset run together, or the
reseed waits.

## Shape of the reset

- An internal or admin-only function, never public.
- `dryRun` defaults to true and prints a count per table.
- Pages through large tables in batches small enough for one transaction
  (a reviewer caught a batch that blew the transaction limit on the first
  run: page every table, including the small-looking ones).
- Deletes, for the questionnaires in scope: old definition versions below the
  current one, every response, every derived score or report, upgrade or
  "new version available" flags (or users see an upgrade prompt for nothing),
  cached context built from the answers.
- Never touches users, teams, accounts, billing, or another product's tables.
- Ends by rebuilding any cache that read the deleted data.
- A test seeds old and new definitions plus answers, runs the reset, and
  asserts only the current definitions remain and no answers exist.

## Report tab: data reset

The order the owner runs, one command per line:

1. Deploy the backend to the environment.
2. Reseed the questionnaire definitions with repair, so the new wording is in
   the rows.
3. Reset, dry run. Read the counts.
4. Reset, live.
5. Deploy the front end and any new audio.

And the production rule from above, in one sentence.

## Back up first, always

Before any live reset, in any environment, write a JSON dump of every row the
reset will delete (the owner asked for this "for posterity"):

- Self-hosted or cloud Convex: `npx convex export --path <backups>/<env>-<date>.zip`
  (a zip of JSONL per table) with that environment's URL and admin key.
- Local Convex that was already reset: the SQLite file keeps row history.
  Copy it aside with `sqlite3 -readonly <db> ".backup '<copy>'"`, then read
  each tombstone's previous revision (`documents` joined on `id` and
  `prev_ts`, table names from `_tables`) into one JSON file by table. Check
  the per-table counts match the reset's dry run.
- Keep backups in a gitignored folder; they hold real answers.
- Name the backup path in the report's reset tab.
