---
name: app-user-journey
description: Scan a codebase for every user role and map each one's real journey — registration, onboarding, the day-one surface, and a proposed leaner path — then ship it as an internal R&D microsite of animated hand-drawn state machines plus a PRD. Use when the user types /app-user-journey, or asks to map the user journeys, onboarding flows, or per-persona experience of an app.
argument-hint: [project path] [--roles a,b,c] [--theme <sketches-theme>] [--prd-only]
---

# app-user-journey — map every persona's real journey

Produces two artifacts for any app:

1. **`_r&d/prd/<slug>/<MM-DD>/<HH-MM>/`** — INVESTIGATION.md, FILES.md, PRD.md, ACCOUNTABILITY.md.
2. **`/rnd/user-journeys`** — a microsite: one hub plus one page per role, each a
   three-act walk (Today → what they're handed → Proposed), driven by an animated
   state machine toggling before/after.

Proven on Renovyn (17 addiction profiles + supporters, 19 pages).

## Hard rules

1. **Derive, never re-describe.** Journey data must be *imported from the shipped
   code* at build time — the step definitions, the role enum, the module registry,
   the nav catalog. A hand-transcribed mirror is a lie waiting to happen; if you
   must mirror something, add a drift test in the same commit.
2. **One renderer.** Copy `JourneyMachine.tsx` + `machine-layout.ts` as a pair and
   do not fork them per page. The layout rule is fixed: **the box is fixed, the
   text fits itself** (see `references/state-machine.md`). Never re-implement node
   sizing inline.
3. **Obey the host CLAUDE.md** — terminology, copy bans, colour rules. Universal
   bans: no gradients, no card/border around sketches, no accent bars, never the
   word "AI" in page copy.
4. **Every drawing comes from the Sketches skill** (`~/.claude/skills/sketches/`).
   `find` before drawing, `add` anything new back.
5. **Internal only**: `robots: { index: false, follow: false }`, and the `/rnd`
   prefix allow-listed in the host's auth middleware.
6. **No new npm dependencies.** Motion library only if the host already has one.

## Workflow

### 1. Discover the roles
Find the app's actual persona split — do not invent personas. Look for:
- a role enum or union (`userRole`, `accountType`, `persona`, `role`) in the schema
  or shared types;
- role-forked route groups (`(dashboard)` vs `(partner-tabs)`, `/employer/*`);
- role-forked onboarding step arrays;
- guards/middleware that redirect by role.

Report the roles you found and the evidence, then confirm the list with the user
before building pages. `--roles` overrides discovery.

### 2. Derive the journey per role
For each role assemble, **from code**:
- **Act 1 · Getting in** — every registration and onboarding stop, in order, with
  which are skippable. Source: the step definitions module.
- **Act 2 · Today** — everything the app hands them on day one: tabs, default
  modules/features, pinned shortcuts, scoped data. Source: the registry/catalog
  that computes defaults.
- **Act 3 · Proposed** — the leaner path you are arguing for: a home seeded only
  by what they told you, menus that re-derive, and an onboarding that ends in a
  concrete next step rather than a tour.

Count the stops in both. The headline number is `Today · N stops` vs
`Proposed · M stops`; it must be computed from the graphs, never typed.

### 3. Resolve the theme
Match the project to an existing Sketches theme or register one from its palette:
`python3 ~/.claude/skills/sketches/render.py theme <name> --hero <hex> --ink <hex>`.
The theme's hero colour becomes the page accent and the machine's node fill.

### 4. Build
Follow `references/architecture.md` for the file layout, `references/state-machine.md`
for the renderer contract, and `references/acts.md` for the content model. Pages stay
thin: resolve a slug, call one builder, hand the result to the viewer.

### 5. Verify
`references/checklist.md`. Typecheck, lint, build, and smoke every route. Add the
layout tripwires from `references/state-machine.md` — text fits its shape, shapes
stay uniform, no node overlaps, walks are valid.

## Output

Report: the roles discovered and where each was found, the stop counts per role
(today vs proposed), the routes created, the PRD path, and anything derived by
hand that now needs a drift test.
