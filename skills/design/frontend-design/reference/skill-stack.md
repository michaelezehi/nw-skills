# Frontend Design — Skill Stack

`frontend-design` and `fed` are the same entrypoint. They orchestrate craft from three sources while leaving each skill callable on its own.

## Sources

| Source | Install | Role in the merge |
|---|---|---|
| [emilkowalski/skill](https://github.com/emilkowalski/skill) | `npx skills add emilkowalski/skill` | Animation decision framework, easing/duration budgets, springs, gestures, review bar |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `npx skills add Leonxlnx/taste-skill` | Anti-slop design read, three dials, AI-tell bans, landing/portfolio pre-flight |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `npx skills add pbakaus/impeccable` | Craft floor, modes (persuade/operate/read/experience), refine/enhance commands |

## Individual skills (invoke by name)

### Motion — Emil

- **emil-design-eng** — Full design-engineering philosophy; UI review as Before/After/Why table
- **animation-vocabulary** — Vague motion description → exact term
- **find-animation-opportunities** — Where motion should / should not exist (read-only)
- **improve-animations** — Motion audit → self-contained plans under `plans/`
- **review-animations** — Diff review against Emil standards
- **apple-design** — Apple HIG-leaning visual/motion taste
- **prototype** — Fast interactive prototype workflow
- **pick-ui-library** — Choose a component library for the job

### Taste — Leonxlnx

- **design-taste-frontend** — Primary anti-slop landing/portfolio skill (full pre-flight)
- **redesign-existing-projects** — Preserve vs overhaul protocol
- **minimalist-ui** / **industrial-brutalist-ui** — Opt-in aesthetic presets (user must name them)
- **brandkit** — Brand token extraction / application
- **stitch-design-taste** — Only when generating in Google Stitch
- **image-to-code** / **imagegen-frontend-web** / **imagegen-frontend-mobile** — Image → UI paths
- Retired 2026-08-16 (contradicting palettes/radii; see `~/.claude/_retired/`): design-taste-frontend-v1, high-end-visual-design, gpt-taste, full-output-enforcement

### Impeccable — pbakaus

- **impeccable** — Router + full command suite (`shape`, `init`, `document`, `extract`, …). Verb passes live in `impeccable/reference/<verb>.md` (animate, polish, delight, bolder, quieter, distill, harden, onboard, colorize, clarify, adapt, optimize, critique, audit, extract). The July-2026 standalone copies of those verbs were retired on 2026-08-16 — impeccable 4.x supersedes them.

## How FED uses them

```
User: frontend-design | fed
        │
        ├─ Phase 0  Design read + dials          ← taste
        ├─ Phase 1  Direction plan               ← frontend-design + impeccable craft floor
        ├─ Phase 2  Build UI                     ← frontend-design refs + taste bans
        ├─ Phase 3  Motion gate + recipes        ← Emil (+ motion-design.md)
        └─ Phase 4  Slop test / pre-flight       ← taste §14 + impeccable verify
```

When the user names a companion skill directly, run that skill's SKILL.md as the authority for the turn — do not dilute it through the orchestrator.
