---
description: "Reviews a GitHub pull request with due diligence: checks it out in a worktree, runs its tests and app, proves bug fixes with base reproduction and revert checks, deduplicates against review bots, renders an optional HTML report, and posts only findings you pick."
argument-hint: "<PR URL or number> [--html] [--comment]"
---

Run the `pr-review` skill (`~/.claude/skills/pr-review/SKILL.md`) on: $ARGUMENTS

Follow it completely, including Step 3 (worktree, tests, running app, and for bug-fix PRs the base reproduction and revert check). Every finding in the report carries its proof. Nothing is posted until the user names the IDs.
