#!/usr/bin/env bash
# lib-mem.sh : shared helpers for the clean-ram skill (macOS).
# Sourced by ram-scan.sh, ram-kill.sh, ram-report.sh. Not executable on its own.

if [ -n "${NO_COLOR:-}" ] || [ ! -t 1 ]; then
  BOLD=""; DIM=""; RED=""; GRN=""; YEL=""; CYN=""; MAG=""; RST=""
else
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'
  YEL=$'\033[33m'; CYN=$'\033[36m'; MAG=$'\033[35m'; RST=$'\033[0m'
fi
export BOLD DIM RED GRN YEL CYN MAG RST

STATE_DIR="${CLEAN_RAM_STATE_DIR:-${TMPDIR:-/tmp}/clean-ram}"
mkdir -p "$STATE_DIR" 2>/dev/null || true

# ---- metrics -----------------------------------------------------------------

swap_field() { # $1 = used|total|free
  sysctl -n vm.swapusage 2>/dev/null \
    | tr ' ' '\n' | grep -A0 -E '^[0-9.]+M$' >/dev/null 2>&1
  sysctl -n vm.swapusage 2>/dev/null \
    | sed -E "s/.*$1 = ([0-9.]+)M.*/\1/" | head -1
}

free_pct() {
  memory_pressure 2>/dev/null \
    | sed -n 's/.*free percentage: *\([0-9]*\)%.*/\1/p' | head -1
}

rss_total_mb() {
  ps -Ao rss= 2>/dev/null | awk '{s+=$1} END{printf "%.0f", s/1024}'
}

proc_count() { ps -Ao pid= 2>/dev/null | wc -l | tr -d ' '; }

phys_mb() { sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f", $1/1048576}'; }

# ---- snapshots ---------------------------------------------------------------

snapshot_write() { # $1 = path
  local f="$1"
  {
    echo "ts=$(date '+%Y-%m-%d %H:%M:%S')"
    echo "epoch=$(date +%s)"
    echo "swap_used_mb=$(swap_field used)"
    echo "swap_total_mb=$(swap_field total)"
    echo "swap_free_mb=$(swap_field free)"
    echo "free_pct=$(free_pct)"
    echo "rss_total_mb=$(rss_total_mb)"
    echo "proc_count=$(proc_count)"
    echo "phys_mb=$(phys_mb)"
  } > "$f"
}

snap_get() { # $1 = file, $2 = key
  [ -f "$1" ] || { echo ""; return; }
  sed -n "s/^$2=//p" "$1" | head -1
}

# ---- formatting --------------------------------------------------------------

mb_human() { # $1 = megabytes -> "1.4 GB" / "512 MB"
  awk -v m="${1:-0}" 'BEGIN{
    if (m == "" || m+0 == 0) { print "0 MB"; exit }
    if (m+0 >= 1024) printf "%.1f GB", m/1024; else printf "%.0f MB", m
  }'
}

trunc() { # $1 = string, $2 = width  (newline-safe: ps can emit multi-line rows)
  awk -v s="$(printf '%s' "$1" | tr '\n\t' '  ')" -v w="${2:-40}" 'BEGIN{
    if (length(s) <= w) { print s; exit }
    print substr(s, 1, w-1) "\xe2\x80\xa6"
  }'
}

pad() { # $1 = string, $2 = width  (pads right, accounts for the ellipsis byte)
  awk -v s="$1" -v w="${2:-10}" 'BEGIN{
    n = length(s); if (n > w) n = w
    printf "%s", s
    for (i = n; i < w; i++) printf " "
  }'
}

rule() { printf '%*s' "${1:-60}" '' | tr ' ' '-'; }

# ---- process signatures ------------------------------------------------------
# A signature collapses "node /long/path/typescript/bin/tsc --noEmit" down to
# "tsc --noEmit" so identical work spawned many times groups into one herd.

SIG_AWK='
function basename(p,   k, a) { k = split(p, a, "/"); return a[k] }
{
  pid=$1; ppid=$2; rss=$3; pcpu=$4; stat=$5
  cmd=""; for (i = 6; i <= NF; i++) cmd = cmd $i " "
  n = split(cmd, a, " ")
  sig = ""; cnt = 0
  for (j = 1; j <= n && cnt < 3; j++) {
    t = a[j]; if (t == "") continue
    b = basename(t)
    if (b == "") continue
    if (cnt == 0 && (b=="node" || b=="python" || b=="python3" || b=="sh" || \
                     b=="bash" || b=="zsh" || b=="env" || b=="npx" || b=="ruby")) continue
    if (b ~ /^-/ && cnt == 0) continue
    sig = sig (sig == "" ? "" : " ") b
    cnt++
  }
  if (sig == "") sig = basename(a[1])
}
'
export SIG_AWK
