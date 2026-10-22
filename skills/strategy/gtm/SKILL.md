---
name: gtm
description: Go-to-market toolkit for any project. Twelve sub-commands that validate an idea, test whether a new feature or offer earns its place in an existing product, write a product brief, map competitors, draft personas and interview scripts, triage an MVP, set pricing, plan a launch, pick metrics, prepare a raise and outline a pitch deck. Each run reads what the project already knows, sources every outside claim, saves the analysis and hands back a black-and-white PDF report with a cover designed by Fable 5.1. `/gtm on [repo]` runs the whole review on any repo and returns one shareable PDF. Use when the user types /gtm, "GTM:", "gtm pricing", "gtm on", or asks what to charge, who the competitors are, how to launch, whether an idea or a new feature holds up, or how to prepare a raise or a deck.
argument-hint: "[on <repo>|validate|feature|brief|competitors|personas|interviews|mvp|pricing|plan|metrics|fundraise|deck] [what you want looked at]"
---

# /gtm

Input: $ARGUMENTS

## Route

Read the first word of the input (also accept "GTM: pricing" and "gtm:pricing"). The `gtm:<sub-command>` commands call this skill the same way. Match it to a sub-command, then read that reference file and follow it exactly. Read `references/conventions.md` before any sub-command.

| Sub-command | Also matches | What it does | Reference |
|---|---|---|---|
| `all` | everything | Every sub-command on the current repo, in waves, into one PDF (same as `on` with `--all`; adds `feature` when the input names an addition) | `references/on.md` |
| `on` | full, review | The core review of a repo: facts, validate, brief, competitors, mvp, pricing, plan, fundraise, deck, an index, one PDF with a designed cover | `references/on.md` |
| `validate` | idea, validate-idea | 7-dimension scorecard, fatal questions, 3 cheap experiments, build/pivot/kill verdict | `references/validate.md` |
| `feature` | addition, new-feature, add | Validate something new being added to an existing product: five questions, scorecard, the cheapest test, build/test/park/kill | `references/feature.md` |
| `brief` | product-brief | Problem, audience, value proposition, 5 to 7 features, 90-day metrics, risks | `references/brief.md` |
| `competitors` | competitor-matrix, competition | 5 to 8 sourced competitors, feature matrix, gaps, threat ranking | `references/competitors.md` |
| `personas` | persona-gen | 3 buyer personas and a priority matrix | `references/personas.md` |
| `interviews` | user-interviews | 25-minute customer interview script and an analysis frame | `references/interviews.md` |
| `mvp` | mvp-scope, scope | Must, should, won't triage, launch criteria, the not-building list | `references/mvp.md` |
| `pricing` | price, pricing-strategy | 6 models scored, 3 tiers with prices, unit economics, launch pricing | `references/pricing.md` |
| `plan` | go-to-market, launch, gtm | Pre-launch, launch day and a 90-day growth plan on a small budget | `references/plan.md` |
| `metrics` | metrics-dashboard, kpis | The 5 numbers that matter at this stage and how to track them | `references/metrics.md` |
| `fundraise` | fundraise-prep, raise | Readiness, round size, investor targeting, 12-week timeline | `references/fundraise.md` |
| `deck` | pitch-deck, pitch | 12 slides with headline, content, visual and speaker notes | `references/deck.md` |

## No sub-command given

If the input is empty, or the first word matches nothing, print the table above as a menu (sub-command and what it does only), then add one line:

"Run one with `/gtm <sub-command> <what you want looked at>`, for example `/gtm pricing our phone call product`, or the whole review with `/gtm on <repo>`."

Then show what `<gtm>/` already holds in this project (per `references/conventions.md`), if anything, so the user can see which runs exist. Stop there.

## Every run

1. Resolve `<gtm>` for the current project and read `facts.md` plus the files the sub-command reads.
2. Look at the project itself before asking anything: `CLAUDE.md`, pricing config, plan names, landing copy.
3. Follow the sub-command reference. Search the web for every outside claim.
4. Save `<gtm>/<skill-name>.md`, append new user-stated facts to `facts.md`.
5. Write the report JSON per `references/report-spec.md`, have Fable 5.1 design the cover per `references/cover.md`, render HTML and PDF with `scripts/render-report.mjs`, open the PDF.
6. Reply with the verdict in one or two lines, the PDF path, and up to two next sub-commands.

Landing-page and email copy are not sub-commands here.

## Licence

The sub-command instructions are ported from emotixco/claude-skills-founder (MIT, Copyright (c) 2026 Emotix). See `LICENSE-UPSTREAM`.
