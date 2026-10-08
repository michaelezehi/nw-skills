---
description: "Start True Loop in current session"
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT]"
allowed-tools: ["Bash(~/.claude/bin/setup-true-loop.sh:*)"]
---

# True Loop

Run the setup script:

```!
~/.claude/bin/setup-true-loop.sh $ARGUMENTS
```

Work on the task. When you try to exit, the stop hook feeds the SAME PROMPT back. You see previous work in files and git history, iterating until completion.

If a completion promise is set, output it only when the statement is fully true. A false promise ends the loop with the work unfinished.
