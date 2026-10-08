#!/usr/bin/env bash
# Build a scoped snapshot commit WITHOUT touching the caller's working tree or branch.
#
# Usage:
#   safe-snapshot.sh <upstream-ref> <path1> [path2 ...]
# Prints SNAPSHOT_COMMIT=<sha> and WORKTREE=<dir> on stdout.
#
# - Uses isolated GIT_INDEX_FILE (no checkout on main / active branch).
# - Review runs in SCRATCHPAD/wt — never git checkout in the main repo.
# - Never runs git reset --hard on the caller's branch.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: safe-snapshot.sh <upstream-ref> <path>..." >&2
  exit 2
fi

UPSTREAM="$1"
shift
PATHS=("$@")

SCRATCHPAD="${SCRATCHPAD:-/tmp/greptile-reviewer-$$}"
mkdir -p "$SCRATCHPAD"
INDEX="$SCRATCHPAD/snapshot.index"
LIST="$SCRATCHPAD/snapshot-paths.txt"
printf '%s\n' "${PATHS[@]}" >"$LIST"

export GIT_INDEX_FILE="$INDEX"
rm -f "$INDEX"
git read-tree "$UPSTREAM"

MISSING=0
while IFS= read -r f; do
  if [[ -f "$f" ]]; then
    git add -- "$f"
  else
    echo "warning: missing path (skipped): $f" >&2
    MISSING=$((MISSING + 1))
  fi
done <"$LIST"
unset GIT_INDEX_FILE

if [[ "$MISSING" -eq ${#PATHS[@]} ]]; then
  echo "error: no snapshot paths exist on disk" >&2
  exit 1
fi

export GIT_INDEX_FILE="$INDEX"
TREE="$(git write-tree)"
unset GIT_INDEX_FILE

COMMIT="$(git commit-tree "$TREE" -p "$UPSTREAM" -m "chore: greptile review snapshot [temp]")"
git branch -f greptile-base-tmp "$UPSTREAM" 2>/dev/null || git branch -f greptile-base-tmp "$UPSTREAM"
git branch -f greptile-review-snapshot "$COMMIT"

WT="$SCRATCHPAD/wt"
rm -rf "$WT"
git worktree add "$WT" greptile-review-snapshot >/dev/null

echo "SNAPSHOT_COMMIT=$COMMIT"
echo "WORKTREE=$WT"
echo "BASE_BRANCH=greptile-base-tmp"
