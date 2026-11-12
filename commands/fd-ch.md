---
name: fd-ch
description: Runs the frontend-design skill in handoff mode, with the progress panel, a reference-image spec when one is given, and an accountability record at the end. Use on /fd-ch or the fd-ch wrapper for any UI build, redesign or polish that should survive a context handoff.
argument-hint: "[design task] [--image /path/to/ref.png]"
---
# Frontend design in handoff mode

Progress panel: on by default. Before planning, follow `~/.claude/references/progress-panel.md`: load the savvy-progress tools if they are not loaded, then report this run's steps and sub-agents to the bar. If a bar is already running, add your rows to it: no second bar, no duplicate rows.

## Task

$ARGUMENTS

## Steps

1. Reference image, only when the task holds a real image path (from `--image` or written in the task). Read the image and write down its palette, type, layout and mood as a short spec. That spec pins the look the way a brief does: follow it inside the house rules and the project's tokens, which still win where they conflict.

2. Read `~/.claude/skills/frontend-design/SKILL.md` and follow it, from the house rules and the track line to the finish checks and report. It carries the reconnaissance, the build rules, the motion gate and the checks; this command adds nothing to them.

3. Accountability. Write `.claude/goals/<task-slug>/ACCOUNTABILITY.md` once, at the end (the shared home `own-goal` uses; append a dated run section when the file exists): each task with its status, confidence before and after (5 guessing, 8 clear, 10 bulletproof) with the reason, and the gaps.

Handoff is automatic through `.claude/handoffs/` when context runs low.
