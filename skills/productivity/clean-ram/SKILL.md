---
name: clean-ram
description: Find what is actually eating system memory on macOS, kill it safely, and show a coloured before/after table of what was freed. Finds process herds (many copies of one command) and the spawner behind them, not just the single biggest process. Use when the user says /clean-ram, "something is hogging my RAM", "my machine is swapping", "free up memory", "what is eating my memory", or when the machine has gone slow and unresponsive.
argument-hint: [scan | kill <signature> | report] (no args = full guided run)
---

# clean-ram

Three steps: find the hog, kill what is safe to kill, show what it bought you.

Scripts live in `scripts/` next to this file. They are macOS only (`sysctl
vm.swapusage`, `memory_pressure`, BSD `ps`).

## The one thing to understand first

**The hog is usually not one process.** The case this skill was built from
looked like a healthy machine by every single-process measure: the largest
process was 510 MB on a 32 GB box. The actual cause was **27 copies of the same
typecheck** started by a gate runner, 4.7 GB in aggregate, which had pushed swap
to 28.3 GB of 28.6 GB.

So: **check swap first, group second, single processes last.** Swap near 100%
is the real emergency signal. Free memory percentage lies, because the machine
looks fine right up until it is thrashing.

## Run it

Always in this order. Never skip the scan, and never kill without showing the
user first.

```bash
S=~/.claude/skills/clean-ram/scripts
SNAP=$(mktemp); ACT=$(mktemp)

# 1. diagnose, and record the "before" state
"$S/ram-scan.sh" --snapshot "$SNAP"

# 2. dry run first; it is the default and shows what would die
"$S/ram-kill.sh" --sig "tsc --noEmit"

# 3. kill for real, spawner first
"$S/ram-kill.sh" --sig "tsc --noEmit" --spawner "gate-check.mjs" --yes --actions "$ACT"

# 4. coloured before/after table
"$S/ram-report.sh" --before "$SNAP" --actions "$ACT"
```

Targeting takes any one of:

| Flag | Use |
| --- | --- |
| `--sig "tsc --noEmit"` | a herd, exactly as the scan prints its signature |
| `--match "<regex>"` | matched against the full command line |
| `--pids "123 456"` | explicit pids you already identified |

## Rules

**Confirm before killing anything.** Show the user the dry-run list and get a
yes. The only exception is a herd that is unambiguously disposable and
re-runnable (a typecheck, a linter, a test run). Anything holding unsaved state,
a database, a build artefact, or a user's editor gets an explicit question.

**Kill the spawner first.** A supervisor that shells work in a loop refills the
herd within seconds. In the original case, 52 processes were killed and new ones
appeared 44 seconds later, because `gate-check.mjs` was still running. Find it
by walking `ppid` up from a herd member. The scan prints candidates under
`LIKELY SPAWNER`.

**Expect SIGKILL to be ignored.** When swap is exhausted, processes sit in
uninterruptible wait (`U` in `ps stat`) and cannot act on any signal until the
scheduler gives them memory. `ram-kill.sh` sweeps three times for this reason.
Stragglers are normal, they die as pressure eases. Do not conclude the kill
failed.

**Never let a pattern match your own shell.** `grep 'gate-check.mjs'` matches
the very command line containing that string, so a careless sweep kills the
session running it. `ram-kill.sh` guards this two ways: it excludes its own pid
from `--match`, and it refuses any pid in its own ancestor chain. When writing
ad-hoc greps outside this skill, use the `[g]ate-check` bracket trick.

**Protected by default:** the caller's whole process ancestry, kernel and system
daemons (`WindowServer`, `launchd`, `configd`, `/usr/libexec/*`, Finder, Dock),
and **every `claude` CLI session**. Killing a Claude session destroys its
in-progress context, so it needs `--allow-claude` plus the user saying yes.

**Report honestly.** If stragglers survived, say so. If swap is still above 90%
after the sweep, say the pressure is elsewhere rather than declaring victory.
`ram-report.sh` prints both of those on its own.

## Reading the scan

- `HERDS` is the section that matters. `27x 4.6 GB tsc --noEmit` is the answer.
  A herd is flagged from 2 copies and 200 MB.
- `n stuck` on a herd row counts processes in `U` state. Non-zero means swap is
  already exhausted, so plan on several sweeps.
- `SINGLE HEAVYWEIGHTS` catches the genuine one-process case, a leaked Electron
  renderer or a runaway `node`.
- `LIKELY SPAWNER` lists the parents of the biggest herd. Walk further with
  `ps -p <ppid> -o ppid=`.

## Then fix the cause

Clearing the herd is first aid. A herd that regrows has a cause worth naming:
an unserialised check loop, a watcher with no debounce, a supervisor with no
concurrency cap. Say so in the report and offer the fix. In the original case
the fix was making gate CHECKs share one typecheck instead of each shelling a
full-repo `tsc`.

`$ARGUMENTS`
