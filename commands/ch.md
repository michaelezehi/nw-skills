---
description: Runs a task in handoff continuity mode with a domain task list, an ACCOUNTABILITY.md with Q&A under .claude/goals, progress bar and incremental commits; --html adds SUMMARY.html. Use on /ch, the ch wrapper, or to implement a PRD from /prd-ch.
argument-hint: [task]
---

# Handoff continuity mode

## Task

$ARGUMENTS

## Skills

Always invoke `writing-clearly-and-concisely`. For frontend work, also invoke `vercel-react-best-practices` and `vercel-composition-patterns`.

## Protocol

0. Load the progress panel tools first: ToolSearch `select:mcp__savvy-progress__progress,mcp__savvy-progress__step` (`~/.claude/references/progress-panel.md`).
1. Parse flags: `--html`/`-h` means on completion also emit `SUMMARY.html` per the HTML summary report spec below. Default: Markdown only.
2. Parse the task. If unclear, ask; do not guess.
3. Create a numbered task list grouped by domain. No time estimates. Each task concrete and verifiable.
4. Cross-check: every requirement maps to a task, every task traces to a requirement. Flag orphans.
5. Create `.claude/goals/<task-slug>/ACCOUNTABILITY.md` (the shared accountability home used by `own-goal`; never project root). If a file already exists for this slug, append a new dated run section rather than overwriting. Track each task with status, confidence before and after (with reason), gaps found, **and a `Q&A` section**: every clarifying question, every user decision, every "should we X or Y" resolution, in direct quotes where possible. These are what get lost in a code push.
6. Report progress per `~/.claude/references/progress-panel.md`: the task list from step 3 as `tasks` (tier by who does each, the driver's inline tasks included), `done` as each task verifies, `finished` at the end. Every sub-agent brief carries the worker step line from that file.
7. Execute tasks. Update accountability as you go.
8. Make incremental commits. Document key decisions.
9. **If `--html` is set:** on completion, generate `SUMMARY.html` in the same directory.

Confidence scale: 5 guessing, 8 clear, 10 zero ambiguity. A drop from before to after signals unexpected difficulty: explain it in the Gaps register.

Handoff is automatic via `.claude/handoffs/` if context limits approach.

## HTML summary report (`--html` / `-h`)

A post-hoc reference doc for the person reviewing a large code push: what happened, what was decided, what was asked. Lives at `.claude/goals/<task-slug>/SUMMARY.html`, next to ACCOUNTABILITY.md.

Content, in this order:
1. **Header:** task slug, date and time, the original prompt that started the session.
2. **What was done:** completed tasks grouped by domain; collapsible per-task detail via `<details>`.
3. **Files changed:** paths with a one-line "what changed and why" each, from the git diff scope.
4. **Decisions:** every non-trivial decision and its reasoning, the "I picked X because Y" line that never reaches a commit message.
5. **Q&A:** every question (yours or the user's) and its answer, in order, in direct quotes where possible. The highest-value section, because this is what gets lost.
6. **Gaps and open items:** unfinished work, known limitations, follow-ups.
7. **Confidence final:** per-task confidence at completion.

HTML format (matches the Claude Code team reference gallery, `thariqs.github.io/html-effectiveness`):

- **Single self-contained `.html`.** No CDNs, no remote fonts, no external deps. Opens offline.
- **System fonts only:** serif headings (`ui-serif, Georgia, serif`), sans body (`system-ui, -apple-system, sans-serif`), mono labels (`ui-monospace, SFMono-Regular, monospace`).
- **Inline `<style>`** with CSS custom properties for tokens (`--ink`, `--paper`, `--accent`, `--muted`). Editorial scale, line-height about 1.6, max-width about 1100px.
- **`<details>`/`<summary>`** for per-task detail and long Q&A entries, so the document scans and drills in on demand.
- **Status pills** (`done` / `partial` / `deferred`) and confidence chips on each task.
- **`@media print`** block for clean PDF export.
- Inline `<svg>` only if a diagram materially helps; skip otherwise.
