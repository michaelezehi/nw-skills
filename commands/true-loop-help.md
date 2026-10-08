---
description: "Explain True Loop and available commands"
---

# True Loop

Compact iterative development loop (based on Ralph Wiggum technique). Same prompt fed repeatedly; Claude sees previous work in files and improves each iteration.

## Commands

**`/true-loop <PROMPT> [OPTIONS]`** — Start loop in current session.
- `--max-iterations N` — Stop after N iterations (default: unlimited)
- `--completion-promise TEXT` — Phrase to signal completion via `<promise>TEXT</promise>`

**`/cancel-true-loop`** — Cancel active loop (removes state file).

## How It Works

1. Setup creates `.claude/true-loop.local.md` state file
2. You work on the task
3. Stop hook intercepts exit, feeds same prompt back
4. You see previous work in files, iterate
5. Loop ends when promise detected or max iterations reached

## When to Use

Good: well-defined tasks, clear success criteria, tasks needing iteration, automatic verification (tests).
Bad: tasks needing human judgment, one-shot operations, unclear success criteria.

Example:
```
/true-loop "Fix auth bug. Run tests. Output <promise>FIXED</promise> when all pass." --completion-promise "FIXED" --max-iterations 15
```
