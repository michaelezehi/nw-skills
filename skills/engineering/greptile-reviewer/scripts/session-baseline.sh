#!/usr/bin/env bash
# Thread/session file scope for Greptile — never review other agents' dirty work.
#
# Usage:
#   session-baseline.sh init              # once at greptile setup
#   session-baseline.sh record <path>     # call when THIS thread edits a file
#   session-baseline.sh paths             # paths in scope (stdout)
#   session-baseline.sh count             # path count; exit 1 if zero
#
# Scope = recorded paths this thread (+ auto-include brand-new untracked files
# not present at init). Does NOT include pre-existing dirty files unless
# explicitly recorded after a hash change is detected on that path.

set -euo pipefail

SCRATCHPAD="${SCRATCHPAD:-/tmp/greptile-reviewer-$$}"
mkdir -p "$SCRATCHPAD"

BASELINE_DIRTY="$SCRATCHPAD/session-baseline-dirty.txt"
BASELINE_UNTRACKED="$SCRATCHPAD/session-baseline-untracked.txt"
RECORDED="$SCRATCHPAD/session-paths.txt"
INIT_MARKER="$SCRATCHPAD/session-baseline.init"

was_untracked_at_init() {
  local f="$1"
  grep -qxF "$f" "$BASELINE_UNTRACKED" 2>/dev/null
}

is_secret_path() {
  case "$1" in
    .env*|*.env|*.pem|*.key|*credential*|*secret*) return 0 ;;
    *) return 1 ;;
  esac
}

cmd_init() {
  : >"$RECORDED"
  : >"$BASELINE_DIRTY"
  : >"$BASELINE_UNTRACKED"

  git ls-files --others --exclude-standard | sort -u >"$BASELINE_UNTRACKED"

  # Track which paths were dirty at init (no bulk hashing — hash on demand in `paths`)
  {
    git diff --name-only
    git diff --cached --name-only
  } | sort -u >"$BASELINE_DIRTY"

  date -u +"%Y-%m-%dT%H:%M:%SZ" >"$INIT_MARKER"
  local n_tracked n_unt
  n_tracked=$(wc -l <"$BASELINE_DIRTY" | tr -d ' ')
  n_unt=$(wc -l <"$BASELINE_UNTRACKED" | tr -d ' ')
  echo "session baseline: ${n_tracked} tracked-dirty, ${n_unt} untracked at init"
}

cmd_record() {
  [[ $# -ge 1 ]] || { echo "usage: session-baseline.sh record <path>" >&2; exit 2; }
  local f="${1#./}"
  grep -qxF "$f" "$RECORDED" 2>/dev/null || echo "$f" >>"$RECORDED"
}

cmd_paths() {
  [[ -f "$INIT_MARKER" ]] || { echo "error: run session-baseline.sh init first" >&2; exit 2; }

  local OUT="$SCRATCHPAD/session-scope-final.txt"
  : >"$OUT"

  # (1) Recorded paths — primary scope (this thread only)
  if [[ -f "$RECORDED" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ -f "$f" ]] || continue
      is_secret_path "$f" && { echo "warning: excluding: $f" >&2; continue; }
      echo "$f" >>"$OUT"
    done <"$RECORDED"
  fi

  # (2) Brand-new untracked files (created after init)
  git ls-files --others --exclude-standard | sort -u | while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    was_untracked_at_init "$f" && continue
    is_secret_path "$f" && { echo "warning: excluding: $f" >&2; continue; }
    echo "$f" >>"$OUT"
  done

  if [[ ! -s "$OUT" ]]; then
    echo "error: zero paths in session scope — use record after each edit in this thread" >&2
    exit 1
  fi

  sort -u "$OUT"
}

cmd_count() {
  cmd_paths | wc -l | tr -d ' '
}

case "${1:-}" in
  init) shift; cmd_init "$@" ;;
  record) shift; cmd_record "$@" ;;
  paths) shift; cmd_paths "$@" ;;
  count) shift; cmd_count "$@" ;;
  *)
    echo "usage: session-baseline.sh {init|record <path>|paths|count}" >&2
    exit 2
    ;;
esac
