---
name: own-goal
description: Runs a goal or a whole PRD to completion in a loop. Locks a verifiable completion condition, writes ACCOUNTABILITY.md up front, delegates each PRD phase to sub-agents on tiered models, redoes rejected work in the driver, commits each unit as it verifies, and ends with a top-tier fresh-eyes check, a /reviewer pass and the driver's final check. Use on /own-goal with a goal or a PRD.md path.
argument-hint: "<goal statement | path to PRD.md>"
disable-model-invocation: true
---
# own-goal: goal mode with accountability and delegation

`$ARGUMENTS` is the goal, or a path to a `PRD.md`. The run ends when Step 8 is
done. This is an autonomous run: an error or a dead end means re-plan and
continue, not a "next steps" handoff to the user.

## What must hold for the whole run

- **State lives in files, not in this conversation.**
  `.claude/goals/<goal-slug>/ACCOUNTABILITY.md` and the gate ledgers are the
  run. After a compaction, a handoff or a restart, read them first and carry
  on from the first unticked box. Never restart a goal whose ACCOUNTABILITY.md
  says IN PROGRESS, and never redo a phase its Acceptance table marks accepted.
- **Done is proved, not felt.** A box is ticked by a gate, a test run or a
  build, with the evidence beside it. Every number in the final report comes
  from a gate.
- **Checking gets the top model.** Work is built on the tier its difficulty
  needs. It is accepted by the driver reading the diff, verified by a
  fresh-context agent on the strongest tier below the driver, reviewed by
  `/reviewer`, and closed by the driver's own final check. Never a cheaper
  tier for a verification step.
- **Owned files only.** Each phase edits the paths it was given and commits
  them by path. Full rule: `~/.claude/skills/unlazy/references/ownership.md`.
- **Two failed attempts end an approach.** If the same fix fails twice, stop
  that approach and re-plan the phase a different way. When a second,
  different approach also fails, write `ABANDON: G<n> <reason>` on that gate,
  log it under Gaps, and carry on with everything that does not depend on it.
- **The owner verifies the running app.** No dev server, browser, screenshot
  or deploy inside this run. An outcome only a person can see is a manual
  gate that names what the owner looks at.

## Gate ledgers (this skill's acceptance mechanism)

Unlazy is opt-in elsewhere, but this skill accepts work through gate files,
so they stay on here. Format: `~/.claude/skills/unlazy/references/gates.md`.

- The goal's ledger is `gates/<goal-slug>.md` in the working directory, never
  a root `GATES.md`: several agents share one tree, and a root ledger gates
  sessions that have nothing to do with this goal. Multi-phase goals add one
  ledger per phase at `gates/<goal-slug>/<phase-slug>.md`. Read
  `~/.claude/skills/unlazy/references/orchestration.md` before fanning out.
- One `- [ ]` box per completion item, each with a `CHECK:` shell command, an
  `EXPECT:` match string and `EVIDENCE: pending`. A PRD written by `/prd-ch`
  already gives each acceptance item its `CHECK` and `EXPECT`: copy them, do
  not rewrite them.
- Flip boxes with `node ~/.claude/skills/unlazy/scripts/gate-check.mjs <file>`.
  A box is checked only when the command output matches EXPECT, and a checked
  box whose `EVIDENCE:` still reads `pending` is unmet.
- CHECK commands stay cheap and non-interactive: typecheck, tests, lint, grep,
  `wc -l`, file counts.
- Five to twelve gates per ledger. If a ledger for this goal already exists,
  append gates and continue the ids.

## Roles and models

The model the user picked for the session is the **driver**, in every
harness. The driver plans, dispatches, accepts or rejects every returned piece by reading
its diff, does the final check itself, and redoes what fails acceptance. Its
tokens go to driving and checking, never to mechanical leaves.

| Tier | `subagent_type` | `model` | Used for |
|---|---|---|---|
| Driver | (the session) | the session model | completion condition, phase plan, acceptance of every unit, gap passes, final check, redo of rejected work |
| Verify | `savvy-flow:savvy-heavy` | `opus` (xhigh effort) | the Step 6 fresh-eyes supervisor, the `/reviewer` finder, any second opinion on a rejected phase. When the driver is below Fable and the harness has `savvy-flow:savvy-fable`, use that |
| Design | `savvy-flow:savvy-careful` or a specialist | `opus` | phases needing design judgement: schema, API shape, state, auth, migrations, anything touching a Convex boundary |
| Build | `savvy-flow:savvy-medium` or a specialist | `opus` | implementation inside a decided design |
| Mechanical | `savvy-flow:savvy-light` | `sonnet` | rename sweeps, fixture and locale generation, applying one decided pattern across files, running and reporting check commands |

In another harness, map the same tiers onto what it offers. Name the driver
model in the ACCOUNTABILITY.md header and the final report.

A specialist type replaces the generic worker when the phase content calls
for one, on the model its tier gives. One type per workstream:

| Phase content | `subagent_type` |
|---|---|
| Convex functions, schema, crons, data migration | Backend Architect |
| React/Next pages, components, design-system usage | Frontend Developer |
| Mobile (`apps/hr-mobile`) | Mobile App Builder |
| Auth, tenancy, permissions, anything OWASP-shaped | Security Engineer |
| Tests only, or test gaps found in review | API Tester |
| Docs, runbooks, READMEs | Technical Writer |
| Anything else | `savvy-flow:savvy-<tier>` (`~/.claude/references/progress-panel.md`); general-purpose when savvy-flow is not installed |

A Frontend Developer brief also says: read
`~/.claude/skills/frontend-design/SKILL.md` and follow it. A sub-agent does not
see the owner's design rules unless the brief points at them.

## Step 1: lock the completion condition

First load the progress panel tools, on by default: ToolSearch
`select:mcp__savvy-progress__progress,mcp__savvy-progress__step`
(`~/.claude/references/progress-panel.md`).

If `.claude/goals/<goal-slug>/ACCOUNTABILITY.md` already exists with
`Status: IN PROGRESS`, this is a resume: skip to the step its tables show is
next.

Restate the goal as verifiable statements ("build passes", "route X renders
Y", "all N call sites migrated"). If `$ARGUMENTS` is a PRD path, or the goal
slug matches a PRD under `_r&d/prd/<slug>/`, read the PRD and the sibling
`FILES.md` and `INVESTIGATION.md` first. Then:

- Every `### Phase <X>` heading in the PRD becomes a **phase** in the plan,
  with its `Owns` paths, its `Depends on` line and its acceptance items taken
  as written. Nice-to-have and "Phase 2" labels are still phases; the goal is
  the whole PRD unless the user excluded a phase by name in `$ARGUMENTS`.
- A PRD with no phase headings (an older one, or a plain task list): slice it
  into phases yourself, vertical slices in build order with the thinnest
  end-to-end slice first, and write the owned paths for each.
- A phase with no acceptance criteria gets them written now, from its stated
  outcome, each with a runnable check where one exists.
- Order phases by dependency. Independent phases run in parallel.
- Read the project's `CLAUDE.md`. Its rules are completion items too: a phase
  that breaks one is rejected even when its gates pass.

If the goal is genuinely ambiguous, ask one round of clarifying questions now,
one `> [!ASK]` per fork with its options. After this step there are no more
questions, only work.

## Step 2: create the accountability document

Before any implementation, create `.claude/goals/<goal-slug>/ACCOUNTABILITY.md`
(if `/prd-ch` already wrote one there, append these sections under a dated
heading):

```markdown
# Goal: <one-line goal>
Started: <date> · Status: IN PROGRESS · Driver: <model>
Source: <PRD path or "goal statement">
Ledgers: gates/<goal-slug>.md, gates/<goal-slug>/

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
Update it as each thing happens, not at the end: it is what a resumed session
reads.

For a goal of four or more phases, offer the unlazy Stop hook once, in one
line: `node ~/.claude/skills/unlazy/scripts/install-hooks.mjs` writes it to
this project's `.claude/settings.local.json` and blocks ending a turn while a
ledger has unmet boxes; `--uninstall` removes it. Never install it unasked and
never globally.

## Step 3: plan the fan-out

Delegation is the default. Fill the **Execution plan** table: one row per
phase, with the agent type and model from the tables above and the exact
files the phase owns. Rules:

- **Disjoint file ownership.** No two concurrent agents own the same file.
  When two phases need the same file, either serialise them or give the file
  to one phase and have the other request the change through the driver.
- **Shared working tree.** Run `git status --porcelain` before dispatch. Paths
  already dirty belong to another session and go to no agent.
- **Stay solo below half an hour of real work.** One agent's overhead then
  costs more than it buys; the driver does that phase inline and still logs it.
- Record the plan in ACCOUNTABILITY.md before the first dispatch.
- Report the plan to the progress panel (`~/.claude/references/progress-panel.md`):
  one `tasks` row per Execution plan phase, titled exactly as its Agent
  `description`, tier from the tables above, `after` from Depends on,
  `phase: "delegate"`. Then `done` on each acceptance (Step 5), new rows for
  gap phases (Step 6), `phase: "review"` at Step 7, and `finished: true` with
  `phase: "close"` at Step 8.

## Step 4: dispatch

Dispatch independent phases in one message so they run concurrently. Each
agent prompt is self-contained and carries exactly:

1. Why the phase exists and who uses the result, in two lines. An agent that
   knows the purpose makes the right call on what the brief did not foresee.
2. Its phase's completion items, verbatim from ACCOUNTABILITY.md.
3. The PRD section for that phase, and the relevant `FILES.md` lines.
4. The files it owns, and the rule that it edits nothing else: a needed
   change outside them is reported, not made.
5. The project rules that bind this phase, quoted from the project
   `CLAUDE.md`, and the checks to run (typecheck and test commands).
6. The commit rule: after each unit verifies (typecheck or tests for that
   unit), commit it with `git commit -F <msgfile> -- <owned paths>`, adding
   new files with `git add <path>` first. Never whole-tree staging, never
   stash, never restore or checkout another path. Several small commits per
   phase, no tool attribution in the message.
7. The gates file it owns (`gates/<goal-slug>/<phase-slug>.md`) and the
   instruction to flip boxes only with `gate-check.mjs`.
8. The report format for its final message: what was done, commit SHAs,
   gate ledger pasted (N of N), anything it could not finish and why.
9. The worker step line from `~/.claude/references/progress-panel.md`, for
   agent types that do not start with `savvy-`.

When an agent hits "context limit reached", split its phase smaller and
redispatch; never retry the same prompt.

## Step 5: accept or redo

When an agent returns, the driver accepts its work before anything else uses
it. Acceptance reads the actual diff (`git show <sha>` for each reported
commit) and reruns the phase's gate file. Self-reports are not evidence.

A phase is **accepted** when every gate passes, the diff stays inside the
owned files, each commit is one concern, no project rule is broken, and the
completion items are met by what the code does. Log the verdict in the
**Acceptance** table.

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
Verify-tier agent with no memory of the work, given only the completion
condition, the PRD path and this goal's path list. It verifies against the
repo by running typecheck, tests and `gates/<goal-slug>.md`, then tries to
find one way each phase could pass its gates while the feature is still
wrong. It reads and reports only; it edits nothing, and a failure in a file
outside this goal's paths is noted as another task's, not chased. Failures
inside this goal's paths are gaps; go back to 3.

## Step 7: reviewer gate, then the driver's final check

Invoke **`/reviewer`** (full audit and fix) on the paths and commits this
goal produced, passed explicitly as its scope argument (the accepted phase
diffs plus the commit list from ACCOUNTABILITY.md). Never on the whole
branch: other agents' in-flight files are not this goal's to review or fix.
`/reviewer` puts its finder on the Verify tier; do not downgrade it. Fix every
blocker and gap it raises inside those paths. Paste its verdict into
**Reviewer results**.

Then the driver performs the **final check** itself, not by delegation:

- Re-read every phase's accepted diff end to end once more.
- Re-run `gates/<goal-slug>.md`; it must read ALL MET.
- Try to refute one passed gate per phase: pick the evidence and look for a
  way it could pass while the feature is still wrong.
- Confirm `git status --porcelain` lists none of this run's paths.

Write the outcome under **Final check** with the driver model named. If the
final check finds anything, it is a gap; fix it, commit, rerun the check.

## Step 8: close out

- Tick every completion box, set `Status: COMPLETE` with the date.
- Delete `gates/<goal-slug>.md` and `gates/<goal-slug>/` so a stale ledger
  does not gate the next session. Leave other goals' ledgers alone.
- Final message, under 15 lines: the completion condition per phase and how
  each item was verified, the commit list, the path to ACCOUNTABILITY.md, the
  reviewer verdict, the final-check outcome with the driver model named, any
  abandoned gate with its reason, and manual gates the owner still has to
  look at. Every number in it comes from a gate. Close with a `> [!DONE]`
  callout, or `> [!REVIEW]` lines for what needs the owner's eyes.

The goal is not complete until ACCOUNTABILITY.md says COMPLETE, the reviewer
pass is clean or fixed, and the driver's final check is recorded.
