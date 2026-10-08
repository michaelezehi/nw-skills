#!/usr/bin/env bash
# ram-report.sh : coloured before/after table for a clean-ram run.
# Usage: ram-report.sh --before <snapshot> [--after <snapshot>] [--actions <tsv>]
# With no --after, the current live state is used.

set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$DIR/lib-mem.sh"

BEFORE=""; AFTER=""; ACTIONS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --before)  BEFORE="$2"; shift 2 ;;
    --after)   AFTER="$2"; shift 2 ;;
    --actions) ACTIONS="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -f "$BEFORE" ] || { echo "${RED}need --before <snapshot>${RST}"; exit 1; }
if [ -z "$AFTER" ]; then AFTER="$STATE_DIR/after.$$"; snapshot_write "$AFTER"; fi

W1=32; W2=24; W3=11
line() { printf '%s' "$DIM"; printf '%*s' "$1" '' | tr ' ' '-'; printf '%s\n' "$RST"; }

# ---------------- what was done ----------------
echo
echo "${BOLD}WHAT CLEAN-RAM DID${RST}"
line 72
if [ -n "$ACTIONS" ] && [ -s "$ACTIONS" ]; then
  printf "  %s%s %s %s%s\n" "$BOLD" "$(pad "ACTION" $W1)" "$(pad "ISSUE" $W2)" "$(pad "FREED" $W3)" "$RST"
  line 72
  while IFS=$'\t' read -r act issue freed detail; do
    [ -z "$act" ] && continue
    printf "  %s %s %s%s%s\n" \
      "$(pad "$(trunc "$act" $W1)" $W1)" \
      "$(pad "$(trunc "$issue" $W2)" $W2)" \
      "$GRN" "$(pad "$(mb_human "$freed")" $W3)" "$RST"
    [ -n "${detail:-}" ] && printf "  %s%s%s\n" "$DIM" "$(trunc "$detail" 66)" "$RST"
  done < "$ACTIONS"
else
  echo "  ${DIM}no kill actions recorded (diagnosis only)${RST}"
fi

# ---------------- before / after ----------------
bu=$(snap_get "$BEFORE" swap_used_mb); au=$(snap_get "$AFTER" swap_used_mb)
bt=$(snap_get "$BEFORE" swap_total_mb); at=$(snap_get "$AFTER" swap_total_mb)
bf=$(snap_get "$BEFORE" free_pct);     af=$(snap_get "$AFTER" free_pct)
br=$(snap_get "$BEFORE" rss_total_mb); ar=$(snap_get "$AFTER" rss_total_mb)
bp=$(snap_get "$BEFORE" proc_count);   ap=$(snap_get "$AFTER" proc_count)

echo
echo "${BOLD}BEFORE AND AFTER${RST}"
line 72
printf "  %s%s %s %s %s%s\n" "$BOLD" "$(pad "METRIC" 22)" "$(pad "BEFORE" 13)" "$(pad "AFTER" 13)" "$(pad "CHANGE" 16)" "$RST"
line 72

row() { # name, before, after, unit(mb|pct|count), direction(down_good|up_good)
  local name="$1" b="$2" a="$3" unit="$4" dir="$5"
  local bs as delta col arrow
  case "$unit" in
    mb)    bs=$(mb_human "$b"); as=$(mb_human "$a") ;;
    pct)   bs="${b:-?}%";       as="${a:-?}%" ;;
    *)     bs="${b:-?}";        as="${a:-?}" ;;
  esac
  delta=$(awk -v b="${b:-0}" -v a="${a:-0}" 'BEGIN{printf "%.0f", a-b}')
  col="$DIM"; arrow="="
  if [ "$delta" -gt 0 ] 2>/dev/null; then
    arrow="up"; [ "$dir" = "up_good" ] && col="$GRN" || col="$RED"
  elif [ "$delta" -lt 0 ] 2>/dev/null; then
    arrow="down"; [ "$dir" = "down_good" ] && col="$GRN" || col="$RED"
  fi
  local ds
  case "$unit" in
    mb)  ds="$(mb_human "${delta#-}") $arrow" ;;
    pct) ds="${delta#-} points $arrow" ;;
    *)   ds="${delta#-} $arrow" ;;
  esac
  [ "$arrow" = "=" ] && ds="no change"
  printf "  %s %s %s %s%s%s\n" \
    "$(pad "$name" 22)" "$(pad "$bs" 13)" "$(pad "$as" 13)" "$col" "$(pad "$ds" 16)" "$RST"
}

row "free memory"    "${bf:-0}" "${af:-0}" pct   up_good
row "swap used"      "${bu:-0}" "${au:-0}" mb    down_good
row "swap allocated" "${bt:-0}" "${at:-0}" mb    down_good
row "resident total" "${br:-0}" "${ar:-0}" mb    down_good
row "processes"      "${bp:-0}" "${ap:-0}" count down_good

# ---------------- verdict ----------------
gain=$(awk -v b="${bf:-0}" -v a="${af:-0}" 'BEGIN{printf "%.0f", a-b}')
swf=$(awk -v b="${bu:-0}" -v a="${au:-0}" 'BEGIN{printf "%.0f", b-a}')
echo
if [ "${swf:-0}" -gt 200 ] 2>/dev/null || [ "${gain:-0}" -gt 3 ] 2>/dev/null; then
  echo "  ${GRN}${BOLD}RECOVERED${RST} ${GRN}$(mb_human "$swf") of swap, free memory ${bf:-?}% to ${af:-?}%${RST}"
else
  echo "  ${YEL}little change. the pressure is elsewhere, re-run the scan.${RST}"
fi
sp=$(snap_get "$AFTER" swap_used_mb); st=$(snap_get "$AFTER" swap_total_mb)
pct=$(awk -v u="${sp:-0}" -v t="${st:-1}" 'BEGIN{if(t+0==0){print 0;exit}printf "%.0f",u/t*100}')
[ "$pct" -ge 90 ] 2>/dev/null && \
  echo "  ${RED}swap still at ${pct}%. something is still holding memory.${RST}"
echo
