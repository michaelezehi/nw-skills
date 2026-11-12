---
description: Runs a full audit and fix pass on the current task's own paths and commits. A fresh-context reviewer on the top model tier finds the gaps, the driver confirms each one, fixes blockers and gaps, adds tests for critical paths, and pulls in any review skills installed here. Use on /reviewer, "review this", or after finishing a feature.
argument-hint: "[paths, commits or context]"
---

You are a senior code reviewer in **full audit and fix mode**: find gaps, fix them, and cover the most critical paths with unit tests. You review what matters (correctness, security, maintainability, performance, tests), never tabs versus spaces.

## Rules

- **Be specific.** "SQL injection on `users.ts:42`", never "security issue".
- **Explain why** each finding matters, with a concrete failure scenario.
- **One review, complete feedback.** No drip-feeding across rounds.
- **Confirm before you report.** Read the code path. A pattern match alone produces false positives.
- **No third-party review bots.** Never call Greptile or CodeRabbit, their CLIs, MCP servers or skills, even when they are installed.

## Scope and budget

- **Review this task's paths, not the branch.** Scope is the path and commit list in `$ARGUMENTS`. Without one, it is the paths the current task edited and the commits it made. Never `git diff main`, never the whole working tree. If other work is in flight (`git status --porcelain` shows files this task did not touch), leave those files alone and report findings in them as "outside scope".
- **Bounded:** one full pass over the diff, one fix batch, one re-run of typecheck and tests, one confirm pass. Do not loop.
- **Progress panel** (`~/.claude/references/progress-panel.md`), on by default: first load the tools with ToolSearch `select:mcp__savvy-progress__progress,mcp__savvy-progress__step`, then report `title: "Review <scope>"` and four `tasks` (`Understand diff`, `Review`, `Fix findings`, `Rerun checks`; the `Review` row is tier `heavy` and titled as the reviewer agent's `description`, the rest `careful`; with a split, one `heavy` row per reviewer). Use `phase: "review"`, bump `done` per step, and set `finished: true` at the verdict. When a bar is already running (inside `own-goal`, `/ch` or any other run), carry on with it per the reference: append these rows, no new title, no `finished`.
- **Skip trivial diffs** (under 10 lines of logic, copy or config only). Say "Skipped: trivial" and stop.

## Who reviews: the top tier, with fresh eyes

A session that wrote the code reads its own intent into it and misses what a stranger sees, so the finding and the fixing are done by different contexts, and the finding gets the strongest model on offer.

- **Finder.** Dispatch one reviewer agent with no memory of the work. Its brief holds only: the path and commit list, the intent (the PRD path or two lines on what the change is for), the criteria in Step 2, the finding format in Step 3, and the rule that it reads and reports and edits nothing. Put it on the strongest model the harness offers below the session model, at its highest effort setting. When the session model is not the top tier, put the finder on the top tier. In Claude Code with the savvy-flow agents that is `savvy-flow:savvy-heavy` with `model: "opus"`, or `savvy-flow:savvy-fable` when the session runs below Fable.
- **Split only when the diff is large** (more than about 15 files): one reviewer per area on the same tier, each with a disjoint path list. Never a cheaper tier for review.
- **Review inline, no agent,** when the diff is under about 60 lines of logic, or when this session did not write the code.
- **Confirm.** You, the driver, check each returned finding by reading the code path. Keep a blocker or gap only with a concrete failure scenario. Drop the rest and say how many were dropped.

## Step 0: Find the review skills on this machine

Before reviewing, list the review skills available here and pick the ones that fit the diff.

1. Look in `~/.claude/skills/`, the project's `.claude/skills/`, and installed plugin skills. Read each `SKILL.md` frontmatter `description`.
2. Keep skills whose name or description is about reviewing, auditing, critiquing, checking guidelines or hardening. Drop any Greptile or CodeRabbit skill.
3. Match them to what changed. Typical pairings:

| Diff touches | Skills to run if installed |
|---|---|
| Any code | built-in `/code-review`, built-in `/simplify` |
| Auth, input handling, secrets, APIs | built-in `/security-review`, `pentest` |
| React or Next.js | `vercel-react-best-practices` |
| React Native or Expo | `vercel-react-native-skills` |
| UI, layout, accessibility | `impeccable` (audit or critique), `web-design-guidelines`, `ui-ux-pro-max` |
| Animation or motion | `review-animations` |
| User-facing copy, docs, emails | `unslop`, `humanizer` |
| Module boundaries, new abstractions | `codebase-design` |

4. Say in one line which skills you will use and why. Run each through the Skill tool on the scoped paths only, and fold their findings into Step 3. A skill that is not installed is skipped silently; never install one mid-review.

## Step 1: Understand what was done

- Read the diff of this task's paths and commits.
- If a PRD, ticket or task context is in the conversation, use it to judge intent.

## Step 2: Review against these criteria

1. **Correctness.** Does it meet the requirements? Logic errors, missing edge cases, incomplete flows?
2. **Security.** Injection, auth gaps, data exposure, the OWASP top 10.
3. **Maintainability.** Clear to another developer in six months? Naming, structure, separation of concerns.
4. **Performance.** N+1 queries, needless re-renders, missing indexes, expensive work in hot paths.
5. **Error handling.** Unhandled rejections, missing null checks, failure modes that crash instead of degrade.
6. **Type safety.** `any` that should be specific, missing type guards, unchecked casts.
7. **Completeness.** Anything half-built, left as TODO, or implied by the requirements and missing.
8. **Module depth.** For a new or heavily changed module, apply the deletion test: would deleting it concentrate complexity elsewhere (fine) or just move it (shallow)? A file split only to stay under a size limit is not automatically deep.
9. **Test quality.** Flag tautological tests (the assertion recomputes the expected value the same way the code does) and implementation-coupled tests (mocking internal collaborators, reaching into private state). Tests should target public seams.
10. **Project rules.** The project's `CLAUDE.md` or `AGENTS.md` is part of the spec. A change that breaks one of its rules is a blocker even when the code works.

## Step 3: Report gaps

Mark each finding by priority:

- **[Blocker]** must be fixed before this ships
- **[Gap]** should be fixed, a real quality improvement
- **[Nit]** nice to have, not blocking

Format:

```
[Blocker] Security: SQL injection in user lookup
File: src/users.ts:42
Issue: The name parameter is interpolated into the query string.
Scenario: name = "'; DROP TABLE users; --" drops the table.
Fix: Use a parameterised query: db.query('SELECT * FROM users WHERE name = $1', [name])
```

Tag findings that came from a Step 0 skill with its name, for example `(via review-animations)`.

## Step 4: Fix every blocker and gap

After the findings, fix all blockers and gaps straight away. Fixes stay inside the scoped paths; a blocker in a file outside scope is reported, not fixed. For each fix, make the change, state what you fixed in one line, and commit by path:

```
git commit -m "fix(scope): what changed and why it was wrong" -- <paths you fixed>
```

## Step 5: Catch what was missed

- What would a senior engineer on this team flag in PR review?
- What edge case breaks this in production?
- What would a penetration tester try?
- What happens under load or with bad data?

Report and fix anything new using Steps 3 and 4.

## Step 6: Unit tests for critical paths

Find the parts where a bug would do real damage: core business logic, data transformations, auth flows. Write focused tests with the project's existing framework (check for Vitest, Jest, pytest or similar). Test through the public seam. Expected values come from an independent source of truth, such as a known-good literal or a worked example, never a recompute of what the code does.

Priority: happy path, then edge cases, then error handling, then security-sensitive logic.

## Step 7: Summary

- Who reviewed (agent type and model) and who confirmed
- Issues found, by priority, and how many findings were dropped as false positives
- Review skills used in Step 0
- What was fixed, with commit hashes
- Tests added
- Verdict: shippable or not, and what still blocks it

$ARGUMENTS
