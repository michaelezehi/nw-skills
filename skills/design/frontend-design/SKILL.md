---
name: frontend-design
description: >
  THE frontend/UI skill for this machine — use this one, not the frontend-design
  plugin. Create distinctive, production-grade frontend interfaces with high craft:
  typography, layout, color, and purposeful motion that avoid generic AI aesthetics.
  Merges Emil Kowalski animation craft, taste-skill anti-slop direction, and Impeccable
  craft-floor standards, and routes to the right companion skill (never more than two).
  Use whenever the user asks to build, redesign, restyle, or elevate any web UI —
  pages, landing pages, dashboards, components, modals, forms, visual systems — or
  says fed, /fed, --fd, "make it look good", "design this". Alias: fed.
license: Apache 2.0. Based on Anthropic's frontend-design skill plus Emil Kowalski,
  Leonxlnx/taste-skill, and pbakaus/impeccable. See NOTICE.md for attribution.
---
# Frontend Design (FED)

This is the merged design skill. Invoking **frontend-design** or **fed** runs the same workflow.

You are the design lead: bold direction, anti-slop discipline, and motion that feels right — not templated, not bland, not over-animated.

## Precedence for "build / redesign this UI"

This skill is the top of the stack. Order of authority when several apply:

1. **Project rules** — project `CLAUDE.md`, `DESIGN.md`, existing tokens (e.g. square corners in app UI). Always win.
2. **frontend-design** (this file) — process, dials, motion gate, slop test.
3. **impeccable** — craft floor + per-verb passes (`polish`, `bolder`, `quieter`, `typeset`, `animate`, `harden`, `onboard`, …). Read `impeccable/reference/<verb>.md` for a focused pass; do not look for standalone skills of those names — they were retired.
4. **design-taste-frontend** — only for landing / portfolio / marketing redesign.
5. `21st-ui-build` — only if the project has `.21st/design.json`.
6. `vercel-react-best-practices` — perf review after the build, not a design source.

## Companion skills — load at most TWO per task

Every companion is 200–1,200 lines of overlapping prose. Loading several at once averages them into bland output and burns context. Pick the two the brief needs, name them, stop.

| Skill | When to load |
|---|---|
| `design-taste-frontend` | Landing/portfolio/marketing redesign — full anti-slop pre-flight (§14), dials, AI-tell bans |
| `emil-design-eng` | Motion-heavy work: springs, gestures, drawers/sheets/toasts, clip-path, Sonner-level polish |
| `impeccable` (`reference/<verb>.md`) | A focused verb pass on existing UI |
| `animation-vocabulary` | Name a motion effect the user described vaguely |
| `find-animation-opportunities` | Where motion should (and should not) exist on an existing surface |
| `improve-animations` / `review-animations` | Motion audit / motion diff review |
| `apple-design` | Gesture-driven, physical, fluid product UI |
| `redesign-existing-projects` | Preserve-vs-overhaul protocol for an existing site |
| `minimalist-ui` / `industrial-brutalist-ui` | Only when the user names that aesthetic (opt-in presets) |
| `brandkit` | Brand-board / logo-system imagery |

Full routing notes: [reference/skill-stack.md](reference/skill-stack.md).

## Reconnaissance (existing projects, before Phase 0)

On an existing project the work has to match what is already there, so read this first:


1. Read the token source: `globals.css` / `tailwind.config.*` / `DESIGN.md` / theme file. Absorb every token, radius, font, keyframe.
2. List reusable components under `components/` relevant to the task.
3. Read the target file and one sibling page so the work matches the shell.
4. Note project rules (radius, copy bans, "no AI in copy", fonts). They override every default below.

If the project has tokens, **you do not choose a palette** — you extend theirs.

---

## Phase 0 — Design Read (before any code)

Infer the brief. Do not jump to a default aesthetic.

1. **Page kind** — landing, portfolio, product UI, marketing section, redesign, editorial
2. **Audience + job** — who, in what context, what one job this surface does
3. **Vibe words / references** — Linear, Apple-y, editorial, brutalist, trust-first, etc.
4. **Incumbent truth** — existing tokens, brand, DESIGN.md / PRODUCT.md if present
5. **Constraints** — a11y, regulated, performance, framework

State one line before building:

> **Reading this as:** \<page kind> for \<audience>, \<vibe> language, leaning \<system/aesthetic>.

If the read genuinely forks, ask **one** clarifying question. Otherwise proceed.

### Three dials (set from the read)

| Dial | 1 … 10 | Default |
|---|---|---|
| `DESIGN_VARIANCE` | Perfect symmetry → artsy chaos | 7–8 marketing / 4–5 product |
| `MOTION_INTENSITY` | Static → cinematic | 5–7 marketing / 2–4 product |
| `VISUAL_DENSITY` | Art gallery → cockpit | 3–4 marketing / 5–7 product |

Overrides from the brief always win. If `MOTION_INTENSITY > 4`, the page must actually move — claim without motion is failure. If you cannot ship working motion, drop the dial and ship clean static.

---

## Phase 1 — Direction

Commit to a bold, brief-specific direction:

- **Tone** — one extreme executed well (minimal, editorial, luxury, industrial, playful, …)
- **Palette** — 4–6 named hex/oklch values; tint neutrals toward brand hue; one accent locked page-wide
- **Type** — characterful display (restrained) + complementary body (+ utility if needed). Prefer distinctive faces; avoid Inter/Roboto/Arial/Open Sans as defaults
- **Layout concept** — one sentence + mental wireframe; asymmetry when variance > 4
- **Signature** — the single memorable element this page earns

**Anti-default:** warm cream + terracotta serif, purple-on-white / purple-indigo gradients, broadsheet hairline newspaper, dark mode + acid neon glow, three equal icon cards, hero-metric template. Legitimate when the brief pins them; never as free-axis defaults.

Match complexity to vision. Maximalism needs elaborate execution; minimalism needs precision.

Consult references as needed:
- [typography](reference/typography.md)
- [color-and-contrast](reference/color-and-contrast.md)
- [spatial-design](reference/spatial-design.md)
- [motion-design](reference/motion-design.md) ← Emil-hardened
- [interaction-design](reference/interaction-design.md)
- [responsive-design](reference/responsive-design.md)
- [ux-writing](reference/ux-writing.md)

For landing/portfolio pre-flight depth, Read `design-taste-frontend`. For craft-floor bans, Read `impeccable/reference/craft-floor.md`.

---

## Phase 2 — Build with craft floor

Ship real working code. Quality floor:

### Typography
- Modular / fluid scale (`clamp`); clear hierarchy via weight, size, tracking
- Display with restraint; body measure ~65–75ch
- No lazy monospace-as-"technical"; no oversized icon-above-every-heading pattern
- Serif only when the brief/aesthetic truly earns it — not as creative costume
- Italic display with descenders (`y g j p q`): enough line-height / padding so glyphs do not clip

### Color & theme
- Dominant color + sharp accent > timid even distribution
- Prefer `oklch` / `color-mix` / semantic tokens
- Never gray text on colored backgrounds — tint from the surface hue
- No pure `#000` / `#fff` — always tint
- One accent locked across the whole page; one corner-radius system

### Layout & space
- Visual rhythm: tight groups, generous separations; more space above headings than below
- Fluid spacing; break the grid intentionally when variance is high
- Cards only when elevation communicates hierarchy — never hero cards, rarely nested cards
- Hero: brand + one headline + one short support + CTA group + one dominant visual. No stats strips, pill clusters, or secondary marketing in the first viewport
- No detached badges / stickers overlaid on hero media
- Mobile: adapt, do not amputate; prefer `min-h-[100dvh]` over `h-screen`

### Interaction
- Full state cycles: hover, active, focus, loading, empty, error
- Press feedback: `transform: scale(0.97)` (~100–160ms ease-out) on pressable surfaces
- Optimistic UI where safe; progressive disclosure for complexity
- Every CTA: WCAG AA contrast; labels fit one line at desktop; one label per intent page-wide

### Copy
- Specific > clever; active voice; product language not system language
- Errors name the problem and the fix; empty states invite action
- No filler verbs (elevate, unleash, seamless, next-gen) unless brand voice demands them
- No em dashes (`—`) in copy. Use a period or a comma, not a hyphen standing in for a dash

---

## Phase 3 — Motion (Emil decision framework)

Motion is where bland pages die and over-animated pages also die. Run this gate before writing animation code.

### 1. Should this animate at all?

| Frequency | Decision |
|---|---|
| 100+/day (keyboard, command palette) | No animation |
| Tens/day (hover, list nav) | Remove or near-imperceptible |
| Occasional (modals, drawers, toasts) | Standard |
| Rare / first-time (onboarding, success) | Delight budget lives here |

Never animate keyboard-initiated actions.

### 2. Purpose (required)

Valid: spatial consistency · state indication · explanation · feedback · preventing jarring change · delight (rare tier only).

"It looks cool" on a frequent surface → do not animate.

### 3. Easing & duration

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

- Enter/exit → ease-out (custom). No ease-in on UI; it feels sluggish
- On-screen move → ease-in-out
- Hover/color → ease; marquee/progress → linear
- UI under **300ms** (press 100–160 · tooltip 125–200 · dropdown 150–250 · modal/drawer 200–500)
- Exit faster than enter; press slow when deliberate, release snappy
- Prefer CSS transitions over keyframes for interruptible UI
- Animate **transform + opacity** only (height via `grid-template-rows` or clip-path)
- Never `scale(0)` — start `scale(0.95)+opacity:0`
- Popovers: origin-aware (`transform-origin` at trigger); modals stay centered
- Stagger 30–80ms; never block interaction
- Springs for gestures / alive decorative motion; bounce 0.1–0.3 max, rare
- Gate hover behind `@media (hover: hover) and (pointer: fine)`
- Honor `prefers-reduced-motion` — gentler (opacity/color), not necessarily zero
- Orchestrate one high-impact load/reveal moment over scattering micro-effects

Deep recipes: [reference/motion-design.md](reference/motion-design.md) or Read `emil-design-eng`.

If hunting opportunities on existing UI → `find-animation-opportunities`.  
If auditing broken motion → `improve-animations` / `review-animations`.

---

## Phase 4 — AI slop test + pre-flight

**Test:** If someone said "AI made this," would they believe it immediately? If yes, revise.

Hard fails unless the brief explicitly earns them:
- Inter/Roboto/Arial defaults · purple/indigo glow gradients · three equal feature cards
- Hero-metric template · glassmorphism everywhere · gradient text for "impact"
- Section-number eyebrows (`01 / Capabilities`) · eyebrow spam (max ~1 per 3 sections on marketing)
- Div-based fake product screenshots · Jane Doe / Acme / "Quietly trusted by"
- Scroll cues (`Scroll to explore`) · decoration marquee spam (max one marquee per page)
- Cream or off-white page background as the unexamined default · one italic (often serif) accent word inside a sans headline
- Monospace eyebrows and labels as "technical" decoration · pill buttons as the default button shape
- `transition: all` · `ease-in` on UI · animation on keyboard actions

Landing/portfolio: run the mechanical pre-flight inside `design-taste-frontend` §14 before declaring done.

Verify in bounded passes: build fully, check against this list by reading the code, fix in one batch, stop. Rendering desktop and mobile in a browser is the user's call (they have the app open); do it only when they ask. Open-ended self-QA burns budget.

---

## Implementation principles

- Match implementation complexity to the aesthetic vision
- Isolate motion in client leaves (`'use client'`) when using RSC
- Prefer Motion (`motion/react`) for UI; GSAP ScrollTrigger only for pin/scrub storytelling — never mix both in one component tree
- Never `window.addEventListener('scroll')` for animation — use `useScroll`, ScrollTrigger, IntersectionObserver, or CSS scroll-driven animations
- Check `package.json` before importing libraries; install first if missing
- Existing project design system / tokens win over inventing a parallel one
- Vary across projects — never converge on the same safe look twice in a row
- Commit fully to the chosen vision; restraint around the signature, boldness in one place. Every flourish still has to pass the Phase 3 frequency and purpose gate
