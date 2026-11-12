---
description: "Writes a PRD sized S, M or L with parallel Explore investigation and a feature validator, one write per file, no plan mode. Outputs INVESTIGATION.md, FILES.md, PRD.md (PRD.html with --html) and ACCOUNTABILITY.md. Use on /prd-ch, \"write a PRD\", \"size this\", --teams, --worktree."
argument-hint: "[feature] [--size S|M|L] [--html] [--teams|--worktree]"
---
# PRD creation

## Task

$ARGUMENTS

## Speed contract

A PRD is a document, not an implementation, so the run is bounded:

- **One investigation fan-out, one synthesis, one write per file.** No
  re-reading files an Explore agent already summarized. No `/plan` mode: the
  Explore and Plan agents below are the investigation.
- **Size the ceremony to the feature** (below). A small feature does not get a
  five-file dossier.
- **Write once, check once.** Depth goes into the investigation and the
  requirement to task cross-check, not into revising prose. The one revision
  allowed is folding in what the Step 3 check finds.
- **One round-trip, only when blocked.** If a requirement cannot be resolved
  from the brief plus investigation (a real fork in what to build, not a
  missing nice-to-have), ask before writing PRD.md, in one round: one
  `> [!ASK] <question>` per open fork, each followed by its `> - option`
  lines with your recommended answer first, then wait. This is the only
  interruption the speed contract allows; do not use it for anything
  resolvable by reading code or by making a reasonable call and flagging it
  in Risks & open questions.
- **The PRD is the input to `/own-goal`.** Whoever builds this reads only
  these files. A phase without owned files and a runnable acceptance check
  cannot be dispatched or accepted, so those are not optional detail.
- **No loop.** Do not run under true-loop unless the user passes `--loop`.
  Emit `<promise>PRD_COMPLETE</promise>` once at the end so wrappers can
  detect completion.

## Step 0: Parse flags, size the job

Flags: `--size S|M|L` · `--html`/`-h` · `--teams`/`-t` · `--worktree`/`-w` ·
`--loop` · `--no-validate` (skip the feature validator).

If `--size` is absent, infer it from the task and **state your pick in one line**:

| Size | Signal | Files produced |
|---|---|---|
| **S** | one surface, one function family, under about 8 tasks | `PRD.md` + `ACCOUNTABILITY.md` (INVESTIGATION and FILES are sections inside PRD.md) |
| **M** | 2 or 3 domains (for example schema, backend and one UI) | `INVESTIGATION.md`, `FILES.md`, `PRD.md`, `ACCOUNTABILITY.md` |
| **L** | cross-cutting, new subsystem, migration | all of M, plus an architecture SVG in PRD.html if `--html` |

Directory: `_r&d/prd/<task-slug>/$(date +%m-%d)/$(date +%H-%M)/`. Create it now.

## Step 1: Investigate in parallel (one message, several Agent calls)

First load the progress panel tools: ToolSearch
`select:mcp__savvy-progress__progress,mcp__savvy-progress__step`.

If a `CONTEXT.md` exists (project root, or the relevant context under a
`CONTEXT-MAP.md`), read it first. Name things in Requirements and the task
list the way it names them; do not invent a synonym for a term it defines. If
the feature surfaces a term or a hard-to-reverse decision with no home in
`CONTEXT.md` or `docs/adr/` yet, do not stop to resolve it: note it once under
Risks & open questions as a domain-modeling candidate for whoever picks this
PRD up.

Launch **2 to 4 `Explore` agents at once** (never sequential), each with a
narrow brief and `"medium"` thoroughness (`"very thorough"` only for L):

- **Domain reader:** the code the feature touches: existing patterns,
  helpers, auth guards, naming. Returns file paths with a one-line role each,
  and the 3 to 5 patterns to follow.
- **Boundary reader:** schema and tables, API surface, external services, env
  vars, feature flags. Returns exact names and constraints.
- **Precedent reader** (M and L): a similar feature already shipped in this
  repo: how it was structured, its tests, what it got wrong (git log, recent
  commits).
- **Risk reader** (L): what breaks if this is done naively: migrations,
  tenancy (`workspaceAuth`), rate limits, background workers, billing.

Each agent returns raw findings only, at most 40 lines each. **Do not re-read
what they read**; cite their paths.

**Feature validator: always, when the PRD adds to a product that already
exists.** In the same launch, dispatch one more agent (`model: "opus"`, not
Explore, because it searches the web) to run the `/gtm feature` sub-command
on the feature: it follows `~/.claude/skills/gtm/references/feature.md` and
`references/conventions.md` (skip the HTML report; keep the facts step), uses
the project's `<gtm>` folder as `conventions.md` resolves it (`_r&d/gtm/` when
the project has `_r&d/`) and any earlier `/gtm` runs there, and owns only
`<gtm>/feature-<slug>.md` and its own lines in `<gtm>/facts.md`. Its input is
the feature as the user described it, plus one line from you: whether our own
team uses this surface live, and anything the user said about how they work
in it. The validator fills the reference's `Own use` section from production
counts and repo workarounds, and scores on them. It returns the score out of
35, the verdict (build it, test first, park it, kill it), every point of
pushback, and the cheapest test it proposes. Skip it only for a brand-new
product with nothing live, or when the user passes `--no-validate`. The point
is to see the pushback before the PRD commits to building: do not soften it,
and do not let it block the PRD. Not softening cuts both ways: measured own
use is evidence, and a brief that leaves it out gets a wrong park.

Progress panel (`~/.claude/references/progress-panel.md`): before the launch,
report `title` (the slug), one `tasks` row per reader at tier `medium`, titled
exactly as its Agent `description`, a row for the feature validator at tier
`careful` when it runs, a row `Write PRD files` at tier `careful`, for M and
L a last row `Check PRD against repo` at tier `heavy`, and
`phase: "delegate"`. Each reader brief carries the worker step line. Bump
`done` as each reader returns, `phase: "design"` while writing, and
`finished: true` once the files are written.

While they run, draft Problem, Goals and Non-goals from the brief.

## Step 2: Synthesize and write

Skills: `writing-clearly-and-concisely` always; `vercel-react-best-practices`
only if the PRD is frontend-heavy (read the AGENTS.md index, not all rules).

Write files in this order, each **once**:

1. **INVESTIGATION.md** (M and L): merged agent findings: patterns,
   constraints, decisions taken and why, file paths. Bullet-dense, no
   narrative.
2. **FILES.md** (M and L): table of path · modify/create/reference · what
   changes.
3. **PRD.md**: sections, in order: Summary (5 lines at most) · Problem ·
   Goals / Non-goals · Validation (the feature validator's score, verdict and
   every pushback point, each answered: accepted and changed in this PRD, or
   rejected with the reason; link `<gtm>/feature-<slug>.md`) · Requirements
   (numbered `R1…`) · Technical design (data, backend, frontend, config; reuse
   names from the investigation) · Phases and tasks (rules below) ·
   Cross-check table (`R# ↔ T#`, flag orphans both ways) · Testing (name the **seams**, the public
   interfaces each test observes: a mutation, an API route, a rendered
   component; then which test files, and what each asserts; a test that
   reaches into internals to pass does not count) · Risks & open questions ·
   Rollout.
4. **PRD.html** (only `--html`): see the spec below.
5. **ACCOUNTABILITY.md**: written **once at the end** to
   `.claude/goals/<task-slug>/ACCOUNTABILITY.md` (the shared accountability
   home used by `own-goal`, not the PRD directory; append a dated section if
   it exists): each task with confidence (5 guessing · 8 clear · 10
   bulletproof) and reason, a gaps register, open questions for the user. Put
   a one-line pointer to it at the bottom of PRD.md.

### Phases and tasks rules

`/own-goal` turns every `### Phase <X>: <title>` heading into one unit of
work for one agent, so the task list is written as phases:

```markdown
### Phase A: <title>
Depends on: none | Phase <X>
Owns: <exact paths this phase creates or modifies>
Tasks:
- T1 [Backend] <one sentence, names the file> (R1, R3)
Acceptance:
- [ ] <observable outcome> | CHECK: `<command>` | EXPECT: <substring or /regex/>
```

- **Phases are vertical slices in build order.** Phase A is the tracer
  bullet: the thinnest slice that runs end to end, schema through UI, proving
  the shape works. Later phases widen it. Layer-first lists (all of Database,
  then all of Backend, then all of Frontend) are the biggest cause of rework
  once implementation starts: about 20 tasks of pure schema before anything
  touches a UI means the ticket needs re-slicing, not that the domain is
  unusually deep. Tag each task with its domain (`[Database]`, `[Backend]`,
  `[Frontend]`, `[Config]`, `[Tests]`) so it still reads by domain.
- **Size:** S is one phase. M is 2 to 4. L is as many as the slices need; a
  phase is half an hour or more of real work for one agent, never one task.
- **Owns** lists are disjoint between phases that do not depend on each
  other, because those run in parallel on one branch. A file two phases need
  goes to the earlier one and the later one depends on it.
- **Acceptance** items are what the builder's gates are made from. Give each
  a `CHECK` that is cheap and non-interactive (typecheck, a named test file,
  a grep, a count) and the `EXPECT` its output must contain. Never a dev
  server, a browser or a deploy: the owner verifies those, so write such an
  outcome as an item with `CHECK: manual` and say what the owner looks at.
- No time estimates. Each task concrete, verifiable, one sentence at most,
  names the file or files.
- Every requirement maps to at least one task; every task to at least one
  requirement. Orphans are listed under "Unmapped", never silently dropped.
- Respect project rules found in `CLAUDE.md` (for example background workers
  for enrichment, `isUnresolvedEmail` gating, no "AI" in copy) and cite them.

## Step 3: Check the PRD against the repo

A wrong path or a requirement nobody can test costs a phase later, so the
PRD is checked before it is handed over.

- **Always, by command:** every path in FILES.md (or the Files section)
  marked modify or reference exists (`test -e`); every path marked create
  does not; every function, table and env var the Technical design calls
  existing is found by `grep`. Fix what fails.
- **M and L, by a fresh reader on the top tier:** one agent that has seen
  none of this run, `subagent_type: "savvy-flow:savvy-heavy"` with
  `model: "opus"` (`savvy-flow:savvy-fable` when the session model is below
  Fable), given only the PRD directory and the repo. It reads and reports,
  at most 30 lines: requirements with no acceptance check, tasks that
  contradict what the code already does, a missing migration, tenancy or auth
  step, phases whose Owns lists collide, checks that would pass while the
  feature is still wrong. Fold what holds into PRD.md in one revision and
  list what you rejected, with the reason, under Risks & open questions.

## Step 4: Finish

- One line with size, file count, phase count, and the 2 or 3 biggest open
  questions.
- What the Step 3 check changed, in one line.
- The validator's verdict in one line. If it said park it or kill it, end with
  an `> [!ASK]` asking whether to go ahead anyway, test first, or drop it.
- `<promise>PRD_COMPLETE</promise>`

Do **not** offer to start implementation; that is `/own-goal <path to PRD.md>`,
`/ch`, or the user's call.

## HTML output (`--html` / `-h`)

Markdown is the working doc; HTML is the stakeholder deliverable, emitted
*alongside* `PRD.md`, never instead of it. Requirements:

- Single self-contained `.html`: no CDNs, no remote fonts, no external deps.
  System fonts (`ui-serif`, `system-ui`, `ui-monospace`).
- Inline `<style>` with tokens (`--ink`, `--paper`, `--accent`, `--muted`);
  editorial scale, line-height about 1.6, max-width about 1200px; an
  `@media print` block.
- Inline `<svg>` for architecture and flow diagrams (L only). No mermaid.
- `<details>` for investigation notes, file list, risk register.
- Provenance header: task slug, date, original prompt.
- Content mirrors the PRD.md sections with severity badges (`must` / `nice` /
  `out-of-scope`) and in-page anchor nav.
- Curved corners throughout; generated HTML never uses `border-radius: 0`.

## Execution modes (`--teams` / `--worktree`): planning only

These flags do **not** change how the PRD is produced. They add one section
to PRD.md, **"Execution plan"**, when the task list has 8 or more tasks:

- Group the phases into at most 4 file-disjoint workstreams (`ALPHA…DELTA`),
  each with its phases, owned files, dependencies, and the prerequisite the
  lead does first.
- `--worktree` adds branch names `prd/<slug>/<stream>` and the merge order
  (`--no-ff`, sequential).
- Fewer than 8 tasks: write "Solo, too small to split" and move on.

Actual execution (Agent Teams or worktrees) happens later, from `/ch` or the
user, not inside this command.
