#!/usr/bin/env bash
# Greptile reviewer preflight — fast CLI viability probe (no review dispatch).
# Exit 0 = CLI path viable (proceed to snapshot + ONE greptile review).
# Exit 1 = CLI blocked — try Greptile MCP, then /reviewer (do NOT stop the skill).
# Exit 2 = git/remote invalid — skip Greptile entirely, go to /reviewer.
#
# IMPORTANT: Do NOT run `greptile review` here. That dispatches a full review
# (token-heavy, can hang) and duplicates the real review in step A.

set -euo pipefail

GREPTILE="${GREPTILE:-$(command -v greptile 2>/dev/null || echo /usr/local/bin/greptile)}"

if ! command -v "$GREPTILE" >/dev/null 2>&1; then
  echo "error: greptile CLI not found. Run: npm i -g greptile" >&2
  exit 1
fi

WHOAMI_OUT="$("$GREPTILE" whoami 2>&1)" || {
  echo "error: not signed in. Run: greptile login" >&2
  echo "$WHOAMI_OUT" >&2
  exit 1
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: not inside a git repository" >&2
  exit 2
fi

ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$ORIGIN" ]]; then
  echo "error: no origin remote configured" >&2
  exit 2
fi

normalize_slug() {
  local url="$1"
  local slug=""
  case "$url" in
    git@*:*/*)
      slug="${url#*:}"
      slug="${slug%.git}"
      ;;
    http://*|https://*)
      slug="${url#*://*/}"
      slug="${slug%.git}"
      ;;
    *)
      echo "error: unrecognized origin remote: $url" >&2
      return 1
      ;;
  esac
  slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]')"
  printf '%s' "$slug"
}

REPO_SLUG="$(normalize_slug "$ORIGIN")"
echo "origin: $ORIGIN"
echo "greptile slug: $REPO_SLUG"
echo "signed in: $(printf '%s\n' "$WHOAMI_OUT" | head -1)"

git fetch origin --quiet 2>/dev/null || true
echo "cli auth ok — repo connectivity checked during review round 1 (not here)"
exit 0
