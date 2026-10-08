# Owned files only: the scope rule for agents sharing one branch

Several agents work the same checkout and the same branch at once. Every
blockage we have measured came from one agent stepping outside its own task:
reverting a file it did not write, "fixing" a sibling's half-done edit,
staging the whole tree, or reviewing the whole branch and then patching
someone else's work. This file is the rule that stops that. It binds every
agent (driver, leaf, reviewer, supervisor) in every skill and every harness.

## The rule

1. **Your task defines your files.** Before the first edit, write down the
   paths your task owns. Everything else on the branch belongs to someone
   else until they finish. `git status --porcelain` at the start of your
   task lists what is already claimed: every `M`, `A`, `??` path there is
   another agent's, unless the user assigned it to you by name.
2. **Touch nothing outside that list.** No edits, no reverts, no restores,
   no reformatting, no "tidy while I am here", no deleting a file you did
   not create. If a file outside your list looks broken, report the path
   and carry on. Repair is the owner's job, or the user's.
3. **Never undo another agent's work, even inside a shared file.** When you
   must edit a file another agent also has open, change only your hunks and
   leave theirs exactly as you found them, including hunks that look wrong.
   Commit only your hunks (`git commit -- <path>` after a hunk-filtered
   stage), and say in the report that the file carries someone else's
   unfinished work.
4. **A file you finished with is released.** Once your commit lands, the
   path is free. The next agent whose task needs it picks it up then, not
   before. Do not hold a file "in case"; do not reopen a released file to
   polish it under another agent's task.
5. **Review only what you touched.** A reviewer pass (`/reviewer`, a
   supervisor pass, a fresh-eyes check, an auto-review after a skill) is
   scoped to the paths the task under review owns and the commits that task
   made. It reads unchanged code only where a changed line calls into it. It
   never reviews, patches, or reverts another agent's in-flight files, and
   it never widens its scope to "the branch" or "the diff since main"
   because those contain other agents' work. Their tasks get their own
   review when they finish.
6. **Stage and commit by path, never by tree.** `git add -A`, `git add .`,
   `git add -u`, `git commit -a` and a bare `git commit` after `git add`
   all ship whatever another agent has staged. Pass your paths to
   `git commit` itself: `git commit -m "..." -- <your paths>`.
7. **Finished with a file or a set of files: check it in and commit it, right
   then.** Not at the end of the task, not after the next file. The commit
   message says what changed and why it was wrong before, with numbers
   where there are any. Uncommitted finished work is the only work another
   agent can destroy, and a single end-of-task commit destroys the history
   that makes the work reviewable. Several small commits per task is the
   norm.
8. **Never restore, checkout, stash, reset or clean.** Each of these
   discards another agent's uncommitted work. The git safety hook refuses
   them. If the tree looks wrong, report what `git status` shows and stop.

## What "your files" means for a sub-agent

A dispatched leaf owns exactly the paths named in its brief. Generated
output that rides with a source change (i18n bundles, parity baselines,
`_generated`, lockfiles) is owned by whoever changed the source, in the
same commit. A leaf that needs a path outside its brief stops and reports;
it does not take the path. The driver either widens the brief or does that
piece itself. Two leaves are never given the same path; if the plan needs
that, the plan is wrong.

## What "your files" means for a reviewer

The reviewer receives the task's path list and commit list in its brief and
reviews those. A finding in a file outside the list is reported as
"outside scope, owned by another task" and left alone, not fixed. Fixes the
reviewer applies stay inside the list and are committed by path. When the
reviewer is invoked with no explicit list, it derives one from the commits
the current task made and the paths the current task edited, never from
`git diff main` or the whole working tree.

## Why

- A revert of a file you do not own deletes hours of someone else's work
  and nobody notices until their tests fail.
- A whole-branch review re-reviews every agent's work on every task, so
  five parallel tasks pay for twenty-five reviews, and the fixes collide.
- Tree-wide staging commits half-finished edits under the wrong message,
  which breaks bisect and blame for the person debugging it later.

Companion rules: `AGENTS.md` "Shared working tree: claim, commit, release"
(the commit protocol), `agent-skills/git-guardrails/SKILL.md` (the hook
that refuses the destructive commands), and the "Delegation directive" in
`~/.claude/CLAUDE.md` (a returned piece is accepted only when its diff
stays in its owned files).
