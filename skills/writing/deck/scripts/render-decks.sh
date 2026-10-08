#!/usr/bin/env bash
# Render every current deck to PDF, then check each one.
#
# Chrome does not exit after --print-to-pdf, and two headless instances sharing
# a profile directory silently drop each other's output: rendering the five
# decks in parallel produced one PDF and four missing files. So this runs them
# one at a time, each with its own profile, waits for the file size to stop
# changing rather than for the process to end, and kills the instance before
# starting the next.
#
#   _r&d/scripts/render-decks.sh            # all five
#   _r&d/scripts/render-decks.sh provider   # just the ones matching a word
set -uo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DECKS="$ROOT/_r&d/decks"
SCRIPTS="$ROOT/_r&d/scripts"
FILTER="${1:-}"

# directory | source | output
JOBS=(
  "renovyn-investor-deck/09-09/12-37|deck.html|Renovyn - Investor Deck.pdf"
  "renovyn-investor-deck/09-09/12-37|deck-short.html|Renovyn - Investor Deck (short).pdf"
  "renovyn-provider-deck/09-09/16-45|deck.html|Renovyn - Provider Deck.pdf"
  "renovyn-provider-deck/09-09/16-45|deck-short.html|Renovyn - Provider Deck (short).pdf"
  "pure-commission-sales-guide/09-09/18-43|deck.html|Renovyn - Pure Commission Sales Guide.pdf"
)

failed=0
for job in "${JOBS[@]}"; do
  IFS='|' read -r dir src out <<< "$job"
  [ -n "$FILTER" ] && [[ "$dir$src" != *"$FILTER"* ]] && continue

  cd "$DECKS/$dir" || { echo "missing $dir"; failed=1; continue; }
  printf '%-38s ' "$(basename "$out")"
  rm -f "$out"

  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --virtual-time-budget=15000 --user-data-dir="/tmp/render-deck-$$-$RANDOM" \
    --print-to-pdf="$PWD/$out" "file://$PWD/$src" >/dev/null 2>&1 &

  # wait for the size to settle rather than for Chrome, which never returns
  for _ in $(seq 1 8); do
    sleep 4
    [ -f "$out" ] || continue
    a=$(stat -f%z "$out"); sleep 3; b=$(stat -f%z "$out")
    [ "$a" = "$b" ] && [ "$a" -gt 200000 ] && break
  done
  pkill -f "headless" >/dev/null 2>&1
  sleep 1

  if [ ! -f "$out" ]; then echo "FAILED to render"; failed=1; continue; fi
  pages=$(node -e "const b=require('fs').readFileSync(process.argv[1]);console.log((b.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length)" "$out")

  problems=""
  node "$SCRIPTS/check-deck-safearea.mjs" "$out" >/dev/null 2>&1 || problems="$problems safearea"
  node "$SCRIPTS/check-deck-overlap.mjs" "$out"  >/dev/null 2>&1 || problems="$problems overlap"
  for c in assets figures grounds rails claims density duplication alignment chrome plain rhythm; do
    node "$SCRIPTS/check-deck-$c.mjs" "$src" >/dev/null 2>&1 || problems="$problems $c"
  done

  if [ -n "$problems" ]; then echo "$pages pages, FAILED:$problems"; failed=1
  else echo "$pages pages, all checks pass"; fi
done

exit $failed
