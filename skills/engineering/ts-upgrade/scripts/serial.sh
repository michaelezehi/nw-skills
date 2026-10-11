#!/bin/sh
# Run a command while holding a machine-wide lock, so parallel upgrades take turns on the CPU
# and their timings stay comparable. Usage: serial.sh <command...>
# A command with cd, pipes or redirects: serial.sh sh -c 'cd pkg && /usr/bin/time -l tsc --noEmit > out.txt 2>&1'
# The lock is a directory (mkdir is atomic). A lock older than 20 minutes is treated as stale.
# A fixed path: agents with different TMPDIRs must still share one lock.
LOCK="/tmp/ts-upgrade.lock"
while ! mkdir "$LOCK" 2>/dev/null; do
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +20 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; continue; fi
  sleep 2
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
"$@"
