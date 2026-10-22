---
description: Writes a 25-minute customer interview script and a frame for analysing the answers and hands back a PDF report
argument-hint: "[who to interview and what you want to learn]"
---

Run the gtm skill's `interviews` sub-command on the current project.

Invoke the `gtm` skill and follow it exactly with this input:

`interviews $ARGUMENTS`

If `$ARGUMENTS` is empty, work from what the project already holds (its CLAUDE.md, code and the gtm folder) before asking anything.
