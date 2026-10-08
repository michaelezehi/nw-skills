# Demo mode — PRD/deck → per-theme demo pages with a side menu

The design taken into reality: keyboard-driven pages of rich app-shell
mockups, one **theme** per page, navigated by a left side menu (not top
tabs). Proven on Renovyn `/rnd/<theme>/demo/` (14 themes, 51 scenes).

## 1. Themes, flows and scenes

Input: a sibling product deck (its SCREENS) + which flow(s) to build —
**or a PRD document directly** (the no-flag default when a PRD is given).

- From a PRD: each stream / workstream / user-facing feature becomes a
  **theme**. A multi-stream PRD (or a set of PRDs) produces **one page per
  theme** at `rnd/<theme-slug>/demo/index.html` — never one giant page named
  after the PRD. The theme slug is the feature's name (`circle`,
  `become-a-sponsor`), not the document's.
- When the user has several captured PRDs, cover **all** of them as themes
  unless told otherwise; each theme records its own `prd` source string.
- A theme breaks into 2–6 ordered **scenes** — the moments a user moves
  through ("you land", "you choose who sees it", "the reveal"). Each scene:
  `id` (deep-link hash), `title`, `caption` (one or two plain lines),
  `detail` (3–5 bullets lifted from the PRD: task ids, schema, acceptance
  criteria — this is the "read more" layer), and a rich mockup.
- Confirm the derived theme list (names + scene count each) with the user
  before drawing.

## 2. The mockups (Sketches, richer register)

Demo scenes are **app-shell mockups**, not concept doodles: viewBox ~820×512,
the product's real chrome (phone frame + tab bar, or browser window), mostly
ink-and-faint with **exactly one hero-accent focal point** per scene, and an
optional small annotation doodle beside the shell telling the scene's story.
Recurring chrome is drawn once and `add`ed to the repertoire as its own named
sketch (`<project>-phone-shell`, `<project>-web-shell`) so every scene and
every later project reuses it. Solid fills of real semantic colours are
allowed — still no gradients.

## 3. The page

**React/Next host (the default):** use `templates/react/` — real App Router
routes (`app/rnd/page.tsx` index + `app/rnd/[theme]/demo/page.tsx`), a client
`DemoViewer`, a CSS module carrying the design tokens, and one generated data
module per theme under `lib/rnd/themes/`. The URL hash is the single source
of truth for the visible scene. Allow-list `/rnd` in the host's auth
middleware and add the `/rnd/:theme → /rnd/:theme/demo` redirect. See
`templates/react/README.md`.

**No-framework host:** one self-contained page per theme from
`templates/demo.html`. Anatomy (shared by both implementations):

- **Side menu** (left rail, sticky): project mark; all themes in order,
  numbered; the current theme highlighted (`--hero-soft`) with its scenes
  listed beneath as dot-links; footer links back to the rnd index. Sibling
  theme links point at `../../<slug>/demo/index.html`.
- **Stage**: eyebrow (`Theme · n of N`), scene title, mockup, caption.
- **"From the PRD" panel**: a collapsed `<details>` under the caption with
  the scene's `detail` bullets; the open/closed state persists while
  stepping. A `Source:` line names the PRD file(s).
- **Keyboard**: ←/→ step scenes; at a page's ends they cross into the
  previous/next theme page (`#last` lands on the prior page's final scene).
  Escape returns to the rnd index.
- **Deep links**: `#<sceneId>`; hash updates as you step.
- **Prev/Next buttons** mirror the arrows and rename themselves at the
  edges ("← Gen Z home" / "Switch-ons →").
- DATA block: `ALL_THEMES` (id, name, href) + `CUR` (this theme's id, name,
  prd, scenes). Field names in anatomy.md.

When a product deck exists, keep `FLOWS_WITH_DEMO` gating on the deck side
and link each deck screen to its theme page; PRD-sourced standalone demos
link only to the rnd index.

## 4. The index

One `ENTRIES` row per theme (not one for the whole PRD), each with a
one-line summary and a repertoire icon. Status `live` once the page ships.

## 5. Report

Pages built (themes × scenes), repertoire sketches reused vs added (name the
shells), index entries added, and what was deliberately left for later.
