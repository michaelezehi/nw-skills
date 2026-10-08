---
name: spend
description: Show a colour-coded terminal dashboard of AI coding spend across all Claude Code and Codex projects — cost, tokens, sessions by name, and per-model breakdown for a chosen day or range. Use when the user asks what they spent, how much a day cost, where their tokens went, or types /spend.
---

# Spend Dashboard

Renders a rich terminal dashboard of AI coding cost across every project, for a
chosen day or range. Pulls cost and token data from `codeburn`, then enriches it
with real session titles from Claude Code (`customTitle` / `lastPrompt`) and
Codex (`thread_name`) transcripts.

## Running it

Execute the script directly — it is self-contained via `uv` inline metadata and
installs `rich` on first run:

The user's primary interface is the `spend` command in their own terminal
(`~/.claude/bin/spend`, already on PATH). Prefer telling them to run it there —
a real TTY gives full truecolor and correct width.

When invoking it yourself:

```bash
FORCE_COLOR=1 spend [period]
```

`FORCE_COLOR=1` is required. Tool calls are not a TTY, so `rich` otherwise
strips every colour and the heat scale is lost — the whole point of the table.

Arguments are flexible: leading dashes are stripped and multi-word phrases are
joined, so `--3 days ago`, `3d` and `3` are identical. Pass what the user said
through verbatim; the parser handles it.

| Argument | Period shown |
|---|---|
| *(none)* / `--today` | today so far |
| `--yesterday` | the full previous day |
| `--3 days ago` / `--3d` / `3` | that single day, 1–90 back |
| `--week` / `--last week` / `7d` | rolling last 7 days, with a trend panel |
| `--month` | month to date |
| `2026-07-14` | any exact date |
| `--help` | the period menu, no data fetch |

Note `--week` is a rolling 7-day *range*, whereas `--a week ago` is the single
day 7 days back. They are different on purpose.

## What it shows

1. **Summary panel** — spend, total tokens, sessions, projects, API calls,
   output tokens, cache reads, and cost per session (or per day on ranges).
2. **Cost vs value** — API list price, what the subscription actually costs
   pro-rated for the period, and the difference.
3. **Daily trend** — horizontal bars per day. Only appears on multi-day ranges.
4. **Where it went** — cost by project, with share, session count, avg/session.
5. **Biggest sessions** — the top 12 by cost, *by name*, with project and model.
6. **By model** — cost, call count, and output tokens per model.

Colour is a heat scale relative to the largest row in each table: red is the
expensive end, cyan and grey are cheap.

**Every cost figure is API list price, not a bill.** The user is on a $200/mo
Claude Max plan, stored via `codeburn plan set custom --monthly-usd 200`. The
Cost vs value panel is the only place the real out-of-pocket number appears.
Never describe the headline spend as money they owe.

## Responsive layout

Columns drop as the terminal narrows, so names are never crushed:

| Width | What is dropped |
|---|---|
| < 96 | session bars |
| < 90 | project bars |
| < 88 | Model column |
| < 84 | Avg/sess column |
| < 76 | Calls column |

Bar width scales 14 → 10 → 6. If the user reports truncation, ask their
terminal width first — under ~76 columns nothing more can be shed.

## Notes

- First run in a session takes 30–90s — `codeburn` scans every transcript on
  disk, including Cursor's database. Subsequent runs are no faster; there is no
  cache. Warn the user if they seem to expect it to be instant.
- Sessions named `subagent · …` are spawned subagents, which carry no title.
- The numbers are estimates from local transcripts, not billing records. They
  will not match an invoice exactly.
- The table is the deliverable and the user reads it directly. In prose, point
  out only what the table does not make obvious: a runaway session, an unusual
  project, a spike.
