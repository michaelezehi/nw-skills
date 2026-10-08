#!/usr/bin/env bash
# scope-guard.sh — wrapper over the tracked resilience scope guard.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS="$(bash "$HERE/harness-dir.sh" resilience)" || exit 1
exec bash "$HARNESS/resilience/scope-guard.sh" "$@"
