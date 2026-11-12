---
description: "Writes a 25-minute customer interview script and a frame for analysing the answers through the gtm skill, with a PDF report. Use on /gtm:interviews, \"gtm interviews\", or when the user asks what to ask customers or users in discovery calls."
argument-hint: "[who to interview and what you want to learn]"
---

Run the gtm skill's `interviews` sub-command on the current project.

Invoke the `gtm` skill and follow it exactly with this input:

`interviews $ARGUMENTS`

If `$ARGUMENTS` is empty, work from what the project already holds (its CLAUDE.md, code and the gtm folder) before asking anything.
