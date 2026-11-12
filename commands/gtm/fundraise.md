---
description: "Checks raise readiness, round size, investor targets and a 12-week timeline through the gtm skill and hands back a PDF report. Use on /gtm:fundraise, \"gtm fundraise\", or when the user asks whether or how to prepare a raise."
argument-hint: "[the round you are considering, any amount]"
---

Run the gtm skill's `fundraise` sub-command on the current project.

Invoke the `gtm` skill and follow it exactly with this input:

`fundraise $ARGUMENTS`

If `$ARGUMENTS` is empty, work from what the project already holds (its CLAUDE.md, code and the gtm folder) before asking anything.
