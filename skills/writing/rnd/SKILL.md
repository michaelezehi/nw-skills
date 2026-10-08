---
name: rnd
description: Create a shareable internal R&D page from a team brief — a votable consensus spec with a participant intro gate (--consensus), a screen-by-screen product build deck (--product), or an interactive demo carousel (--demo). On a React/Next host the output is REAL ROUTES inside the public-facing app (app/rnd/…), not static HTML; every wireframe is drawn with the Sketches skill; consensus votes are shared live via Convex. A PRD document with no flag defaults to --demo. Use when the user wants an R&D page, living spec, consensus or sign-off page, build deck, or interactive design demo, or hands over a PRD to visualise.
argument-hint: [--consensus | --product | --demo] <brief path | topic | participants>
---
# rnd — R&D pages from team briefs

Turns a team's thinking into a sketched, shareable, internal R&D page.
Proven on Founders Align: `/rnd/platform-redesign` (consensus),
`/rnd/production-flow` (product), `/rnd/production-flow/demo` (demo).
This skill reproduces those three archetypes in **any** project as
host-native pages: real routes in a React/Next host, self-contained HTML
otherwise (rule 2). Pages share by URL.

## Hard rules

1. **Every drawing comes from the Sketches skill** (`~/.claude/skills/sketches/`).
   Never hand-write wireframe SVG. `find` before drawing, `get`/`page` to render,
   `add` anything new back. Strip the `{/* … */}` comments from emitted bodies
   when pasting into plain HTML.
2. **Pages are host-native.** In a React/Next host, R&D pages are real routes
   inside the app (`templates/react/` — App Router pages + a client viewer +
   per-theme data modules), never throwaway HTML in `public/`. Only when the
   host has no web framework: one self-contained `.html` per page (system
   fonts, inline `<style>`/`<script>`/SVG). Either way: no CDNs, no new npm
   deps (never `doodle-icons`). Allow-list the `/rnd` prefix in the host's
   auth middleware, or the pages redirect logged-out participants to sign-in.
3. **Consensus state is shared via Convex, not localStorage alone.** Votes,
   comments, and agreements have to be visible to every participant, so they live
   in a Convex backend mirroring founder-x's `rnd_spec` module (fixed person
   allow-list, length caps). The React path uses live `convex/react`
   `useQuery`/`useMutation` subscriptions (`templates/react/useSpec.ts`); the
   HTML fallback uses vanilla `fetch` against the Convex HTTP API. Identity
   (who am I) stays per-person in `?as=` + localStorage either way.
   See `references/consensus.md` for the wiring.
4. **Follow the host project's CLAUDE.md** — terminology, copy bans, colour rules.
   Do not import another project's house rules. Universal bans regardless of
   host: no gradients, no card/border around sketches, no accent bars, never
   the word "AI" in page copy.
5. **The design language is fixed** (see `references/scaffold.md`): slate ink on
   white, uppercase tracked eyebrows, big tight-tracked headlines, one hero
   accent from the project's Sketches theme, status chips, divided-list index.
6. Pages are internal: `<meta name="robots" content="noindex, nofollow">`.

## Workflow

1. **Parse the flag.** `--consensus` | `--product` | `--demo`. No flag:
   if the input is (or points to) a **PRD-style document** — a PRD.md, a spec
   with workstreams/screens/requirements — **default to `--demo`** and say so;
   otherwise ask which artifact. The rest of `$ARGUMENTS` is the input (a brief
   file path, pasted text, a topic, or a participants list).
2. **Read the host CLAUDE.md** (project root + app-level) for copy/colour rules.
3. **Resolve the Sketches theme.** Match the project to an existing theme
   (founder-x = `founders-align`) or register a new one from the project's
   palette with `render.py theme`. The theme's `{HERO}` becomes the page accent.
4. **Ensure the `rnd/` surface.** Find where static pages live (`public/rnd/`,
   `rnd/`, `docs/rnd/` — prefer an existing web-served dir; else create `rnd/`
   at project root). If `rnd/index.html` is missing, create it from
   `templates/rnd-index.html`. If present, **append** the new entry to its
   `ENTRIES` array (href, title, summary, status, updated).
5. **Build the artifact** — follow the mode reference:
   - `--consensus` → `references/consensus.md`: brief → participants + pages +
     source docs → **confirm the extracted structure with the user** → Convex
     `rnd_spec` module (reuse if the host already has one; else scaffold from
     `templates/convex/`) → identity gate → votable spec page.
   - `--product` → `references/product.md`: decisions → SCREENS → hash-routed
     deck. Reuses a sibling consensus page's ids + sketches when one exists.
   - `--demo` → `references/demo.md`: PRD streams/screens → **one page per
     theme** at `rnd/<theme>/demo/` with a side menu, per-scene PRD detail
     panels, and arrows that cross theme pages. Built theme by theme.
   Data models for all three live in `references/anatomy.md`. Page skeletons
   live in `templates/` — copy one, replace the `DATA` block and tokens.
6. **Draw.** For each page/screen/scene: `render.py find "<concept words>"`,
   reuse on a genuine match, draw + `add` on a miss (house style: one ink line,
   exactly one `{HERO}` element, 5 tokens, no container).
7. **Verify** against `references/checklist.md`, then report the file paths /
   URLs, the Convex functions pushed (consensus), and the index entry added.

## Mode summary

| Flag | Artifact | Core ingredients |
|------|----------|------------------|
| `--consensus` | Votable living spec | Participant intro gate (`?as=` + localStorage) · per-page current/planned panels · participant quotes · technical notes · source-doc viewer · vote/comment **shared via Convex** |
| `--product` | Screen-by-screen build deck | Hash-routed slides (`#<screenId>`) · contents rail · intent/context/build/technical-call per screen · interactive form mock slot |
| `--demo` | Per-theme demo pages | One page per theme (`rnd/<theme>/demo/`) · left side menu of themes + scenes · keyboard (←/→) steps across pages · rich app-shell scenes · collapsed "From the PRD" detail bullets per scene · per-scene deep links |

Chained use is the normal lifecycle: consensus first (team agrees), product
next (build premise per screen), demo last (takes it into reality). Each later
mode links back to the earlier ones.
