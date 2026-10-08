---
name: ship:optimisation
description: Audit and fix this project's build + deploy pipeline for speed (alias for the build-speed skill, which superseded ship-optimisation).
argument-hint: [optional: deploy script path or SSH host]
---

Invoke the `build-speed` skill (`~/.claude/skills/build-speed/SKILL.md`) end to end against the current project. $ARGUMENTS may contain the deploy entrypoint path and/or SSH host — use them to skip discovery.

Rules: audit with file:line evidence first, then fix; prove every fix with a measurement; never run a production deploy or replace running containers; do not touch unrelated uncommitted changes; do not commit unless asked.
