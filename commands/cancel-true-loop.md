---
description: "Cancel active True Loop"
allowed-tools: ["Bash(test -f .claude/true-loop.local.md:*)", "Bash(rm .claude/true-loop.local.md)", "Read(.claude/true-loop.local.md)"]
---

# Cancel True Loop

1. Check: `test -f .claude/true-loop.local.md && echo "EXISTS" || echo "NOT_FOUND"`
2. If NOT_FOUND: "No active True Loop."
3. If EXISTS: Read file for iteration count, then `rm .claude/true-loop.local.md`. Report: "Cancelled True Loop (was at iteration N)."
