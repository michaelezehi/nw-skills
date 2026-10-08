# Scaffold — the rnd/ surface and the design language

## Where pages live

1. **React/Next host → real routes** at `app/rnd/...` (or the host's router
   equivalent), built from `templates/react/`. Never static HTML in `public/`
   when the host is a React app. Allow-list `/rnd` in the auth middleware.
2. No framework: an existing `rnd/` (any depth) — extend it;
3. else a served `docs/` or site root;
4. else `rnd/` at the project root (opens via `file://` and any static server).

Layout per artifact:

```
rnd/
  index.html                 # the R&D index (templates/rnd-index.html)
  <slug>/index.html          # consensus OR product page
  <slug>/demo/index.html     # demo page (inside its product page when one exists)
  <theme>/demo/index.html    # PRD-sourced demos: one page PER THEME, never one
                             # giant page named after the PRD (see demo.md)
```

`slug`/`theme` = kebab-case topic (the feature's name, e.g. `circle`, not the
document's). The index is append-only: each new artifact adds one entry to its
`ENTRIES` array (one entry per theme for demo sets); never remove or rewrite
existing entries.

## The index page

From `templates/rnd-index.html`. Eyebrow `<Project> · R&D`; headline "Where we
think out loud / about what we're building."; sub "Living briefs and visual
prototypes from the team. Each entry is a single, shareable page, written for
clarity rather than marketing."; then the divided list of ENTRIES with status
chips (live / in-progress / planned) and dates; footer "Internal R&D surface.
Not indexed. Not for redistribution without permission."

## Design tokens (every page carries this block)

Resolve `--hero` (+ optional `--accent`) from the project's Sketches theme;
the rest is fixed:

```css
:root {
  --ink: #0f172a;        /* headings, primary text */
  --body: #475569;       /* body text */
  --faint: #94a3b8;      /* eyebrows, metadata */
  --line: #f1f5f9;       /* hairline borders */
  --line-2: #e2e8f0;     /* card borders */
  --paper: #ffffff;      /* page surface */
  --panel: #f8fafc;      /* quiet panels */
  --hero: #fde047;       /* ← from the Sketches theme */
  --hero-soft: #fefce8;  /* hero at panel strength */
  --hero-deep: #a16207;  /* hero at text strength */
}
body { margin: 0; background: var(--paper); color: var(--ink);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased; }
```

## Typography & component register (match the proven pages)

- **Eyebrow**: 11px, 600, uppercase, `letter-spacing: .18em`, `--faint`.
- **Headline**: 40–52px, 700, `letter-spacing: -.02em`, line-height 1.1; the
  second line often 400-weight `--faint` ("…screen by screen.").
- **Body**: 14–17px, `--body`, line-height 1.6, max-width ~65ch.
- **Chips**: pill, 10–11px, 600, uppercase tracked; status colours: live =
  soft green, in-progress = soft amber, planned = `--panel`.
- **Cards/panels**: `1px solid var(--line-2)`, radius 12–16px, white or
  `--panel`. Highlight panels use `--hero-soft` bg + hero border.
- **Buttons**: primary = `--ink` bg / white text; secondary = bordered;
  hero-accented for the one main CTA. Radius 8–10px, 13px 600.
- **Header**: sticky, white with hairline bottom border; left = mark + "R&D" +
  project name; right = "Main site" link (and the identity chip on consensus).
- **Sketches** render in their emitted `<figure class="sk">` — no white card,
  border, shadow, or accent bar around them; size via the figure's width.

## Universal bans (apply on top of the host's own rules)

No gradients anywhere. No side/top accent bars on cards. No "AI" in page copy
(write "smart"/"intelligent" or name the actual feature). No CDN fonts/scripts.
No purple/indigo dominance unless it is the project's actual brand. Every page
head: `<meta name="robots" content="noindex, nofollow">`, a real `<title>`
(`<Topic> · R&D · <Project>`), `lang` attribute, viewport meta.

## Host-rules check (do this before writing copy)

Read the host project's CLAUDE.md (root + app level) and extract copy bans and
terminology mandates (e.g. founder-x: "alignment" never "assessment",
"capacity" never "wellbeing"). Apply them to ALL page copy, captions, sketch
labels, and index summaries.
