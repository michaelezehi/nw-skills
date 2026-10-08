---
name: pr
description: Review PR comments from AI agents and code reviewers, fix issues, and reply to every actionable comment
argument-hint: [PR number or URL]
---

# PR Review & Fix Mode

## Task

$ARGUMENTS

## Argument Parsing

Parse from prompt:
- **PR identifier**: branch name, PR number, or PR URL (required)
- **Mode**: `detailed` (default) or `quick`
  - `detailed` — fix every issue, reply to every comment with rationale, review full diff context
  - `quick` — fix critical/blocker issues only, batch-reply to minor comments, skip nits

## Process

### 1. Fetch PR & Comments

```bash
# Get PR number from branch name if needed
gh pr list --head "<branch>" --json number -q '.[0].number'

# Get all review comments
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate

# Get issue-level comments
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --paginate

# Get PR reviews (for inline review comments)
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews --paginate
```

### 2. Categorize Comments

Sort every comment into one of these buckets:

| Category | Action |
|----------|--------|
| **Code fix required** | Fix the code and reply confirming the fix |
| **Code suggestion (valid)** | Apply the suggestion and reply confirming |
| **Code suggestion (disagree)** | Reply explaining why you're not applying it |
| **Question** | Reply with the answer |
| **Descriptive/informational** | No reply needed (e.g., PR summary, description of what changed) |

**Rule: no silent ignores.** Every comment that references code (suggestions, warnings, questions, nits) gets a reply, so the reviewer can see each point was read and resolved. The only comments that don't need replies are purely descriptive ones that summarize the PR or describe the project.

### 3. Fix Issues

For each code-related comment:
1. Read the file and line referenced in the comment
2. Understand the surrounding context
3. Apply the fix

Group related fixes into logical commits using conventional commit format,
committed by path (`git commit -m "..." -- <paths>`), never `git add -A`.

### 4. Reply to Comments

For **every** actionable comment, reply using `gh api`:

```bash
# For review comments (inline on diff)
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies \
  -f body="<reply>"

# For issue-level comments
gh api repos/{owner}/{repo}/issues/{pr_number}/comments \
  -f body="<reply>"
```

Reply templates:
- **Fixed**: `✅ Fixed in <commit-sha>. <brief explanation of what changed>`
- **Won't fix (with reason)**: `👀 Reviewed — not applying this change because: <specific reason>. The current approach <explanation>.`
- **Acknowledged**: `👀 Noted. <brief response>`

Never reply with just "noted" or "acknowledged". Include the context, so the thread records what was decided.

### 5. Fix CI/CD Failures

After committing fixes, check if CI is passing:

```bash
# Check CI status for the PR
gh pr checks <pr_number> --json name,state,conclusion
```

If any checks are failing:
1. Read the failing check logs: `gh run view <run_id> --log-failed`
2. Identify the root cause (typecheck, lint, test, build, etc.)
3. Fix the issue in code
4. Commit with `fix: resolve CI failure — <description>`
5. Push and re-check. Repeat until CI is green or you've identified an infrastructure issue outside your control.

**CI fix priority order:** typecheck > lint > tests > build > other checks.

If a CI failure is caused by an infrastructure/environment issue (e.g., flaky third-party service, expired secret, runner issue), note it in the summary and flag it to the user instead of attempting a code fix.

### 6. Push & Summarize

```bash
git push
```

Output a summary table:

```
## PR Review Summary

| # | Comment | Author | Action | Reply |
|---|---------|--------|--------|-------|
| 1 | "Use guard clause" | @coderabbit | ✅ Fixed in abc1234 | Applied guard clause |
| 2 | "Consider caching" | @reviewer | 👀 Won't fix | Already cached at service layer |
| ... | | | | |

**Stats**: X fixed / Y acknowledged / Z descriptive (no reply needed) / CI: ✅ green or ❌ <details>
```

## Rules

- **Read before fixing.** Never modify code you haven't read.
- **No scope creep.** Only fix what comments ask for. Don't refactor surrounding code.
- **Preserve intent.** If a fix conflicts with the PR's purpose, flag it instead of blindly applying.
- **Atomic commits.** Group related fixes, don't lump everything into one commit.
- **Test after fixing.** If the project has tests, run them before pushing.
- In `quick` mode, still reply to every comment — just batch minor ones into a single reply thread.

## Start

Parse the PR identifier and mode from the prompt, fetch the PR, and begin.
