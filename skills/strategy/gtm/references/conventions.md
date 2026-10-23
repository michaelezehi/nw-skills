<!-- Adapted from emotixco/claude-skills-founder shared/conventions.md (MIT, Copyright (c) 2026 Emotix). Changed: gtm folder, HTML report, house writing rules. -->

# Rules every /gtm sub-command follows

When a sub-command's own instructions are stricter, the sub-command wins.

## 1. The gtm folder

Sub-commands share context through one folder in the current project, written `<gtm>` in the references:

- `_r&d/gtm/` when the project has an `_r&d/` folder,
- otherwise `gtm/` at the project root.

Inside it:

- `facts.md` holds facts the user stated (stage, metrics, team, prices, the raise, dates) and numbers measured from the live backend per `references/live-data.md`. One fact per line, with the date it was recorded and the sub-command (or `live`) that recorded it.
- Every other `.md` file is the latest output of one sub-command, named after the upstream skill: `pricing-strategy.md`, `pitch-deck.md`, and so on.
- Every `.md` output has a matching `.html` report beside it.

Before you start:

1. Read `<gtm>/facts.md` and each file the sub-command lists under "Reads", when they exist. A missing file is normal. Don't mention it.
2. Read the project's own `CLAUDE.md` for product facts and copy rules (banned words, product terms). The project's rules win over these.
3. If the user's input contradicts a saved fact, the input wins. Say which saved fact it replaces.

When you finish:

1. Save the analysis to `<gtm>/<skill-name>.md`, replacing any earlier version. The first line is a comment: `<!-- /gtm <sub> · YYYY-MM-DD · input: <the input on one line> -->`.
2. Append any new facts the user stated in this run to `<gtm>/facts.md`. Only facts the user gave you. Never your estimates.
3. Build the HTML report (section 6).
4. End your reply with: the verdict in one or two lines, both paths, and at most two other `/gtm` sub-commands that would use this output next.

## 2. Missing input

Before you ask anything, read the files under "Reads" and the project's `CLAUDE.md`, and look at the code when the question is about the project itself (prices in config, plan names, what is built). Asking for something already saved or in the repo is the mistake this folder exists to prevent. For users, customers, usage and revenue, try the live backend per `references/live-data.md` first.

If the input is empty and nothing answers the "Needs" line, ask for those items in one message and stop. Say what you did find, so the user knows you looked.

If only some items are missing, go ahead. List your assumptions at the top of the output, each starting with "Assumption:".

## 3. Facts about the outside world

Competitor names, prices, funding rounds, market sizes, benchmarks and dates are claims. Each one needs a source.

- Search the web in this session. Put the source link next to the claim, with the date you checked it.
- If you can't find a source, write "Estimate:" and show the arithmetic, or write "Not found". Never present a guess as a fact.
- Benchmarks vary by segment and year. Give the source and the year, or mark the number as an estimate.

## 4. Facts about the user's company

Never invent the company's metrics, customers, quotes, testimonials, logos or team. Numbers measured from the live backend and recorded in `facts.md` as `live` are not invented; use them and cite `facts.md (live)`. When the output needs one and you don't have it, write a bracketed placeholder that says what goes there, for example `[Quote from a beta user about hours saved per week]`.

## 5. Writing

Follow `~/.claude/skills/unslop/SKILL.md`. The short version:

- Plain words. A number beats an adjective.
- Sentence case for headings.
- No em dashes or en dashes. Use a period, a comma or a colon. Search your text for U+2014 and U+2013 before saving and rewrite every sentence holding one. The report renderer refuses to build a page that contains one.
- None of: delve, leverage, utilize, robust, seamless, cutting-edge, game-changer, unlock, empower, elevate, supercharge, revolutionize, crucial, comprehensive.
- Don't end with a summary of what you already said.
- Stay under the sub-command's word limit (the `.md`; the HTML carries the same content, not more).

## 6. The report and PDF

Every run ends with a black-and-white report, as an HTML page and a PDF to share, opening on a cover designed by Fable 5.1.

1. Write `<gtm>/<skill-name>.report.json` following `references/report-spec.md`. Carry the analysis over faithfully: the verdict, the tables, the tiers, the sources. Do not add claims that are not in the `.md`.
2. Dispatch the cover agent per `references/cover.md` (`model: "fable"`), and set `"cover"` in the JSON to its file.
3. Render:
   ```bash
   node ~/.claude/skills/gtm/scripts/render-report.mjs <gtm>/<skill-name>.report.json <gtm>/<skill-name>.html --pdf "<gtm>/<project>-<skill-name>-<YYYY-MM-DD>.pdf"
   ```
4. Exit code 2 means a dash; fix the JSON and render again. Exit code 3 means no Chrome; say so and hand over the HTML.
5. Read page 1 and the page with the widest table in the PDF. Nothing may be cut off and the cover must fill page 1.
6. `open` the PDF. Keep the `.report.json` so the report can be re-rendered.
