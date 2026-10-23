# /gtm on

The full review in one command: read a repo, seed the facts, run the core sub-commands in waves, and hand back one PDF with a designed cover, an index of what the runs agree and disagree on, and every report in full.

Usage: `/gtm on [repo]`, where `[repo]` is a path, a folder name under your usual projects folder, or empty for the current project. Add `--all` to include personas, interviews and metrics.

`/gtm all [feature]` (and `/gtm:all`) is `on` for the current project with `--all`. When the input names an addition, also run `feature` on it in wave 2 and include it in the bundle.

## 1. Resolve the project

- Find the repo. Its `<gtm>` folder follows `references/conventions.md` (inside that repo, not the current directory).
- Read its `CLAUDE.md` files, `README`, pricing config (grep for price constants and plan names), landing and pricing page copy, and any recent PRDs about pricing, positioning or launch.
- If a Claude memory folder exists for the repo (`~/.claude/projects/<path with slashes as dashes>/memory/MEMORY.md`), read the index and the entries about the product, the team and pricing.

## 2. Seed `facts.md`

Write `<gtm>/facts.md` (append if it exists): one fact per line, `YYYY-MM-DD · seed · <fact>`, only facts those sources state. Cover: what the product does, who it is for, team, stage, live prices and price ideas, channels, sister products, product terms and banned words. Write "not recorded, use placeholders" for revenue, paying customers, usage, raise, runway and country when nothing states them and the live read below cannot reach them. Never estimate into this file.

Then read the live backend per `references/live-data.md` and append its `live` block, so every run starts from measured users, paying customers and usage instead of placeholders. Pass the live counts into every brief.

Ask the user only if the product cannot be identified at all.

## 3. Run the waves

Each sub-command runs as its own sub-agent (`model: "opus"`) so they work in parallel. Every brief carries: why the run exists and who reads it; the reference to follow (`~/.claude/skills/gtm/references/<sub>.md` and `conventions.md`); the `<gtm>` path; the one `.md` file it owns; "do not edit facts.md or any other file"; sourcing, placeholder and writing rules; "return the path and a 3-line summary". Each later brief names the earlier findings it must take a position on.

| Wave | Sub-commands | Waits for |
|---|---|---|
| 1 | validate, brief, competitors | nothing |
| 2 | mvp, pricing, plan, fundraise | brief and competitors |
| 3 | deck | everything in wave 2 |
| with `--all` | personas, interviews (wave 2), metrics (wave 3) | as listed |
| `all` with an addition named | feature (wave 2) | brief and competitors |

Skip a sub-command whose `.md` is under 7 days old unless the user asks for a fresh run; reuse it as an input instead.

Read each returned `.md` before accepting it: sourced claims, placeholders for company numbers, no dashes, within its word limit. Redispatch once with the gap list; after that fix it yourself.

When the runs are done, append to `facts.md` any new facts the user stated in this session.

## 4. Build the report

1. One report JSON per run, `<gtm>/<skill-name>.report.json`, per `references/report-spec.md`. These are faithful carry-overs; dispatch them to `model: "sonnet"` agents in batches of 3 or 4.
2. Write `<gtm>/index.report.json` yourself:
   - summary: the common verdict;
   - steps: what was read and run;
   - sections: every run in one line each (link `[run](<skill-name>.html)`), where the runs agree, where they pull apart, the numbers to fill before a rerun;
   - next;
   - `parts`: the run JSONs in wave order;
   - `cover`: `"cover.html"`.
3. Dispatch the cover agent per `references/cover.md` as soon as the index summary exists.
4. Render each run on its own and the bundle:
   ```bash
   node ~/.claude/skills/gtm/scripts/render-report.mjs <gtm>/<skill-name>.report.json <gtm>/<skill-name>.html
   node ~/.claude/skills/gtm/scripts/render-report.mjs <gtm>/index.report.json <gtm>/index.html --pdf "<gtm>/<project>-gtm-<YYYY-MM-DD>.pdf"
   ```
5. Read pages 1 to 3 of the PDF and the page with the widest table. Nothing may be cut off, and the cover must fill page 1.
6. `open` the PDF.

## 5. Reply

The common verdict in two lines, where the runs agree and disagree in a few bullets, the numbers to fill, and the PDF path. Keep the JSON files so the reports can be re-rendered.
