---
name: prd-ch
description: Create a PRD fast and well — sized to the feature (S/M/L), parallel investigation via Explore agents, one write per file, no plan-mode round-trip. Writes INVESTIGATION.md, FILES.md, PRD.md (+ PRD.html with --html) and ACCOUNTABILITY.md.
argument-hint: [feature] [--size S|M|L] [--html] [--teams|--worktree]
---
# PRD Creation

## Task

$ARGUMENTS

## Speed contract

A PRD is a document, not an implementation, so the run is bounded:

- **One investigation fan-out, one synthesis, one write per file.** No
  re-reading files already summarized by an Explore agent. No `/plan` mode —
  the Explore/Plan agents below are the investigation.
- **Size the ceremony to the feature** (below). A small feature does not get a
  five-file dossier.
- **Write once.** Depth goes into the investigation and the
  requirement↔task cross-check, not into revising prose.
- **One round-trip, only when genuinely blocked.** If a requirement can't be
  resolved from the brief plus investigation — a real fork in what to build,
  not a missing nice-to-have — ask it as a single numbered round before
  writing PRD.md: `❓ **Q1** — <question>` then `➡️ <your recommended answer>`,
  one question per open fork, then wait. This is the only interruption the
  speed contract allows; don't reach for it on anything resolvable by reading
  code or making a reasonable call and flagging it in Risks & open questions.
- **No loop.** Do not run under true-loop unless the user passes `--loop`.
  Emit `<promise>PRD_COMPLETE</promise>` once at the end so wrappers can
  detect completion.

## Step 0 — Parse flags, size the job

Flags: `--size S|M|L` · `--html`/`-h` · `--teams`/`-t` · `--worktree`/`-w` ·
`--loop`.

If `--size` is absent, infer from the task and **state your pick in one line**:

| Size | Signal | Files produced |
|---|---|---|
| **S** | one surface / one function family / < ~8 tasks | `PRD.md` + `ACCOUNTABILITY.md` (INVESTIGATION and FILES are sections inside PRD.md) |
| **M** | 2–3 domains (e.g. schema + backend + one UI) | `INVESTIGATION.md`, `FILES.md`, `PRD.md`, `ACCOUNTABILITY.md` |
| **L** | cross-cutting, new subsystem, migration | all of M + architecture SVG in PRD.html if `--html` |

Directory: `_r&d/prd/<task-slug>/$(date +%m-%d)/$(date +%H-%M)/` — create it now.

## Step 1 — Investigate in parallel (single message, multiple Agent calls)

First load the progress panel tools: ToolSearch
`select:mcp__savvy-progress__progress,mcp__savvy-progress__step`.

If a `CONTEXT.md` exists (project root or the relevant context under a
`CONTEXT-MAP.md`), read it first. Name things in Requirements and the task
list the way it names them — don't invent a synonym for a term it already
defines. If the feature surfaces a term or a hard-to-reverse decision with no
home in `CONTEXT.md`/`docs/adr/` yet, don't stop to resolve it: note it once
under Risks & open questions as a domain-modeling candidate for whoever picks
this PRD up (call the Skill tool with `domain-modeling` then, not now).

Launch **2–4 `Explore` agents at once** (never sequential), each with a
narrow brief and `"medium"` thoroughness (`"very thorough"` only for L):

- **Domain reader** — the code the feature touches: existing patterns,
  helpers, auth guards, naming. Return: file paths + one-line role each, and
  the 3–5 patterns to follow.
- **Boundary reader** — schema/tables, API surface, external services, env
  vars, feature flags. Return: exact names and constraints.
- **Precedent reader** (M/L) — a similar feature already shipped in this repo:
  how it was structured, tests, what it got wrong (git log / recent commits).
- **Risk reader** (L) — what breaks if this is done naively: migrations,
  tenancy (`workspaceAuth`), rate limits, background workers, billing.

Each agent returns raw findings only. Ask for ≤ 40 lines each. **You do not
re-read what they read**; you cite their paths.

Progress panel (`~/.claude/references/progress-panel.md`): before the launch,
report `title` (the slug), one `tasks` row per reader at tier `medium`, titled
exactly as its Agent `description`, plus a last row `Write PRD files` at tier
`careful`, and `phase: "delegate"`. Each reader brief carries the worker step
line. Bump `done` as each reader returns, `phase: "design"` while writing, and
`finished: true` once the files are written.

While they run, draft the Problem / Goals / Non-goals from the brief.

## Step 2 — Synthesize and write

Skills: `writing-clearly-and-concisely` always; `vercel-react-best-practices`
only if the PRD is frontend-heavy (read the AGENTS.md index, not all rules).

Write files in this order, each **once**:

1. **INVESTIGATION.md** (M/L) — merged agent findings: patterns, constraints,
   decisions taken and why, file paths. Bullet-dense, no narrative.
2. **FILES.md** (M/L) — table: path · modify/create/reference · what changes.
3. **PRD.md** — sections, in order: Summary (≤ 5 lines) · Problem · Goals /
   Non-goals · Requirements (numbered `R1…`) · Technical design (data,
   backend, frontend, config; reuse names from investigation) · Task list ·
   Cross-check table (`R# ↔ T#`, flag orphans both ways) · Testing (name the
   **seams** — the public interfaces each test observes: a mutation, an API
   route, a rendered component — then which test files, what asserts against
   each; a test that reaches into internals to pass doesn't count) · Risks &
   open questions · Rollout.
4. **PRD.html** (only `--html`) — see spec below.
5. **ACCOUNTABILITY.md** — written **once at the end** to
   `.claude/goals/<task-slug>/ACCOUNTABILITY.md` (the shared accountability home used by
   `own-goal`, not the PRD directory; append a dated section if it exists):
   each task with confidence (5 guessing · 8 clear · 10 bulletproof) + reason,
   gaps register, open questions for the user. Put a one-line pointer to it
   at the bottom of PRD.md.

### Task list rules
- No time estimates. Each task concrete, verifiable, ≤ 1 sentence, names the
  file(s).
- Grouped by domain (Database, Backend, Frontend, Config, Tests) **for
  reading**, not for build order. When the grouped list would read as "do all
  of Database, then all of Backend, then all of Frontend," add a one-line
  **Build order** note instead: the first tracer bullet (the thinnest slice
  that runs end-to-end — schema through UI — proving the shape works) and
  what widens after. Layer-first task lists are the single biggest cause of
  rework once implementation starts: a build that's ~20 tasks of pure schema
  before anything touches a UI is a sign the ticket needs re-slicing, not a
  sign the domain is unusually deep.
- Every requirement ↔ ≥ 1 task; every task ↔ ≥ 1 requirement. Orphans are
  listed under "Unmapped" — never silently dropped.
- Respect project rules found in `CLAUDE.md` (e.g. background workers for
  enrichment, `isUnresolvedEmail` gating, no "AI" in copy) — cite them.

## Step 3 — Finish

- One line summarizing size, file count, and the 2–3 biggest open questions.
- `<promise>PRD_COMPLETE</promise>`

Do **not** offer to start implementation; that is `/ch` or the user's call.

## HTML output (`--html` / `-h`)

Markdown is the working doc; HTML is the stakeholder deliverable, emitted
*alongside* `PRD.md`, never instead of. Requirements:

- Single self-contained `.html` — no CDNs, no remote fonts, no external deps.
  System fonts (`ui-serif`, `system-ui`, `ui-monospace`).
- Inline `<style>` with tokens (`--ink`, `--paper`, `--accent`, `--muted`);
  editorial scale, line-height ~1.6, max-width ~1200px; `@media print` block.
- Inline `<svg>` for architecture / flow diagrams (L only). No mermaid.
- `<details>` for investigation notes, file list, risk register.
- Provenance header: task slug, date, original prompt.
- Content mirrors PRD.md sections with severity badges (`must` / `nice` /
  `out-of-scope`) and in-page anchor nav.
- Curved corners throughout; generated HTML never uses `border-radius: 0`.

## Execution modes (`--teams` / `--worktree`) — planning only

These flags do **not** change how the PRD is produced. They add one section
to PRD.md, **"Execution plan"**, when the task list has ≥ 8 tasks:

- Split tasks into ≤ 4 file-disjoint workstreams (`ALPHA…DELTA`), each with
  owned files, tasks, dependencies, and the prerequisite the lead does first.
- `--worktree` adds branch names `prd/<slug>/<stream>` and the merge order
  (`--no-ff`, sequential).
- Fewer than 8 tasks → write "Solo — too small to split" and move on.

Actual execution (Agent Teams / worktrees) happens later, from `/ch` or the
user, not inside this command.
