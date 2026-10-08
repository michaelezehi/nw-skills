---
name: fd-ch
description: Frontend design with handoff continuity — runs the merged frontend-design skill (Emil motion + anti-slop + Impeccable craft floor) with reconnaissance, a quality gate, and an accountability record.
argument-hint: [design task] [--image /path/to/ref.png]
---
# Frontend Design + Handoff Mode

## Task

$ARGUMENTS

## Skills — load in this order, nothing else by default

1. **`~/.claude/skills/frontend-design/SKILL.md`** — Read it now. It is the
   orchestrator: Phase 0 design read → direction → build → motion gate →
   anti-slop pre-flight. Follow it.
2. `writing-clearly-and-concisely` — always active.
3. `vercel-react-best-practices` — only when the task touches data fetching,
   RSC boundaries, or bundle size.

**Context budget:** load at most **two** companion skills from the
frontend-design table (e.g. `emil-design-eng` for motion-heavy work,
`design-taste-frontend` for a landing page). Loading five design skills at once
is why output goes bland — the model averages them. Pick the two the brief
needs and state which.

## Protocol

### Step 1: Parse
Parse the task. If the design read genuinely forks, ask **one** question.
Otherwise proceed.

### Step 1.5: Reference image (only if the prompt holds an image path)
Skip unless the prompt contains a real file path (`/…/shot.png`). Then read
the image and write down its palette, type, layout and mood as a short spec.

That spec is the authoritative aesthetic reference.
Merge, don't replace: project tokens and infrastructure stay; where the
reference conflicts with the anti-slop bans, the ban wins.

### Step 2: Reconnaissance (this is "incumbent truth" in Phase 0)
Before any code, because the new work has to match the existing app:
1. Read the token source — `globals.css` / `tailwind.config.*` / `DESIGN.md`
   / theme file. Absorb every token, utility, keyframe, radius, font.
2. List reusable components in `components/` relevant to this task.
3. Read the target file(s) and one sibling page so the new work matches the
   shell (sidebar / navbar / content container).
4. Note project rules from the project `CLAUDE.md` (corner radius, copy
   rules, banned words). **Project rules beat this file and beat the skill.**

Write the Phase 0 line: `Reading this as: <page kind> for <audience>, <vibe>,
leaning <system>.` and the three dials.

### Step 3: Build
Follow frontend-design Phases 1–3. Ship real, working code. Reuse existing
components before creating new ones.

### Step 4: Quality gate
Run frontend-design Phase 4 (AI-slop test + pre-flight) plus:

| Check | Question |
|---|---|
| Cohesion | Belongs in the same app as every sibling page? |
| Tokens | Zero hardcoded colors/radii/fonts — everything from project tokens? |
| States | hover / focus-visible / active / loading / empty / error all present? |
| Motion | Passed the frequency + purpose gate? `prefers-reduced-motion` honored? |
| Responsive | 375px with no horizontal scroll; `min-h-[100dvh]` not `h-screen`? |
| Contrast | AA on every text/CTA? |
| Reuse | No new component that duplicates an existing one? |
| Reference fidelity | If an image was given, palette / spacing / mood match? |
| Coverage | Every requirement in the task is built, or named as not built? |

If any fails — fix it. Bounded passes: build → inspect desktop + mobile once →
fix in one batch → one confirm round → stop.

### Step 5: Accountability
Write `.claude/goals/<task-slug>/ACCOUNTABILITY.md` **once, at the end** (the shared
accountability home used by `own-goal`; append a dated run section if it exists): tasks with status, confidence
before/after (5 guessing · 8 clear · 10 bulletproof) with reasons, and gaps.

## Not a design system

This command does **not** carry a palette, surface style, or radius. Those
come from the project (Step 2). If the project has none, frontend-design
Phase 1 chooses one for this brief, and it must not be the anti-default set:
warm cream + terracotta serif, a cream page background, purple gradients,
glassmorphism everywhere, three equal cards, an italic accent word in the
headline, numbered `01 / 02 / 03` section labels, monospace labels, pill
buttons by default.

## The standard

Screenshot-worthy. Not "it works" — the kind of surface a design-literate user
would share as an example of craft. Iterate inside the bounded passes until it
meets that bar.

Handoff is automatic via `.claude/handoffs/` if context limits approach.
