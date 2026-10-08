#!/usr/bin/env bash
# ram-scan.sh : find what is actually eating memory on macOS.
# Usage: ram-scan.sh [--snapshot <file>] [--min-herd N] [--top N]
#
# Prints: headline pressure, process herds (many copies of one command),
# single heavyweights, and the likely spawner behind the largest herd.

set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$DIR/lib-mem.sh"

SNAP=""; MIN_HERD=2; TOP=12
while [ $# -gt 0 ]; do
  case "$1" in
    --snapshot) SNAP="$2"; shift 2 ;;
    --min-herd) MIN_HERD="$2"; shift 2 ;;
    --top)      TOP="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$SNAP" ] && snapshot_write "$SNAP"

SW_USED=$(swap_field used); SW_TOTAL=$(swap_field total)
FREEP=$(free_pct); RSS=$(rss_total_mb); PHYS=$(phys_mb)
SW_PCT=$(awk -v u="${SW_USED:-0}" -v t="${SW_TOTAL:-1}" 'BEGIN{if(t+0==0){print 0;exit}printf "%.0f", u/t*100}')

echo
echo "${BOLD}MEMORY PRESSURE${RST}  ${DIM}$(date '+%H:%M:%S')${RST}"
echo "$(rule 66)"

fc="$GRN"; [ "${FREEP:-100}" -lt 40 ] 2>/dev/null && fc="$YEL"
[ "${FREEP:-100}" -lt 20 ] 2>/dev/null && fc="$RED"
printf "  %-22s %s%s%%%s free   %sof %s installed%s\n" \
  "physical memory" "$fc" "${FREEP:-?}" "$RST" "$DIM" "$(mb_human "$PHYS")" "$RST"

sc="$GRN"; [ "$SW_PCT" -ge 70 ] 2>/dev/null && sc="$YEL"
[ "$SW_PCT" -ge 90 ] 2>/dev/null && sc="$RED"
printf "  %-22s %s%s of %s (%s%%)%s\n" \
  "swap used" "$sc" "$(mb_human "$SW_USED")" "$(mb_human "$SW_TOTAL")" "$SW_PCT" "$RST"
printf "  %-22s %s across %s processes\n" "resident total" "$(mb_human "$RSS")" "$(proc_count)"

if [ "$SW_PCT" -ge 90 ] 2>/dev/null; then
  echo
  echo "  ${RED}${BOLD}SWAP EXHAUSTED.${RST} ${RED}Processes will stall in uninterruptible"
  echo "  page-in wait and may ignore SIGKILL until memory frees. Expect the"
  echo "  first kill sweep to leave stragglers. This is the death spiral.${RST}"
fi

PSLIST="$STATE_DIR/ps.$$"
ps -Ao pid,ppid,rss,%cpu,stat,command 2>/dev/null | tail -n +2 > "$PSLIST"

echo
echo "${BOLD}HERDS${RST} ${DIM}(one command running many times, the usual real culprit)${RST}"
echo "$(rule 66)"
HERDS="$STATE_DIR/herds.$$"
awk "$SIG_AWK"'
{ num[sig]++; tot[sig]+=rss; cpu[sig]+=pcpu
  if (stat ~ /U/) stuck[sig]++ }
END { for (s in num) printf "%d\t%.0f\t%s\t%d\t%.0f\n", num[s], tot[s]/1024, s, stuck[s]+0, cpu[s] }
' "$PSLIST" | sort -k2 -nr > "$HERDS"

found=0
while IFS=$'\t' read -r n mb sig stuck cpu; do
  [ "$n" -lt "$MIN_HERD" ] && continue
  [ "$mb" -lt 200 ] && continue
  found=$((found+1)); [ "$found" -gt "$TOP" ] && break
  c="$YEL"; [ "$mb" -ge 2000 ] && c="$RED"; [ "$n" -ge 10 ] && c="$RED"
  printf "  %s%3dx%s  %s%9s%s  %s" "$c" "$n" "$RST" "$BOLD" "$(mb_human "$mb")" "$RST" "$(pad "$(trunc "$sig" 38)" 38)"
  [ "${stuck:-0}" -gt 0 ] && printf "  %s%d stuck%s" "$RED" "$stuck" "$RST"
  printf "\n"
done < "$HERDS"
[ "$found" -eq 0 ] && echo "  ${DIM}no significant herds${RST}"

echo
echo "${BOLD}SINGLE HEAVYWEIGHTS${RST}"
echo "$(rule 66)"
sort -k3 -nr "$PSLIST" | head -8 | while read -r pid ppid rss pcpu stat rest; do
  mb=$((rss/1024)); [ "$mb" -lt 150 ] && continue
  c=""; [ "$mb" -ge 1000 ] && c="$YEL"; [ "$mb" -ge 2000 ] && c="$RED"
  printf "  %s%-7s%s %s%9s%s %5s%%  %s\n" "$DIM" "$pid" "$RST" "$c" "$(mb_human "$mb")" "$RST" "$pcpu" "$(trunc "$rest" 44)"
done

TOPSIG=$(head -1 "$HERDS" | cut -f3)
TOPN=$(head -1 "$HERDS" | cut -f1)
if [ -n "$TOPSIG" ] && [ "${TOPN:-0}" -ge "$MIN_HERD" ]; then
  echo
  echo "${BOLD}LIKELY SPAWNER${RST} ${DIM}for herd: $TOPSIG${RST}"
  echo "$(rule 66)"
  echo "  ${DIM}kill this first, or the herd refills within seconds${RST}"
  awk "$SIG_AWK"'{ if (sig == S) print ppid }' S="$TOPSIG" "$PSLIST" \
    | sort -u | while read -r pp; do
        [ "$pp" = "1" ] && continue
        ps -p "$pp" -o pid=,command= 2>/dev/null | head -1 | sed 's/^/  /' | cut -c1-72
      done | sort -u | head -6
  echo "  ${DIM}(walk further with: ps -p <ppid> -o ppid=)${RST}"
fi
rm -f "$PSLIST" "$HERDS"
echo
