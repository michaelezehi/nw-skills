#!/usr/bin/env bash
# ram-kill.sh : kill a memory herd safely. Dry run unless --yes is passed.
#
# Usage:
#   ram-kill.sh --sig "tsc --noEmit" [--spawner "gate-check.mjs"] [--yes]
#   ram-kill.sh --match "regex against full command" [--yes]
#   ram-kill.sh --pids "123 456" [--yes]
#
# Options:
#   --spawner RE   kill these first, or the herd refills within seconds
#   --rounds N     kill sweeps (default 3); swap-starved procs ignore SIGKILL
#                  until they get scheduled, so one pass is never enough
#   --allow-claude permit killing claude CLI sessions (refused by default)
#   --actions F    append a TSV row describing what was done
#   --yes          actually kill; without it nothing is signalled

set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$DIR/lib-mem.sh"

SIG=""; MATCH=""; PIDS_IN=""; SPAWNER=""; ROUNDS=3
DOIT=0; ALLOW_CLAUDE=0; ACTIONS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --sig)     SIG="$2"; shift 2 ;;
    --match)   MATCH="$2"; shift 2 ;;
    --pids)    PIDS_IN="$2"; shift 2 ;;
    --spawner) SPAWNER="$2"; shift 2 ;;
    --rounds)  ROUNDS="$2"; shift 2 ;;
    --actions) ACTIONS="$2"; shift 2 ;;
    --yes)     DOIT=1; shift ;;
    --allow-claude) ALLOW_CLAUDE=1; shift ;;
    *) shift ;;
  esac
done

# Never signal anything in our own ancestry. This is what stops the skill
# killing the shell, the agent session, or the terminal that invoked it.
SELF=""
_p=$$
while [ -n "$_p" ] && [ "$_p" != "0" ] && [ "$_p" != "1" ]; do
  SELF="$SELF $_p"
  _p=$(ps -p "$_p" -o ppid= 2>/dev/null | tr -d ' ')
done

PROTECT_RE='kernel_task|^/sbin/launchd|WindowServer|loginwindow|opendirectoryd|securityd|configd|powerd|hidd|coreaudiod|bluetoothd|/usr/libexec/|Finder\.app|Dock\.app|SystemUIServer'

is_protected() { # $1 = pid
  case " $SELF " in *" $1 "*) return 0 ;; esac
  local c; c=$(ps -p "$1" -o command= 2>/dev/null)
  [ -z "$c" ] && return 0
  echo "$c" | grep -qE "$PROTECT_RE" && return 0
  if [ "$ALLOW_CLAUDE" -eq 0 ] && echo "$c" | grep -qE '(^|/)claude( |$)'; then return 0; fi
  return 1
}

collect() { # prints candidate pids, one per line
  if [ -n "$PIDS_IN" ]; then printf '%s\n' $PIDS_IN; return; fi
  local list; list=$(ps -Ao pid,ppid,rss,%cpu,stat,command 2>/dev/null | tail -n +2)
  if [ -n "$SIG" ]; then
    printf '%s\n' "$list" | awk "$SIG_AWK"'{ if (sig == S) print pid }' S="$SIG"
  elif [ -n "$MATCH" ]; then
    # exclude our own pid so the pattern cannot match this very command line
    printf '%s\n' "$list" | awk -v re="$MATCH" -v me="$$" '
      { cmd=""; for(i=6;i<=NF;i++) cmd = cmd $i " "
        if (cmd ~ re && $1 != me) print $1 }'
  fi
}

rss_of() { ps -p "$1" -o rss= 2>/dev/null | tr -d ' '; }

sum_rss_mb() { # pids on stdin
  local t=0 r
  while read -r p; do [ -z "$p" ] && continue; r=$(rss_of "$p"); t=$((t + ${r:-0})); done
  echo $((t / 1024))
}

napm() { perl -e 'select(undef,undef,undef,$ARGV[0])' "$1" 2>/dev/null || /bin/sleep 1; }

TARGETS=$(collect | sort -un)
if [ -z "$TARGETS" ]; then
  echo "${YEL}no processes matched${RST}"; exit 0
fi

SAFE=""; SKIPPED=0
for p in $TARGETS; do
  if is_protected "$p"; then SKIPPED=$((SKIPPED+1)); continue; fi
  SAFE="$SAFE $p"
done
SAFE=$(printf '%s\n' $SAFE | sort -un)

if [ -z "$SAFE" ]; then
  echo "${YEL}every match was protected (own session, system process, or claude). Nothing to do.${RST}"
  exit 0
fi

N=$(printf '%s\n' $SAFE | grep -c .)
FREED_BEFORE=$(printf '%s\n' $SAFE | sum_rss_mb)

echo
echo "${BOLD}TARGETS${RST}  ${DIM}$N processes, $(mb_human "$FREED_BEFORE") resident${RST}"
echo "$(rule 66)"
for p in $SAFE; do
  printf "  %s%-7s%s %8s  %s\n" "$DIM" "$p" "$RST" \
    "$(mb_human $(( $(rss_of "$p" 2>/dev/null || echo 0) / 1024 )))" \
    "$(trunc "$(ps -p "$p" -o command= 2>/dev/null | head -1)" 46)"
done
[ "$SKIPPED" -gt 0 ] && echo "  ${DIM}$SKIPPED match(es) skipped as protected${RST}"

if [ "$DOIT" -eq 0 ]; then
  echo
  echo "${YEL}dry run. re-run with --yes to kill.${RST}"
  exit 0
fi

# 1. spawner first, else the herd refills
if [ -n "$SPAWNER" ]; then
  SP=$(ps -Ao pid,ppid,rss,%cpu,stat,command 2>/dev/null | tail -n +2 | awk -v re="$SPAWNER" -v me="$$" '
        { cmd=""; for(i=6;i<=NF;i++) cmd = cmd $i " "
          if (cmd ~ re && $1 != me) print $1 }' | sort -un)
  SPK=""
  for p in $SP; do is_protected "$p" || SPK="$SPK $p"; done
  if [ -n "$SPK" ]; then
    echo; echo "${CYN}killing spawner first:${RST}$SPK"
    kill -9 $SPK 2>/dev/null
    napm 1
  fi
fi

# 2. TERM, then KILL, then re-sweep. Swap-starved processes sit in
#    uninterruptible wait and cannot act on a signal until scheduled.
echo; echo "${CYN}sweeping${RST}"
kill -TERM $SAFE 2>/dev/null
napm 2
r=0
while [ "$r" -lt "$ROUNDS" ]; do
  r=$((r+1))
  LEFT=""
  for p in $SAFE; do kill -0 "$p" 2>/dev/null && LEFT="$LEFT $p"; done
  [ -z "$LEFT" ] && break
  echo "  round $r: $(printf '%s\n' $LEFT | grep -c .) alive, sending SIGKILL"
  kill -9 $LEFT 2>/dev/null
  napm 3
done

GONE=0; STUCK=""
for p in $SAFE; do
  if kill -0 "$p" 2>/dev/null; then
    st=$(ps -p "$p" -o stat= 2>/dev/null | tr -d ' ')
    STUCK="$STUCK $p($st)"
  else GONE=$((GONE+1)); fi
done

echo
echo "  ${GRN}killed $GONE of $N${RST}"
if [ -n "$STUCK" ]; then
  echo "  ${YEL}still alive:$STUCK${RST}"
  echo "  ${DIM}a 'U' state cannot process SIGKILL until swap frees. Re-run the sweep.${RST}"
fi

if [ -n "$ACTIONS" ]; then
  label="${SIG:-${MATCH:-pids}}"
  printf '%s\t%s\t%s\t%s\n' \
    "Killed ${GONE}x $(trunc "$label" 28)" \
    "$(if [ -n "$SPAWNER" ]; then echo "respawning herd"; else echo "duplicate processes"; fi)" \
    "$FREED_BEFORE" \
    "$N targeted, $GONE gone, $(printf '%s\n' $STUCK | grep -c . ) stuck" >> "$ACTIONS"
fi
