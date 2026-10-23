---
name: copy-panel-rewrite
description: >-
  Rewrite every string a person reads in a product (questionnaires, answer
  options, screens, emails, website) in plain human language, then hand every
  change to three independent, research-backed judge panels that decide blind.
  Two of three wins; splits go to a blind ranking round. The verdicts are
  applied in code, tested and committed, and the owner gets a tabbed HTML
  report with a TL;DR instead of reviewing line by line. Optional: narration
  audio pipeline and a questionnaire data reset, both built but never run
  without the owner. Use for "/copy-panel-rewrite", "rewrite all our copy in
  plain language", "let judges decide the wording", "humanize and unslop every
  page", "the wording is too technical", "copy sweep before release".
argument-hint: "[scope: questionnaires | app | site | emails | all] [--audio] [--reset] [--exclude <path,...>]"
---

# copy-panel-rewrite

The owner wants words any person understands on first read, and does not want
to approve thousands of strings. So writers rewrite, three panels who never
see each other decide, the driver applies the result and proves it, and the
owner reads one report.

Arguments: `$ARGUMENTS`. Default scope is `all` in the current repo.

Compared with `/messaging-copy`: that skill rewrites marketing pages, runs one
five-judge panel and waits for the owner to approve. This one sweeps every
string in the product and the panels decide; the owner only signs off the
side effects (audio spend, data resets, production).

Every word this skill writes, including the report and chat replies, passes
`~/.claude/skills/unslop/SKILL.md`. Writers also run
`~/.claude/skills/humanizer/SKILL.md` on their own output.

## The run

```
0 Size, scope, one round of questions
1 Investigate: copy surfaces, invariants, identifiers dressed as copy
2 Style guide + house rules            (driver)
3 Rewrite in parallel, by area         (opus writers, owned files only)
  3b Fresh-eyes invariant check         (opus verifier)
4 Research three panels, independently (opus, one per panel)
5 Build blind packets                   scripts/build-packets.mjs
6 Judge in waves                        (opus, panel x chunk)
7 Consensus, round 2, FINAL.json        scripts/consensus.mjs
8 Apply verdicts, truth-check, tests    scripts/apply-copy.mjs + driver
9 Optional: audio pipeline (built, not run)  references/audio.md
10 Optional: data reset (built, dry run only) references/data-reset.md
11 /reviewer, report, close             scripts/build-report.mjs
```

The run directory is `_r&d/prd/copy-panel/<MM-DD>/` (or `docs/copy-panel/<MM-DD>/`
when the repo has no `_r&d`). Everything below lives there unless it is code.

```
<run>/
  STYLE.md  STYLE-UI.md  INVESTIGATION.md
  copy-panel.config.json
  proposals/<area>.json         writers' old/new records
  judges/
    HOUSE-RULES.md  JUDGING.md
    P1/BRIEF.md  P2/BRIEF.md  P3/BRIEF.md   (+ packets, verdicts per panel)
    key/                        driver only: unblinding keys
    FINAL.json  APPLY-RESULT.json
  report/notes.json  report/report.html
```

Copy the three scripts from `${CLAUDE_SKILL_DIR}/scripts/` into `<run>/judges/`
so the run is reproducible from the repo alone.

## Step 0: size, scope, one round of questions

This is an XL task: several surfaces, many agents, more than one session's
worth of context. Run unlazy in orchestrated mode with one gates file per
phase under `gates/copy-panel-rewrite/`, and an accountability file at
`.claude/goals/copy-panel-rewrite/ACCOUNTABILITY.md` (own-goal format). Turn
on the progress panel.

Ask once, with AskUserQuestion, only what changes the work:

1. Scope: which apps and surfaces; anything with its own naming authority
   (a sister product, legal pages, signed specs) stays out.
2. Audio: are any strings narrated? If yes, is regenerating narration in
   scope? (It will be built and previewed, never generated without the owner.)
3. Data: do stored answers or results depend on the wording? If a reset is
   wanted, which environment, and what must survive (accounts, teams)?
4. Who reads the result: the owner only, or a team.

After this there are no more questions until the report. Dead ends mean
re-plan and continue.

## Step 1: investigate

Dispatch Explore agents in parallel (one per app or area). The driver needs,
in `INVESTIGATION.md`, with file:line evidence:

- **Every copy surface**, grouped into areas of a size one writer can own
  (aim for 20 to 60 files each). Include emails, backend error strings that
  reach users, toasts, empty states, SEO metadata, aria labels, PDFs.
- **Where served copy really comes from.** Copy in a database is only
  changed by its seed or migration; editing the source file alone does nothing.
- **Scoring and storage invariants.** Are answer options scored by position,
  by keyword in the text, or by letter? Are answers stored as the option
  TEXT? If stored as text, rewording an option orphans every saved answer
  unless the reset or a legacy mapping ships in the same step.
- **Identifiers that look like copy.** Section names used as lookup keys,
  audio folder slugs, `switch` cases, map keys, analytics names, test ids.
- **Tests that pin visible text.**
- **Project rules**: CLAUDE.md banned terms, product names, spelling, the
  price source of truth, any "never say X" rule.
- **Facts the copy states** (durations, prices, counts, what is free). The
  source file for each, so Step 8 can check winning text against it.

## Step 2: style guide and house rules (driver)

Fill `STYLE.md` from [templates/STYLE.md](templates/STYLE.md) and, when screens
are in scope, `STYLE-UI.md` from [templates/STYLE-UI.md](templates/STYLE-UI.md).
They hold the reader, length limits, banned and allowed words, sound rules,
the invariants from Step 1, a glossary (old term, new phrase) every writer
uses, and the proposals file format.

Write `judges/HOUSE-RULES.md` from [templates/HOUSE-RULES.md](templates/HOUSE-RULES.md):
the short list of fixed rules a panel's text must obey. House rules carry the
product's facts and naming, never a preference about wording, because the
panels decide wording.

## Step 3: rewrite in parallel

One `opus` writer per area, in waves (the harness caps concurrent agents at
about 20). Each brief carries: the reason (owner's words, quoted), STYLE.md
and STYLE-UI.md verbatim, the exact paths it owns, the `git status --porcelain`
paths it must not touch, and the proposals output path.

Each writer:

1. Edits strings in place in its owned files. Never identifiers, keys, prices,
   option order or count.
2. Runs humanizer, then unslop, over its own new strings.
3. Writes `proposals/<area>.json`: an array of
   `{ "id", "path", "field", "old", "new", "note", "surface"? }`, one per
   changed string, in reading order. `id` is `path:line` for code strings or
   the item key for bank items; `path` is the file the string lives in.
   `old` and `new` are the string contents only, never the code line around
   them.
4. Proposes, but does not make, any change that spans files or touches an
   identifier (renaming a section, changing scorer keys). It records it as a
   `field: "call"` row with a note. The driver turns these into panel calls.
5. Runs the area's typecheck and tests, then commits by path:
   `copy(<area>): plain language for <what>`.

**3b Verifier.** One fresh `opus` agent reads every questionnaire old/new pair
(not screens) and flags meaning drift, changed option order or count, lost
qualifiers ("usually", "in the last 3 months") and lost scoring keywords.
Output `proposals/flags.json`. The driver fixes invariant breaks before
packets; a meaning risk stays in and goes to the judges.

## Step 4: research three panels

Read [references/panels.md](references/panels.md). Dispatch three `opus`
research agents at once, one per panel, each writing only `judges/P<n>/BRIEF.md`.
They never see the proposals, the code or each other's briefs.

Default lenses (adapt the second to the project):

| Panel | Lens | Seats |
|---|---|---|
| P1 | Plain language and readability | plain-language specialist, a real reader with English as a second language, a reading or cognitive-load researcher |
| P2 | Meaning and measurement (questionnaires) or meaning and product truth (screens only) | survey methodologist, psychometrician, a domain expert on the subject |
| P3 | Engagement, tone and voice | UX writer, behavioural scientist on motivation and completion, an audio or narration director when anything is read aloud |

Each brief has: three named seats with one question each, 10 to 18 findings
from sources the agent actually opened (each with Applies, Source, Strength),
a 5-criterion rubric scored 0 to 2, pass or fail gates, a decision rule
including when the panel may write its own text, and a "where this lens goes
too far" section. When narration is in scope, the voice panel also
recommends a narrator preset (see references/audio.md).

## Step 5: blind packets

Fill `copy-panel.config.json` from
[templates/copy-panel.config.json](templates/copy-panel.config.json): the
sets (for example `q` for questionnaires, `ui` for screens), chunk sizes,
scoring keywords that must stay, house-rule normalisations and the calls.

```
node judges/build-packets.mjs --set q
node judges/build-packets.mjs --set ui
```

Each panel gets the same items with its own shuffled A/B order. Nothing in a
packet says which version is old or new. The unblinding key goes to
`judges/key/<set>.json`. A change that only applies a house rule (dash,
spelling, casing) passes straight through as `house rule only` and is not
judged; it is listed in `key/<set>-auto.json`.

Copy `${CLAUDE_SKILL_DIR}/references/judging.md` to `judges/JUDGING.md`.

## Step 6: judge in waves

One `opus` agent per panel per packet chunk. The prompt names only four
files: the panel's BRIEF.md, HOUSE-RULES.md, JUDGING.md and the packet. It
writes `P<n>/verdicts-<set>-<chunk>.json`. Never tell a panel what another
panel chose, which version the writers proposed, or what the owner prefers.

```
node judges/consensus.mjs --check      # prints verdicts-complete when done
```

A missing or broken verdict file gets one redispatch; if it fails again,
split the chunk in half and dispatch the halves.

## Step 7: consensus

```
node judges/consensus.mjs --round2     # items with no 2-of-3 winner
```

Round 2 sends each unresolved item's candidate texts (each panel's pick,
including any text a panel wrote) back to all three panels, shuffled per
panel, as `P<n>/round2-packet.json`. Each ranks best first into
`P<n>/round2-verdicts.json`. Then:

```
node judges/consensus.mjs --final      # FINAL.json; must print unresolved 0
```

Winner: the text two panels picked; otherwise the round-2 text two panels
ranked first; otherwise the Borda winner, ties to more first places, then to
a version the writers proposed.

## Step 8: apply, truth-check, test

```
node judges/apply-copy.mjs --dry
node judges/apply-copy.mjs
```

The script swaps the writers' text for the verdict wherever they differ,
only when the current text occurs exactly once in its file and is not
code-shaped. Everything else lands in `APPLY-RESULT.json` as skipped; the
driver applies those by hand, reading each file first.

Then the driver, not an agent:

- **Calls.** Apply each winning call everywhere it reaches together: the
  display names, the identifiers, the scorer keys, the audio folders, the
  tests. When stored answers hold the old text, add a legacy mapping or tie
  the change to the reset (references/data-reset.md).
- **Truth check.** Grep every number, duration, price and "free" in winning
  text against the facts from Step 1. A panel can write a wrong fact; fix it
  to the source of truth and log it.
- **Overrides.** The driver may override a verdict only when applying it
  would state something false or unsafe (for example showing "paused" for
  revoked access). Log each override with its reason in the report.
- **Bugs.** Real defects found on the way (a form that drops messages, a
  wrong claim) get their own commits and their own report tab.
- **Copy gate test.** Add a test from [templates/copy-gate.test.ts](templates/copy-gate.test.ts):
  no em or en dashes, no banned terms, word limits, frozen option counts.
- Update tests that pin old text. Run typecheck and the suites of every app
  touched. Name pre-existing failures with the commit that caused them;
  never call them yours or hide them.
- Commit per area by path, one concern each.

## Step 9 (optional): audio

Read [references/audio.md](references/audio.md). Build the pipeline changes
and a preset preview command. **Never run paid generation.** The owner
listens to the previews first; the report's Audio tab lists the exact
commands.

## Step 10 (optional): data reset

Read [references/data-reset.md](references/data-reset.md). Build a reset that
defaults to a dry run, test it, and stop. The owner runs it; the report's
reset tab lists the order.

## Step 11: review, report, close

1. `/reviewer` scoped to this run's paths and commits, never the branch.
   Fix blockers inside those paths.
2. Write `report/notes.json` from [templates/notes.json](templates/notes.json)
   and run
   `node ${CLAUDE_SKILL_DIR}/scripts/build-report.mjs <run>/judges/FINAL.json <run>/report/notes.json <run>/report/report.html`.
   Every number on the page is computed from FINAL.json or measured by a
   command. Tabs: TL;DR, one per set, The calls, then one per piece of work
   from notes (fixes found, audio, data reset, the panels, what is left,
   commits).
3. Load `artifact-design`, then publish the page with the Artifact tool and
   give the link.
4. Save a project memory: what was decided, what is not run, the ship-order
   rule if answers are stored as text.
5. Set ACCOUNTABILITY to COMPLETE, delete the gates files.
6. Close with `[!DONE]` (link, the counts, tests) and one `[!ACTION]` per
   owner-only step (listen to presets, run the reset, ship to production).

## Rules that do not bend

- Panels are blind and independent. No version labels, no writer names, no
  other panel's verdict, no owner preference, ever.
- The owner is not asked to approve wording. They approve spend, data and
  production.
- Never run paid audio, a data reset, or a deploy. Build, test, document.
- Never ship reworded scored options to an environment with saved answers
  before, or without, its reset or legacy mapping.
- Option count and order never change outside a winning call.
- Every count in the report and the closing message comes from FINAL.json or
  a command run at report time.

## Lessons from the first run

- Copy served from a database needs its seed run with repair, or nothing
  changes for users.
- Narration keyed by question position played the old version's clips for
  months. Key clips on a stable item slug.
- Writers who recorded whole code lines as `old`/`new` made the apply step
  break syntax. Strings only, and the apply script refuses code-shaped text.
- A panel-written line said a call lasts 30 minutes; the booking code said
  20. Truth-check numbers after applying.
- The sweep found real bugs (forms posting nowhere, a public endpoint
  returning other visitors' data, a paid upsell for a free feature). Give
  them their own commits and their own tab.
- Gate CHECK commands run under `sh`: use `grep -HnE`, not `rg` aliases, and
  match `^0\s*$`, not `^0$`.
