---
name: own-goal
description: Run a goal or a whole PRD to completion, our way. A verifiable completion condition worked in a loop until met, an accountability document created up front, every PRD phase implemented by specialised sub-agents on tiered models (Fable drives and does the final check, Opus designs and verifies, Sonnet does mechanical work), rejected work redone by the driver, each unit committed as it verifies, and a mandatory /reviewer pass before the goal is declared complete.
argument-hint: <goal statement | path to PRD.md>
disable-model-invocation: true
---
# own-goal: goal mode with accountability and delegation

## Gate ledgers (this skill's acceptance mechanism)

Unlazy is opt-in elsewhere, but this skill accepts work through gate files,
so they stay on here. Step 1's completion items become gates in `GATES.md` in
the working directory: one `- [ ]` box per item, each with a `CHECK:` shell
command, an `EXPECT:` match string, and `EVIDENCE: pending`. Full format in
`~/.claude/skills/unlazy/references/gates.md`.

- Flip boxes with `node ~/.claude/skills/unlazy/scripts/gate-check.mjs <file>`.
  A box is checked only when the command output matches EXPECT, and a checked
  box whose `EVIDENCE:` still reads `pending` is unmet.
- Every number that will appear in the final report gets its own gate.
- CHECK commands stay cheap and non-interactive: typecheck, tests, lint, grep,
  `wc -l`, file counts. Never a dev server, a browser, or a deploy; the user
  verifies those.
- An impossible gate gets `ABANDON: G<n> <reason>` and a line in the report.
- If `GATES.md` already exists for this task, append gates and continue ids.

Five to twelve gates per run. Multi-phase PRDs use orchestrated mode: one
ledger per phase under `gates/<phase-slug>.md`, plus the top-level `GATES.md`
for the whole goal. Read `~/.claude/skills/unlazy/references/orchestration.md`
before fanning out.

`$ARGUMENTS` is the goal, or a path to a `PRD.md`. The run ends when Step 8
is done. This is an autonomous run, so an error or a dead end means re-plan
and continue, not a "next steps" handoff to the user.

## Roles and models

The model the user picked for the session is the **driver**; the global
"Delegation directive" (`~/.claude/CLAUDE.md`, mirrored as
`.cursor/rules/delegation.mdc`) governs this skill in every harness. In
short: the driver plans, dispatches, accepts or rejects every returned piece
by reading its diff, does the final check itself, and redoes what fails
acceptance. Sub-agents use the best tiers the harness offers, by leaf type:

| Tier | Claude Code `model` | Used for |
|---|---|---|
| Driver | the session model | completion condition, phase plan, acceptance of every unit, gap passes, final check, redo of rejected work |
| Design | `opus` | phases needing design judgement: schema, API shape, state, auth, migrations, anything touching a Convex boundary; the Step 6 fresh-eyes supervisor |
| Build | `opus` or `sonnet` | implementation inside a decided design; `sonnet` when the pattern is decided and the phase mostly applies it |
| Mechanical | `sonnet` | rename sweeps, fixture and locale generation, applying one decided pattern across files, running and reporting check commands |

In another harness, map the same tiers onto what it offers. The driver's
tokens go to driving and checking, never to mechanical leaves. Name the
driver model in the ACCOUNTABILITY.md header and the final report.

Specialist agent types come from the harness roster (Claude Code names
below). Pick by phase content, one type per workstream:

| Phase content | `subagent_type` |
|---|---|
| Convex functions, schema, crons, data migration | Backend Architect |
| React/Next pages, components, design-system usage | Frontend Developer |
| Mobile (`apps/hr-mobile`) | Mobile App Builder |
| Auth, tenancy, permissions, anything OWASP-shaped | Security Engineer |
| Tests only, or test gaps found in review | API Tester |
| Docs, runbooks, READMEs | Technical Writer |
| Anything else | general-purpose |

## Step 1: lock the completion condition

Restate the goal as verifiable statements ("build passes", "route X renders
Y", "all N call sites migrated"). If `$ARGUMENTS` is a PRD path, or the goal
slug matches a PRD under `_r&d/prd/<slug>/`, read the PRD and the sibling
`FILES.md` and `INVESTIGATION.md` first. Then:

- Every `### Phase <X>` heading in the PRD becomes a **phase** in the plan.
  Nice-to-have and "Phase 2" labels are still phases; the goal is the whole
  PRD unless the user excluded a phase by name in `$ARGUMENTS`.
- Each phase gets its own completion items, taken from the PRD's acceptance
  criteria for that phase. A phase with no acceptance criteria gets them
  written now, from its stated outcome.
- Order phases by dependency (foundation and schema first, UI after, cleanup
  last). Independent phases run in parallel.

If the goal is genuinely ambiguous, ask one round of clarifying questions now.
After this step there are no more questions, only work.

## Step 2: create the accountability document

Before any implementation, create `.claude/goals/<goal-slug>/ACCOUNTABILITY.md`:

```markdown
# Goal: <one-line goal>
Started: <date> · Status: IN PROGRESS · Driver: <model>
Source: <PRD path or "goal statement">

## Completion condition
### Phase A: <title>
- [ ] <verifiable item>
### Phase B: <title>
- [ ] <verifiable item>

## Execution plan
| Phase | Agent type | Model | Files owned | Depends on |
|-------|-----------|-------|-------------|------------|

## Work log
| When | Who (type/model) | Phase | What was done | Commits |
|------|------------------|-------|---------------|---------|

## Acceptance
| Phase | Verdict | Reason | Redone by |
|-------|---------|--------|-----------|

## Gaps found & fixed
| Gap | Found by | Fix | Status |
|-----|----------|-----|--------|

## Reviewer results
(pending)

## Final check
(pending)
```

This document is the single source of truth for the run and the final
deliverable. `.claude/goals/<slug>/ACCOUNTABILITY.md` is the one
accountability home on this machine; `/ch`, `/fd-ch` and `/prd-ch` write
theirs here too. Never create a parallel `_r&d/tasks/…/ACCOUNTABILITY.md`.

## Step 3: plan the fan-out

Delegation is the default. Fill the **Execution plan** table: one row per
phase, with the agent type and model from the roster above and the exact
files the phase owns. Rules:

- **Disjoint file ownership.** No two concurrent agents own the same file.
  When two phases need the same file, either serialise them or give the file
  to one phase and have the other request the change through the driver.
- **Shared working tree.** Run `git status --porcelain` before dispatch. Paths
  already dirty belong to another session and go to no agent. The protocol
  every agent follows is `AGENTS.md` § "Shared working tree"; repeat its
  commit rule in every agent prompt (next step).
- **Stay solo below half an hour of real work.** One agent's overhead then
  costs more than it buys; the driver does that phase inline and still logs it.
- Record the plan in ACCOUNTABILITY.md before the first dispatch.

## Step 4: dispatch

Dispatch independent phases in one message so they run concurrently. Each
agent prompt is self-contained and carries exactly:

1. Its phase's completion items, verbatim from ACCOUNTABILITY.md.
2. The PRD section for that phase, and the relevant `FILES.md` lines.
3. The files it owns, and the rule that it edits nothing else.
4. The commit rule: after each unit verifies (typecheck or tests for that
   unit), commit it with `git commit -F <msgfile> -- <owned paths>`, adding
   new files with `git add <path>` first. Never `git add -A`, never stash,
   never restore or checkout another path. Several small commits per phase.
5. The gates file it owns (`gates/<phase-slug>.md`) and the instruction to
   flip boxes only with `gate-check.mjs`.
6. The report format for its final message: what was done, commit SHAs,
   gate ledger pasted (N of N), anything it could not finish and why.
7. `max_turns`: 25 for build phases, 10 for mechanical or research phases.

When an agent hits "context limit reached", split its phase smaller and
redispatch; never retry the same prompt.

## Step 5: accept or redo

When an agent returns, the driver accepts its work before anything else uses
it. Acceptance reads the actual diff (`git show <sha>` for each reported
commit) and reruns the phase's gate file. Self-reports are not evidence.

A phase is **accepted** when every gate passes, the diff stays inside the
owned files, each commit is one concern, and the completion items are met by
what the code does. Log the verdict in the **Acceptance** table.

A phase is **rejected** when any of that fails. Then:

1. Redispatch the same agent type once, with the specific gap list and the
   rejection reason. Same model tier.
2. If the second attempt is still rejected, **the driver does the work
   itself**, inline, starting from whatever was committed. Log
   `Redone by: driver`. A third dispatch does not happen.

Rejected commits are never reverted or reset. The driver builds on them or
fixes forward; history rewriting is the user's call.

## Step 6: the loop

Repeat until every completion box in every phase is ticked:

1. Dispatch the next wave of phases whose dependencies are accepted.
2. Accept or redo each one (Step 5). Append to the Work log.
3. **Gap pass.** Diff the current repo state against the full completion
   condition. Every mismatch, half-done item, failed build, or missed PRD
   requirement is a gap. Log it in **Gaps found & fixed**.
4. Fix gaps: a big one becomes a new phase row and goes through Steps 4 and
   5; a small one the driver fixes inline and commits.
5. Re-check the boxes. A ticked box has evidence (a gate, a test run, a
   build) beside it, never optimism.

When all boxes are ticked, run one **fresh-eyes supervisor pass**: a single
`opus` agent with no memory of the work, given only the completion condition,
that verifies against the repo by running typecheck, tests and the top-level
`GATES.md`. It reads and reports only; it edits nothing, and a failure in a
file outside this goal's paths is noted as another task's, not chased.
Failures inside this goal's paths are gaps; go back to 3.

## Step 7: reviewer gate, then the driver's final check

Invoke **`/reviewer`** (full audit + fix, Steps 1 to 7) on the paths and
commits this goal produced, passed explicitly as its scope argument (the
accepted phase diffs plus the commit list from ACCOUNTABILITY.md). Never on
the whole branch: other agents' in-flight files are not this goal's to
review or fix. Fix every blocker and gap it raises inside those paths.
Paste its verdict into **Reviewer results**.

Then the driver performs the **final check** itself, not by delegation:

- Re-read every phase's accepted diff end to end once more.
- Re-run the top-level `GATES.md`; it must read ALL MET.
- Try to refute one passed gate per phase: pick the evidence and look for a
  way it could pass while the feature is still wrong.
- Confirm `git status --porcelain` lists none of this run's paths.

Write the outcome under **Final check** with the driver model named. If the
final check finds anything, it is a gap; fix it, commit, rerun the check.

## Step 8: close out

- Tick every completion box, set `Status: COMPLETE` with the date.
- Delete `GATES.md` and `gates/` so a stale ledger does not gate the next
  session in that directory.
- Final message: the completion condition per phase and how each item was
  verified, the execution plan table with verdicts, the commit list, the path
  to ACCOUNTABILITY.md, the reviewer verdict, and the final-check outcome with
  the driver model named. Every number in it comes from a gate.

The goal is not complete until ACCOUNTABILITY.md says COMPLETE, the reviewer
pass is clean or fixed, and the driver's final check is recorded.
