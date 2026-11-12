---
description: "Picks the 5 numbers that matter at this stage and how to track them through the gtm skill and hands back a PDF report. Use on /gtm:metrics, \"gtm metrics\", or when the user asks which metrics or KPIs to watch for a product."
argument-hint: "[the product and its stage]"
---

Run the gtm skill's `metrics` sub-command on the current project.

Invoke the `gtm` skill and follow it exactly with this input:

`metrics $ARGUMENTS`

If `$ARGUMENTS` is empty, work from what the project already holds (its CLAUDE.md, code and the gtm folder) before asking anything.
