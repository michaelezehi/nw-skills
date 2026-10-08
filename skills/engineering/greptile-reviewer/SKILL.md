---
name: greptile-reviewer
description: RETIRED as a review gate — do NOT select this automatically. The standard reviewer is `/reviewer`. Use this ONLY when the user explicitly types /greptile-reviewer or names Greptile by name. Legacy Greptile CLI/MCP review loop, thread-scoped.
---

# Greptile Reviewer — RETIRED as the default gate

> **Retired 2026-07-25 by user instruction.** The standard review gate for all
> work is now **`/reviewer`** (`~/.claude/commands/reviewer.md`). Never select
> this skill on your own, never use it as a review gate, and never use it to
> satisfy `own-goal` Step 6 or the Auto-Reviewer rule in `~/.claude/CLAUDE.md`.
>
> **If you arrived here looking for a code review, stop and run `/reviewer`.**
>
> Why: Greptile failed repeatedly on this machine — CLI dispatch timeouts,
> a `SyntaxError: Invalid regular expression flags` from its Node 18 bundle,
> stalls on "Reviewing files…", and an MCP path that cannot review local-only
> work because it requires an open PR. Multiple past runs already fell back to
> `/reviewer`; that fallback is now the default.
>
> The instructions below still work and are kept for the explicit-invocation
> case only — when the user types `/greptile-reviewer` or asks for Greptile by
> name. The thread-scoping rules below remain binding whenever it does run.

## Legacy instructions — explicit invocation only

*Everything below applies **only** when the user has explicitly asked for
Greptile by name. It is not a review gate. If you reached this section without
an explicit user request for Greptile, stop and run `/reviewer` instead.*

### Hard rule: thread scope only

**Never review, fix, or snapshot files touched by other agents or prior sessions.**

Greptile runs on **session-scoped paths only**. If scope is empty, **stop** — do not fall back to `git add -A`, full porcelain, or unpushed commits on the branch.

| Allowed | Forbidden |
|---------|-----------|
| Paths in `session-baseline.sh record` (this thread's edits) | Pre-existing dirty files not recorded (other agents) |
| Brand-new untracked files created after `init` | `git add -A`, full porcelain, branch-wide unpushed diff |
| User-named paths merged into scope at setup | Staged WIP from another task |
| Re-review of same recorded scope after fixes | Fixing findings outside scope |

### How scope is computed

At **setup**, run once:

```bash
SCRATCHPAD="${SCRATCHPAD:-/tmp/greptile-reviewer-$$}"
mkdir -p "$SCRATCHPAD"
bash ~/.claude/skills/greptile-reviewer/scripts/session-baseline.sh init
```

**Whenever this thread edits a file**, record it immediately:

```bash
bash ~/.claude/skills/greptile-reviewer/scripts/session-baseline.sh record apps/api/convex-out/convex/schema.ts
```

At **snapshot/review** time:

```bash
mapfile -t SESSION_PATHS < <(bash ~/.claude/skills/greptile-reviewer/scripts/session-baseline.sh paths)
echo "session scope: ${#SESSION_PATHS[@]} files"
```

Scope = **recorded paths** + **new untracked files** (not in baseline at `init`). Nothing else.

**Agents:** call `record` after every `Write`/`Edit`. Before greptile, bulk-record paths edited earlier in the same thread if not already recorded.

---

## Hard rule: never swap branches

**Stay on the branch other agents are using — usually `main`.** Do not `git checkout`, `git switch`, or `git checkout -b` on the repo the user is working in.

| Do | Don't |
|----|-------|
| Run setup, fixes, and `session-baseline.sh` on **whatever branch is current** | `git checkout greptile-review-snapshot` on the main working tree |
| Build the Greptile diff via **isolated index + `/tmp` worktree** (`safe-snapshot.sh`) | `git checkout -b greptile-review-snapshot` in the repo |
| `cd "$WORKTREE"` only inside `/tmp/greptile-reviewer-*/wt` for `greptile review` | `git reset --hard` on the user's branch |
| Leave `ORIG_BRANCH` exactly as found (`main` or otherwise) | Create feature branches for greptile |

Temp refs `greptile-base-tmp` / `greptile-review-snapshot` are **pointer-only** for the isolated worktree — never checked out in the main tree. Other agents keep working on `main` undisturbed.

---

## Double-check, not triple-check

**Token rule:** At most two verification passes (verify-only) or two Greptile rounds (fix loop). No Greptile + `/reviewer` + explore subagents on the same scope.

| Mode | Pass 1 | Pass 2 |
|------|--------|--------|
| **Verify-only** | Narrow local test on `SESSION_PATHS` only | One scoped Greptile review |
| **Review + fix** | Greptile on `SESSION_PATHS` → fix **only those files** | One re-review, same scope |

Greptile stall + Pass 1 green → stop; report both. No `/reviewer` pile-on for verify-only.

**Hard cap:** 2 Greptile rounds. Same finding after one fix → gap, stop.

---

## Setup (once per run)

```bash
GREPTILE=$(command -v greptile || echo /usr/local/bin/greptile)
ENGINE=cli
eval "$(bash ~/.claude/skills/greptile-reviewer/scripts/repo-slug.sh)"

ORIG_BRANCH=$(git branch --show-current)
ORIG_HEAD=$(git rev-parse HEAD)
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "origin/$DEFAULT_BRANCH")
SCRATCHPAD="${SCRATCHPAD:-/tmp/greptile-reviewer-$$}"
mkdir -p "$SCRATCHPAD"

git status --porcelain > "$SCRATCHPAD/pre-review-status.txt"
bash ~/.claude/skills/greptile-reviewer/scripts/session-baseline.sh init

bash ~/.claude/skills/greptile-reviewer/scripts/preflight.sh || PREFLIGHT=$?
```

| `PREFLIGHT` | Next |
|-------------|------|
| `0` | `ENGINE=cli` |
| `1` | MCP once → `/reviewer` only if fix loop |
| `2` | Stop (verify-only) or `/reviewer` (fix loop) |

**Preflight never dispatches a review** — auth + git only (~2s).

If `greptile-review-snapshot` / `greptile-base-tmp` exist → ask before `clear-local.sh`.
Exclude secret-looking paths (`.env*`, `*.pem`, `*key*`, `*credential*`).

---

## Snapshot (session paths only)

Greptile runs from a separate `/tmp` worktree, per "never swap branches" above.

```bash
# Confirm we never left the active branch (e.g. main)
test "$(git branch --show-current)" = "$ORIG_BRANCH"

mapfile -t SESSION_PATHS < <(bash ~/.claude/skills/greptile-reviewer/scripts/session-baseline.sh paths)

eval "$(bash ~/.claude/skills/greptile-reviewer/scripts/safe-snapshot.sh "$UPSTREAM" "${SESSION_PATHS[@]}")"
cd "$WORKTREE"   # /tmp only — NOT the main repo checkout
timeout 300 "$GREPTILE" review -b greptile-base-tmp --agent 2>&1 | tee "$SCRATCHPAD/review-round.txt"
cd - >/dev/null
```

`safe-snapshot.sh` = isolated `GIT_INDEX_FILE` + temp worktree; main checkout untouched.

**Stall rule:** `Reviewing files…` >3min → `greptile review show <id>` once → kill local CLI → stop. Warn: concurrent reviews in other projects clog the queue.

**Cleanup:** `bash ~/.claude/skills/greptile-reviewer/scripts/clear-local.sh`

---

## The loop (max 2 rounds)

### A — Review (CLI)

Scoped snapshot + review as above.

### B — Verify main tree untouched

```bash
test "$(git branch --show-current)" = "$ORIG_BRANCH"
diff <(git status --porcelain) "$SCRATCHPAD/pre-review-status.txt"   # must match
```

### C — Triage

Parse findings. **Drop findings outside `SESSION_PATHS`** — note as out-of-scope, do not fix. MCP enrichment only when in-scope P1/P2 exist.

### D — Fix (fix-loop only)

Fix **only files in `SESSION_PATHS`**. After each fix: `session-baseline.sh record <path>`. No drive-by edits elsewhere.

### E — Re-review (round 2)

Recompute scope (same rules), snapshot, one more review. Stop after round 2.

---

## Greptile MCP (fallback)

PR-only. Filter MR comments to paths in `SESSION_PATHS`. No open PR → skip MCP.

---

## `/reviewer` fallback (fix-loop only)

> **Naming note (2026-07-25):** "fallback" here is local to an explicit Greptile
> run. Globally the relationship is inverted — `/reviewer` is the **primary and
> only** review gate, and Greptile is what you no longer reach for. See the
> retirement banner at the top of this file.

Scope = `SESSION_PATHS` only — not full unpushed diff. Header: `Greptile unavailable — /reviewer fallback (thread scope)`.

---

## Report

List **session scope** (file count + paths) before findings table. Final: engine, rounds, scope, Pass 1, Greptile/stall, skip list.

## Guardrails

- **Never swap branches** in the user's repo — stay on `main`/active branch; review from `/tmp` worktree only.
- **Thread scope only** — zero cross-agent file touches in review or fix.
- Never push; never commit to the user's branch.
- Never `git add -A` for greptile snapshots.
- Fail fast on hung Greptile; `clear-local.sh` for local cleanup (server queue cannot be cancelled).
- Fixer agent: touch only implicated paths **that are in scope**.
