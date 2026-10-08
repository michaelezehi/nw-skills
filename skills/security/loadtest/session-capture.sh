#!/usr/bin/env bash
# session-capture.sh — wrapper over the tracked load-test harness.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS="$(bash "$HERE/harness-dir.sh" loadtest)" || exit 1
exec bash "$HARNESS/loadtest/session-capture.sh" "$@"
