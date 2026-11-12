---
name: frontend-design
description: >
  Designs and builds production web UI that belongs in the product it ships in:
  app pages, components, flows, dashboards, landing and marketing pages. Names a
  track first (Extend, Direct or Refine), builds from the shared design system and
  sibling pages, and gates motion. Use to build, redesign, restyle or polish any web
  UI, or on fed, /fed, --fd, /fd-ch, "make it look good", "design this".
license: Apache 2.0. Based on Anthropic's frontend-design skill plus Emil Kowalski,
  Leonxlnx/taste-skill, and pbakaus/impeccable. See NOTICE.md for attribution.
---
# Frontend design

This skill decides how every interface you ship looks. `fed`, `/fed`, `--fd` and `/fd-ch` all run it. The house rules below hold even when you are a sub-agent that cannot see the user's global rules.

## House rules

They hold on every track and outrank every companion skill. Project rules (the project `CLAUDE.md`, `DESIGN.md`) can add to them, never relax them.

- Copy, in the UI, in code comments and in your report: no em or en dash, and no hyphen or parentheses standing in for one; split the sentence or use a comma. Compound hyphens (`read-only`) and CLI flags stay. Straight quotes, sentence-case headings and labels, no decorative emoji.
- Never write "AI" in user-facing copy (labels, buttons, tooltips, empty states, marketing). Say "smart" or "intelligent". Code names are fine.
- Text that fits its container on one line renders on one line. Labels, eyebrows, meta rows, badges, stats and numbers get `white-space: nowrap`. When text wraps that the width allows, fix the cause: a `max-width` cap, a flex or grid track that is too narrow, or a sibling taking the width. When a string cannot fit, break it on purpose at a clause boundary or step the size down; never leave the break to whichever word the browser reaches.
- Reuse what the project already has. Take the layout, components, data and wording from the way the app already does it; never invent a layout when one exists.
- Shared design system first. Install it from its release and never copy a component, token, icon or sketch into the app. A component two apps could use, and every new icon or illustration, goes into the design system first.
- Any multi-step flow or wizard shows step navigation with a progress bar.
- Files stay under 600 lines. Extract a module before adding to a longer file.
- The user verifies the running app. Do not start a dev server, open a browser, take screenshots or run Lighthouse unless asked. Check by reading the code (see Finish).
- Size the task: S and M tasks need no gates ledger; L and XL keep one at `gates/<task-slug>.md`, never a root `GATES.md`, whatever a companion skill says.
- Every summary ends with a `Storybook` section (see Finish).

## Step 1: name the track

Before reading further, decide which of three jobs this is, and write it as the first line of your reply.

- **Extend.** The surface lives inside an existing app or site: a new page, a section, a component, a state, a flow. The app's shell, design system and sibling pages already decide how it looks. Your job is to find those decisions and apply them. You do not choose a palette, a typeface, a corner style, a tone or a "signature".
- **Direct.** There is no visual system yet, or the user asked for a new look: a fresh landing page, a marketing site, a portfolio, a new brand. Your job is to set a direction and build it.
- **Refine.** The user named a pass on existing UI (polish, quieter, bolder, harden, clarify, adapt, onboard). Keep the current look; fix what the pass names.

A marketing page for an app that already has a brand in the shared design system is Direct for layout and Extend for tokens: use the brand's fonts, colours and corners, and set only composition and motion.

If you cannot tell, it is Extend. Write: `Track: Extend. Matching <sibling page> with <components>.` or `Track: Direct. Reading this as <page kind> for <audience>, <direction>.` If the read genuinely forks, ask one question; otherwise proceed.

## Extend

### Read what already decides the look

Do these in order and stop adding your own taste once they answer the question.

1. Project rules: the project `CLAUDE.md`, `DESIGN.md`, any copy or radius rules. They outrank everything in this skill.
2. The shared design system. If `package.json` installs one, read its README and the type declarations of what the installed version exports, then list which of its components cover this task (shell, page frame, header, table, stat, empty state, modal, form fields, tabs, badges). Use them as they are, with their props. Style app-local layout only with the system's utility classes. A system installed as a package keeps its tokens in `node_modules`, so a near-empty `globals.css` does not mean there is no system. With no shared system, read the token source (`globals.css`, `tailwind.config.*`, the theme file) and the components under `components/`. Either way, never write a colour, radius, shadow or font by hand, and never write a dark-mode value: the tokens already carry it.
3. The closest sibling page: the same entity seen by another role, the admin view, the neighbouring app. Take its layout, components, data shape and wording. A page for a new person type is that page, fed with their data.
4. The shell: menu, page frame and header stay exactly as they are. Never regroup or rename navigation.

If the system lacks a component two apps could use, stop and say so in one line ("the design system has no <X>; proposing it there"). Do not build a one-off copy in the app. A component only this app will ever use stays in the app, built from system primitives.

The brand's choices are correct by definition. If a brand uses pills, Inter, glass cards or large stat tiles, those are the right answer here, whatever any companion skill says about them.

### Product rules

Product UI succeeds when a user fluent in the category trusts it at once and the tool disappears into the task. Depth for each line: [reference/product-ui.md](reference/product-ui.md), read it for any table, form, settings page, dashboard, filter or wizard.

- Type: one family, a fixed rem scale with steps of 1.125 to 1.2, no fluid `clamp` sizes. Display faces stay out of labels, buttons and data.
- Colour: Restrained. The accent marks the primary action, the current selection and state, nothing decorative.
- Figures: right-aligned, `tabular-nums`, nowrap (the project's number class, such as `.num`, when it has one). Text columns left-aligned; each header aligns with its column.
- Tables scroll inside their own wrapper; the page never scrolls sideways.
- Forms: visible label above, helper and error below joined by `aria-describedby`, validate on blur. Match the sibling's save model (explicit save or autosave).
- Inline or progressive disclosure before a modal. Undo before a confirm; confirm in place for what cannot be undone.
- Same button shape, control vocabulary and icon style on every screen. Standard affordances, never reinvented for flavour.
- Charts, stat tiles and KPI rows: use the `dataviz` skill, inside the system's colours.
- Motion: 150 to 250 ms, state changes only, no page-load sequence (see the motion gate).

## Direct

### Set the direction from the subject

Decide in this order, one line each:

1. Scene: who uses this, where, under what light. This decides light or dark.
2. Colour strategy: Restrained (neutrals plus one accent), Committed (one colour owns 30 to 60 percent of the surface), Full (three or four named roles) or Drenched (the surface is the colour). Then name 4 to 6 values in oklch. Neutrals carry a trace of the brand hue.
3. Type: one family for an app, a display face plus a body face for a marketing page. Pick the face for a reason the subject supplies (its era, its material, its trade), not for its category.
4. Layout: one sentence and the first viewport in words: what sits where, at what scale, and where the primary action is.
5. Signature: the one element a visitor would describe an hour later.

Then run the self-check. If someone could guess your result from the category alone, rework it. The usual guesses are: a cream ground with a serif display and a terracotta accent; near-black with one neon accent and glow; a centred hero over a gradient blob; three equal icon cards; a big-number stats strip under the hero; an italic serif word inside a sans headline; small tracked mono labels above every section; a Geist and zinc page with one emerald button. Each is fine when the brief or brand asks for it. Landing on one when nothing asked for it means the decisions above were skipped.

A reference image or a named aesthetic pins the look: follow it inside the house rules and any brand tokens. Depth on colour strategy, choosing faces and density per surface: [reference/direction.md](reference/direction.md).

### Marketing mechanics

For any landing, marketing or portfolio page read [reference/marketing.md](reference/marketing.md). The lines that most change the result:

- The hero fits the first viewport: headline at most two lines, at most four text elements, the primary action visible without scrolling, and one real visual.
- Navigation is one line at desktop, 64 to 72 px tall, never over 80 px.
- One label per call-to-action intent across the page; labels fit one line.
- No layout family twice on a page. Eyebrows at most one per three sections.
- Real images or labelled placeholder slots, never `div`-built fake screenshots.
- One theme for the whole page. Motion only where it explains or directs; there is no motion quota.

## Refine

Keep the current look: tokens, layout, type and corners stay. Fix only what the pass names. Read `~/.claude/skills/impeccable/reference/<verb>.md` for the named verb (polish, quieter, bolder, distill, clarify, harden, adapt, onboard, typeset, layout, colorize, delight, animate, critique, audit, optimize). Those files were written for another setup: skip any step that serves a page, opens a browser, takes screenshots or runs `node .agents/...` scripts, and never use `new-work.md` on product UI. A pass that would change the brand's fonts, colours or corners is a Direct task; ask first.

## Motion gate

Motion is where bland pages die and over-animated pages also die. Run this gate before writing animation code. Depth and recipes: [reference/motion-design.md](reference/motion-design.md).

### 1. Should this animate at all?

| Frequency | Decision |
|---|---|
| 100+ times a day (keyboard, command palette) | No animation |
| Tens of times a day (hover, list navigation) | Remove, or near-imperceptible |
| Occasional (modals, drawers, toasts) | Standard |
| Rare or first-time (onboarding, success) | The delight budget lives here |

Never animate keyboard-initiated actions.

### 2. Purpose (required)

Valid: spatial consistency, state indication, explanation, feedback, preventing a jarring change, delight (rare tier only). "It looks cool" on a frequent surface means do not animate.

### 3. Easing and duration

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

- Enter and exit: ease-out (custom). No ease-in on UI; it feels sluggish.
- On-screen move: ease-in-out. Hover and colour: ease. Marquee and progress: linear.
- UI under 300 ms: press 100 to 160, tooltip 125 to 200, dropdown 150 to 250, modal or drawer 200 to 500.
- Product UI: 150 to 250 ms, state changes only, no page-load sequence.
- Exit faster than enter. A deliberate press can be slow; the release is snappy.
- Prefer CSS transitions over keyframes for interruptible UI.
- Animate transform and opacity only (height through `grid-template-rows` or `clip-path`). Name the properties; never `transition: all`.
- Never `scale(0)`: start from `scale(0.95)` with `opacity: 0`. Press feedback is `scale(0.97)`.
- Popovers grow from their trigger (`transform-origin`); modals stay centred.
- Stagger 30 to 80 ms, and never block interaction while it plays.
- Springs for gestures and alive decorative motion; bounce 0.1 to 0.3 at most, and rare.
- Gate hover behind `@media (hover: hover) and (pointer: fine)`.
- Honour `prefers-reduced-motion`: gentler (opacity and colour), not necessarily zero.
- Marketing pages: one orchestrated load or reveal moment beats scattered micro-effects.

## Floor for every track

- Every control is reachable by keyboard in reading order and shows a `:focus-visible` ring; never `outline: none` without a replacement.
- Icon-only buttons carry an `aria-label`; informative images carry alt text, decorative ones `alt=""`.
- Contrast AA: 4.5:1 for body text and placeholders, 3:1 for large text, icons and control borders.
- Colour is never the only signal; pair it with text or an icon.
- Async results (imports, syncs, saves) announce through `aria-live`.
- The layout holds at 200 percent zoom; type in rem; zoom never disabled.
- Touch targets 44 px, through padding or a pseudo-element when the visual is smaller.
- Every data view has loading (a skeleton shaped like the result), empty (what goes here and the action that fills it), error (what happened and the fix), and disabled or read-only where the data can be locked.
- Responsive, checked in code: flex children holding text get `min-w-0`, grids use `minmax(0, 1fr)`, no fixed pixel widths on content, `min-h-[100dvh]` over `h-screen`, and every multi-column layout states its fallback below 768 px in the same component.
- Check `package.json` before importing a library. Keep motion in client leaves (`'use client'`). Never animate from a `scroll` listener; use `useScroll`, ScrollTrigger, IntersectionObserver or CSS scroll-driven animation.

## Finish

The user checks the running app. Do not start a dev server, open a browser, take screenshots or run Lighthouse unless asked. Check by reading the code, once, then fix everything you found in one batch:

- Fit: every label, button, nav item, table cell, stat and meta row that must stay on one line has `white-space: nowrap` and the room for it at 375, 768 and 1280 px. Flex children holding text have `min-w-0`; grids use `minmax(0, 1fr)`; wide tables scroll inside their own wrapper. Where a string cannot fit, break it on purpose at a clause boundary or step the size down.
- System: no hand-written colour, radius, shadow or font; no component that duplicates one the design system or the app already has.
- States: loading, empty, error, disabled, and locked or read-only where the data can be locked.
- Floor: focus visible on every control, icon buttons named, contrast AA, reduced motion honoured, targets 44 px on touch.
- Copy: no em or en dash, no hyphen or parentheses used as a dash, straight quotes, sentence case, no "AI" (say "smart"), no decorative emoji.
- Typecheck and tests if they are cheap.

Report in under ten lines: what changed, anything not built, and one line per string or layout you could not prove fits. End with a `Storybook` section: one line per changed or added component, linking the design system's Storybook for system components, the app's Storybook when it has one, and "no story" when it has neither.

## Companions

Load at most two per task and name them. Several at once average into bland output. Hidden skills cannot be invoked: read their file. Where a companion asks for screenshots, a browser, a root `GATES.md`, a table report, curly quotes, a hyphen as a dash, or bans step labels and progress bars, the house rules win.

| Need | Companion |
|---|---|
| Any chart, graph, stat tile or KPI row | the `dataviz` skill |
| Illustration or doodle icons | `sketches`; in an app with a shared design system use its art package first, and new sketches go into the system |
| A Refine pass | `~/.claude/skills/impeccable/reference/<verb>.md` (read the one file) |
| Gesture-heavy motion: drag, sheets, toasts, springs | `emil-design-eng` |
| Physical, momentum-driven product UI | `apple-design` |
| Naming an effect the user described | `animation-vocabulary` |
| Where motion should or should not exist | `find-animation-opportunities`, then `improve-animations` |
| Reviewing a motion diff | read `~/.claude/skills/review-animations/SKILL.md` |
| An aesthetic the user named | read `~/.claude/skills/minimalist-ui/SKILL.md` or `~/.claude/skills/industrial-brutalist-ui/SKILL.md` |
| Choosing a component library, only with no design system | read `~/.claude/skills/pick-ui-library/SKILL.md` |
| Brand boards and logo systems | `brandkit` |
| Performance after the build | `vercel-react-best-practices` |

`design-taste-frontend` and `redesign-existing-projects` are not routed by default: [reference/marketing.md](reference/marketing.md) carries what they add. Load one only when the user names it.

## Working with a shared design system

When several apps share one design system, it is the source of every component, token, icon and illustration. Read what the installed version exports before building anything, use its theme settings (brand, mode, density, corners) as the app already sets them, and never write a dark-mode value or restyle a component away from its brand. Brands may use pills, glass surfaces or fonts that some skill calls overused; for that app they are right. Link system components to the system's Storybook: the hosted one when it exists, otherwise `http://localhost:6006/?path=/docs/<id>`.

## References

- [reference/product-ui.md](reference/product-ui.md): any app screen with tables, forms, settings, filters, dashboards, wizards or locked states.
- [reference/marketing.md](reference/marketing.md): landing, marketing and portfolio pages.
- [reference/direction.md](reference/direction.md): Direct track, before naming colours or faces.
- [reference/typography.md](reference/typography.md): type scale, pairing, font loading, numerals.
- [reference/color-and-contrast.md](reference/color-and-contrast.md): building a palette, contrast ratios, dark mode without a token system.
- [reference/spatial-design.md](reference/spatial-design.md): spacing scale, grids, hierarchy, container queries.
- [reference/motion-design.md](reference/motion-design.md): motion recipes past the gate.
- [reference/interaction-design.md](reference/interaction-design.md): states, focus, modals, popovers, keyboard patterns.
- [reference/responsive-design.md](reference/responsive-design.md): breakpoints, input method, safe areas, images, checks by reading code.
- [reference/ux-writing.md](reference/ux-writing.md): button labels, errors, empty states, terminology.
