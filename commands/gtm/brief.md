---
description: "Writes the product brief (problem, audience, value proposition, 5 to 7 features, 90-day metrics, risks) through the gtm skill and hands back a PDF report. Use on /gtm:brief, \"gtm brief\", or when the user asks for a product brief or one-pager for a project."
argument-hint: "[the product and who it is for]"
---

Run the gtm skill's `brief` sub-command on the current project.

Invoke the `gtm` skill and follow it exactly with this input:

`brief $ARGUMENTS`

If `$ARGUMENTS` is empty, work from what the project already holds (its CLAUDE.md, code and the gtm folder) before asking anything.
