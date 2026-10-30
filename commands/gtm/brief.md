---
description: "Writes the product brief: problem, audience, value proposition, 5 to 7 features, 90-day metrics and risks and hands back a PDF report"
argument-hint: "[the product and who it is for]"
---

Run the gtm skill's `brief` sub-command on the current project.

Invoke the `gtm` skill and follow it exactly with this input:

`brief $ARGUMENTS`

If `$ARGUMENTS` is empty, work from what the project already holds (its CLAUDE.md, code and the gtm folder) before asking anything.
