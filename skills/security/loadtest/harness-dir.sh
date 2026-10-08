#!/usr/bin/env bash
# harness-dir.sh — print the path of the TRACKED security harness.
#
# The probe catalog, the load-test harness and the resilience drills used to live
# in this skill directory, which meant they existed only on one laptop: no CI
# could run them and no auditor could be shown a cadence. They now live in
# version control at <optic-qa-ai>/packages/security-harness, and this skill is a
# wrapper over that copy. One catalog, not two.
#
# Usage: harness-dir.sh [required-subdir]
# Override the location with OPTIC_HARNESS_DIR.
set -uo pipefail

DEFAULT="$HOME/Documents/src/__new-world__/optic-qa-ai/packages/security-harness"
DIR="${OPTIC_HARNESS_DIR:-$DEFAULT}"
NEED="${1:-probes}"

if [ ! -d "$DIR/$NEED" ]; then
  cat >&2 <<MSG
harness: the tracked security harness is not at
    $DIR
  (looked for $DIR/$NEED)

  It lives in git, at <optic-qa-ai>/packages/security-harness. Either clone that
  repo to the default path above, or point OPTIC_HARNESS_DIR at your checkout:

    export OPTIC_HARNESS_DIR=/path/to/optic-qa-ai/packages/security-harness
MSG
  exit 1
fi

printf '%s\n' "$DIR"
