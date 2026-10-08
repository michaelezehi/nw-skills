#!/usr/bin/env bash
# run.sh — wrapper over the TRACKED resilience harness.
#
# The harness itself lives in version control at
# <optic-qa-ai>/packages/security-harness/resilience/ so CI, a droplet and this
# skill all run the same code. This file only resolves that path and hands over
# every argument untouched — including the scope guard, which still runs before
# any traffic leaves the machine.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS="$(bash "$HERE/harness-dir.sh" resilience)" || exit 1
exec bash "$HARNESS/resilience/run.sh" "$@"
