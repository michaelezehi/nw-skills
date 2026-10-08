#!/usr/bin/env bash
# Print Greptile repo coordinates from git origin (lowercase owner/repo).
# Usage: eval "$(bash repo-slug.sh)"  →  REPO_SLUG, REPO_REMOTE, DEFAULT_BRANCH

set -euo pipefail

ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$ORIGIN" ]]; then
  echo "REPO_SLUG=" >&2
  exit 2
fi

case "$ORIGIN" in
  git@github.com:*|https://github.com/*|http://github.com/*) REMOTE=github ;;
  git@gitlab.com:*|https://gitlab.com/*) REMOTE=gitlab ;;
  *) REMOTE=github ;;
esac

case "$ORIGIN" in
  git@*:*/*)
    SLUG="${ORIGIN#*:}"
    SLUG="${SLUG%.git}"
    ;;
  http://*|https://*)
    SLUG="${ORIGIN#*://*/}"
    SLUG="${SLUG%.git}"
    ;;
  *)
    echo "error: unrecognized origin: $ORIGIN" >&2
    exit 2
    ;;
esac

SLUG="$(printf '%s' "$SLUG" | tr '[:upper:]' '[:lower:]')"
DEFAULT_BRANCH="$(
  git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' || echo main
)"

printf 'REPO_SLUG=%q\n' "$SLUG"
printf 'REPO_REMOTE=%q\n' "$REMOTE"
printf 'REPO_ORIGIN=%q\n' "$ORIGIN"
printf 'DEFAULT_BRANCH=%q\n' "$DEFAULT_BRANCH"
printf 'CURRENT_BRANCH=%q\n' "$(git branch --show-current)"
