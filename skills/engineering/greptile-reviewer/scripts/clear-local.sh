#!/usr/bin/env bash
# Clear local Greptile artifacts only (processes, temp branches, worktrees).
# Does NOT cancel server-side IN_FLIGHT reviews — Greptile has no cancel API.

set -euo pipefail

pkill -f 'greptile review -b greptile-base-tmp' 2>/dev/null || true
pkill -f 'timeout.*greptile review' 2>/dev/null || true

git worktree list --porcelain 2>/dev/null | awk '/worktree / {print $2}' | while read -r wt; do
  case "$wt" in
    */greptile-reviewer-*/wt|*/tmp/greptile-reviewer-*/wt)
      git worktree remove "$wt" --force 2>/dev/null || true
      ;;
  esac
done
git worktree prune 2>/dev/null || true

git branch -D greptile-review-snapshot greptile-base-tmp 2>/dev/null || true

find /tmp -maxdepth 1 -name 'greptile-reviewer-*' -type d 2>/dev/null | while read -r d; do
  rm -rf "$d" 2>/dev/null || true
done

echo "local greptile artifacts cleared (server IN_FLIGHT queue unchanged)"
