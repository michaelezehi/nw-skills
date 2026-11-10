---
name: dbs
description: >
  Alias for deployment-build-speed. Install the house fast-ship pattern in a
  Docker project: rebuild only the images whose inputs changed, pull CI-built
  images instead of compiling on the server, fall back to the on-server build,
  and keep no registry token on the server. Use when the user says DBS, /dbs,
  or wants the same workflow as deployment-build-speed.
---

# DBS = deployment build speed

`dbs` is an alias of `deployment-build-speed`. Read
`~/.claude/skills/deployment-build-speed/SKILL.md` and follow it: the same
five parts, the same "before you edit" checks, the same verification, and the
same rule that the ship is never run.
