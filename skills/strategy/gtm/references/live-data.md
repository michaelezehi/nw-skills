# Live data

Before a run writes a placeholder for a company number (users, paying customers, usage, activation, revenue), check whether the project's own backend can answer it. Read only. Counts only.

Run this in the facts step of `on` and `all`, and in any single run whose "Needs" line asks for users, customers, usage, traction or revenue. Skip it when `facts.md` already holds a `live` block under 7 days old.

## 1. Find the sources

| Source | How you know it exists | Access |
|---|---|---|
| Convex | a `convex/` folder or `convex.json` | Self-hosted: the URL and admin key, through the project's own helper (often a deploy helper script that fetches the key from the server over ssh). Cloud: the prod deploy key in env. Deployments are listed in a deployments manifest, the project `CLAUDE.md` or its deploy notes |
| Stripe | `stripe` in package.json, a webhook route | Only with a read-only restricted key already in env. Never pull a live secret key from a server env file without asking |
| PostHog | `posthog` in the code | the PostHog MCP server when it is connected |
| SQL database | `DATABASE_URL`, Prisma, Drizzle | A read-only connection, `SELECT` only |

Use production. Never the local or dev deployment: it holds test data. If nothing is reachable, write one line in `facts.md`, `YYYY-MM-DD · live · not reachable: <reason>`, keep the placeholders, and say so in the reply. Never ask for a key in chat.

## 2. Read Convex safely

1. Write a scratch env file (`CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, mode 600) and unset `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY` and `CONVEX_DEPLOY_KEY_PROD` so the CLI cannot fall back to another deployment. Never print the key.
2. `bunx convex data --env-file <scratch>` lists the tables. That proves access.
3. `bunx convex data <table> --env-file <scratch> --limit 1000 --format jsonl > <dir>/<table>.jsonl` per table, into a scratch folder with mode 700. A very large `--limit` (100000) makes the server error; 1000 works. A table that returns exactly the limit is truncated: say so.
4. Admin queries guarded by `requireAdmin` need a signed-in user and fail from the CLI. Read the tables instead.
5. Never run a mutation or action, `convex run` on a function that writes, `convex import`, `convex env set` or a deploy.
6. Aggregate locally with `python3 -I`. Print counts, dates and plan names only: never emails, names, phone numbers, transcripts or answers.
7. Delete the scratch env file and the dumps when done.

## 3. What to measure

- Accounts, signups by month, the last signup date.
- Plans by count. **Paying means an active billing subscription** (a subscription id with status `active` or `trialing`), not the plan field. Count accounts on a paid plan with no billing customer separately as granted.
- Activation: accounts that did the core action at least once (created a survey, a project, a deal), and the completion rate of that action.
- Recency: the last core action, and accounts active in the last 30 and 90 days.
- Logged usage cost, if the project records it.
- Revenue only from the billing system. If it was not queried, write "not queried" and say how to confirm it.

Check stored counters (`surveyCount` on a user row, for example) against the real rows. They go stale.

## 4. Record it

Append to `facts.md` under a heading `## Live data, read from <source> on <YYYY-MM-DD>`, with one line on how it was read, then one fact per line: `YYYY-MM-DD · live · <fact>`. These are measurements, so they belong in `facts.md` beside the user's facts; never add an estimate here.

Every run uses the live lines in place of placeholders and cites them as `facts.md (live)`. The `on` index gets a "Live numbers" section with a `stats` block and the read date in its aside.
