#!/usr/bin/env bash
# run.sh — wrapper over the TRACKED load-test harness.
#
# The harness itself lives in version control at
# <optic-qa-ai>/packages/security-harness/loadtest/ so CI, a droplet and this
# skill all run the same code. This file only resolves that path and hands over
# every argument untouched.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS="$(bash "$HERE/harness-dir.sh" loadtest)" || exit 1
exec bash "$HARNESS/loadtest/run.sh" "$@"
