# Progress panel (savvy-progress mod)

The savvy-progress mod draws a progress bar above the prompt and an agents
panel (`/agents-info`). The panel lists every subagent on its own, with its
model, context, cost and time. The bar and the planned rows need the driver to
report the plan. Worker step bars need each worker to report its steps.

This is on by default for every run of `/ch`, `/prd-ch`, `/reviewer` and
`/own-goal`, and for any task that dispatches sub-agents. The tools are
deferred, so the first action of the run, before planning, is ToolSearch
`select:mcp__savvy-progress__progress,mcp__savvy-progress__step`. Not
listing them at the start is no reason to skip: load them first. Skip only when
ToolSearch finds nothing (the mod is uninstalled), and never let a progress
call block or fail the real work.

## One bar per run: carry on, never duplicate

Skills call each other (`own-goal` runs `/reviewer`, `/ch` may run `/prd-ch`).
Only the outermost run owns the bar.

- Tools already loaded this session: do not load them again.
- A bar already running (this session sent `title` and `tasks`, and has not
  sent `finished: true`): do not send a new `title`, do not reset `done`, do
  not send `finished`. Append your own work as new rows at the end of the
  existing `tasks` list (resend the whole list with your rows added, `total`
  raised to match), mark them done as they finish, and hand back.
- A row for the same work already in the list (same title): reuse it, never
  add a second.
- No bar running: you are the outermost run; report as below and close it
  with `finished: true` at the end.

A skill that does its work inline with no sub-agents still reports: its steps
are the rows, at the tier of whoever does them.

## Driver: `mcp__savvy-progress__progress`

Call it at these moments. Fields left out keep their last value.

| When | Fields |
|---|---|
| Plan written, before the first dispatch | `title` (a few words), `total`, `tasks`, `phase` |
| Phase changes | `phase` |
| A task is accepted | `done` (running count of accepted tasks) |
| Re-plan, a redo, or a new gap phase | `tasks`, `total` |
| End of the run | `finished: true`, `phase: "close"` |

`tasks` is `[{ title, tier, after? }]` in plan order, numbered from 1.
`after` lists the task numbers it waits for. **Each `title` must equal the
`description` you pass to the Agent tool for that task, character for
character**, or the panel cannot match the run to the planned row.

`phase` is one of `plan`, `design`, `delegate`, `review`, `close`.

`tier` maps from our model tiering, and so does the agent type you dispatch:

| Our leaf | `tier` | `subagent_type` | `model` |
|---|---|---|---|
| Hardest logic, rare; never when the driver is Fable | `fable` | `savvy-flow:savvy-fable` | (its own) |
| Opus investigation, unclear root cause | `heavy` | `savvy-flow:savvy-heavy` | `opus` |
| Opus design, integration, verification | `careful` | `savvy-flow:savvy-careful` | `opus` |
| Standard build work | `medium` | `savvy-flow:savvy-medium` | `opus` |
| Mechanical work, check runs | `light` | `savvy-flow:savvy-light` | `sonnet` |
| Read-only research readers | `medium` | `Explore` | (its own) |

## Agent types and the panel's look

The panel gives a coloured tier label and a costumed crab only to agent types
starting with `savvy-` (and `Explore`, which has its own costume). Any other
type shows as a grey crab labelled with its type name, still with live context,
cost and time. So:

- Generic worker leaves go to the `savvy-flow:savvy-<tier>` agents above.
  These workers already report their own steps, so their briefs need no
  worker step line. Always pass `model` as in the table: `savvy-light` is Opus
  by default, and our rule puts mechanical work on Sonnet.
- A leaf that needs a specialist persona (the `own-goal` roster: Backend
  Architect, Security Engineer and the rest) keeps its specialist type and the
  worker step line below. It draws grey; the persona is worth more than the
  costume.
- The savvy workers' own rules (stay in scope, verify, report) sit under our
  brief. Our ownership and commit rules still go in every brief.

Work the driver does inline still gets a row when it is a planned task, so the
count stays honest; mark it done when accepted.

## Workers: `mcp__savvy-progress__step`

Add this line to every brief whose agent type does not start with `savvy-`:

> If the tool `mcp__savvy-progress__step` is available, call it right after
> reading this brief with `total` (your plan in 3 to 8 steps) and `done: 0`,
> then again as each step finishes with `done` and a few-word `note`. Skip it
> if the tool is not there.
