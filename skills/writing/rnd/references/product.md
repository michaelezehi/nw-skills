# Product mode — agreed decisions → screen-by-screen build deck

Reproduces founder-x `/rnd/production-flow`: the agreed outcome turned into a
production flow — one screen at a time, each a self-contained brief with a
wireframe, the build scope, and the technical call that is the build premise.

## 1. Build the SCREENS data

Input: the accepted consensus page (preferred), a decisions doc, or a PRD.

- One `FlowScreen` per screen (see `anatomy.md`): `n` (order), `name`, `term?`
  (the proper technical term behind the friendly name), `intent` (one line),
  `context` (a short plain paragraph: what it is today + what changes),
  `build[]` (the agreed scope as bullets), `rec` (the technical call — written
  first-person, plainly, as the decision the build rests on), `open?` (the
  question that call resolves).
- **Reuse rule:** when a sibling consensus page exists, keep its page `id`s so
  the deck inherits the same sketches and "today" baseline for free, and link
  each screen's sources to the same DOCS sections.
- Write `EXEC_SUMMARY` — the whole build in one paragraph.
- Plain language throughout. The deck is read by the whole team, not engineers.

## 2. The deck page

**React host (default):** route `app/rnd/<slug>/page.tsx` (`product-page.tsx`)
renders the `ProductionFlow` client (`templates/react/ProductionFlow.tsx` +
`product.module.css`), fed a `ProductData` module at `lib/rnd/<slug>.ts`
(`flow-data.example.ts`). **No-framework fallback:** one `index.html` from
`templates/product.html`. Anatomy (both):

- **Hash routing.** One slide at a time; the address bar tracks position
  (`#<screenId>`), so any screen is deep-linkable. `hashchange` listener +
  render function; unknown hash → intro.
- **Intro slide** — eyebrow, headline ("What we're building, screen by
  screen"), intro paragraph, the EXEC_SUMMARY in a quiet panel, two cards
  ("How to read this" / "Before we build"), the numbered screen index (each
  links `#<id>`), CTAs: Start the flow · Walk the interactive demo (only if a
  demo exists) · Open the votable spec (only if a consensus page exists).
- **Contents rail** — sticky left list of numbered screens, active highlighted
  with the hero accent; collapses to a `<select>` on small viewports.
- **Screen slide** — two columns: the wireframe left (Sketches output, bare —
  the page controls the frame, no card around the drawing); right: the screen
  number + name + `term`, `intent`, `context`, "What we're building" checklist
  (`build`), a "Technical call" panel (`rec`, visually distinct — hero-accent
  border-left is NOT allowed; use a tinted panel), and `open` as a quiet
  footnote. If the matching demo flow exists, an "Open the interactive demo"
  link deep-linking `demo/index.html#<flowId>`.
- **Interactive form slot.** A screen that benefits from a working mock (a
  signup gate, a wizard) embeds one inline as plain HTML/JS below the brief —
  the FoyerForm pattern. Build at most one or two; they carry the "this is
  real" feeling.
- **Prev / Next** footer with position indicator (`3 / 12`).

## 3. Sketches

One wireframe per screen, reused from the consensus page when ids match.
For richer deck mockups render larger (`--size` up) rather than redrawing.
New screens: `find` → draw in house style → `add`.

## 4. Report

Page path/URL, screen count, which sketches were reused vs newly added, links
wired (consensus ←, demo →), and the index entry added.
