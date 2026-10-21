---
name: walkthrough
description: Add a guided walkthrough to any web app, one story per user role plus feature stories for the standout pages, gated by role and by the company's own setup, with the house design. A story bar (play, pause, previous and next step, start over, arrow keys, a picker when the viewer has several stories), a focus light that dims the page round the one control a step is about and clicks the tab it names, a journey reader that moves clear of whatever the step is about (its usual side, the other side, or a panel along the bottom) with the picture, what happened, why it matters, the journey in icons, a 30 second pausable countdown, and "Show me how to get there", which rings the real menu item and clicks it, split prompt cards that stand in for emails, a loader so a switch never shows a blank page, and a spoken narrator for every step that the viewer can mute (pre-generated clips, sound on by default, M key). --director adds a server-held demo run that writes demo data, switches persona and steps back by undo and replay. On an app that already has a walkthrough, adds the narration to it. Use when the user asks for a walkthrough, product tour, onboarding tour, guided demo, "show users how to use the app", or wants audio, narration or a voice added to an existing tour.
argument-hint: [--roles a,b] [--director] [--theme host|fa] [--no-narration] [--narrate] [--audit]
---

# walkthrough: a guided tour of the app, one story per role

Ported from a working build: a three-role SaaS sandbox (founder, coach and
investor). Its reader, bar, cards, nav guide and run engine shipped and were
checked in the browser by the owner. The templates are generic copies of
those files and pass their ported tests (`templates/react/walkthrough/__tests__`).
A second host (an HR and an ATS app, English and Arabic voice, 11 text
locales) added the focus light, reader placement, opener close, story
picker, feature stories and company gating; its bugs are pitfalls 26 to 39.

Arguments: `$ARGUMENTS`

| Flag | Effect |
|---|---|
| none | User walkthrough: stories per role, progress per viewer in the browser, no data writes |
| `--roles a,b` | Build only these roles' stories |
| `--director` | Add the demo tier: a server-held run, demo data writes with undo, persona switching, prompts in place of emails. Needs a sandbox or demo data layer, a persona model and an allowlist; if the host has none, stop and say so |
| `--theme host` | Default. Map the `--wt-*` tokens onto the host theme |
| `--theme fa` | Keep the warm cream house palette as is |
| `--no-narration` | Skip the spoken narrator (no clips, no Sound switch). Narration is part of every install otherwise |
| `--narrate` | Add narration only, to a walkthrough already in the host. Also chosen automatically when step 1 finds an install |
| `--audit` | Review an existing walkthrough against `references/pitfalls.md` and the design spec; report, then fix on a yes |

**Already installed?** Step 1 looks for `walkthrough-store.ts`,
`useWalkthroughLoop.ts` or `ExplainReader.tsx` (or a tour of the host's own).
When it finds one and the walkthrough has no narration, the run is the
narration upgrade: follow `references/narration.md` "Adding narration to an
existing walkthrough" and skip steps 2 to 5 below.

## Hard rules

1. **One story per role, never mixed.** Progress reads "Founder story · Step
   3 of 9". No "beat", "act", "scene", and no count across stories.
2. **The design is fixed; the palette is not.** Same layout, shapes, type
   scale, z ladder and motion as `references/design.md`. Colours come only
   from the `--wt-*` tokens in `walkthrough.css`. No gradients, no accent
   strips on card edges, no purple dominance, no black primary pills.
3. **Never a blank page.** Every screen switch runs under `withSwitch` so the
   loader shows, and the reader's countdown holds until the switch lands.
4. **Real routes, real menus.** Every step route is a page (checked by
   `scripts/check-routes.mjs`). "Show me how" rings only links in the app
   chrome; a role home never stands in for a deeper page; screens with no
   menu item go in `REACHED_THROUGH` or show no button.
5. **One owner moves the run.** The reader and the arrow keys raise
   `stepRequest`; only the loop calls the driver. Every move carries the
   index the caller saw.
6. **Art at fixed pixel sizes** (128 reader, 92 card, 96 loader) inside
   clipped boxes, through the one adapter `walkthrough-art.tsx`.
7. **Unslop every string.** No em or en dashes, sentence case, no "AI", the
   host's own terms. All UI copy in `walkthrough-copy.ts`; step copy in the
   story data.
8. **Read `references/pitfalls.md` before writing code.** Each row is a bug
   the reference build shipped once.
9. **The user verifies in the browser, not you.** Run typecheck, tests, lint
   and the route check. Never start a dev server or drive a browser.
10. **Shared repos:** edit only the paths this task owns; commit by path as
    each unit passes; never `git add -A`, stash, reset or restore.
11. **Never cover what the step is about.** Each step names its one control
    in `focus`; the focus light shows it, and the reader moves to the other
    side or the bottom rather than sit on it (`reader-placement.ts`).
12. **Light, never click, except tabs.** A step clicks only a tab it names.
    Anything that runs, creates, sends or opens a pop-up is lit only. A
    pop-up a step does open (a query param in `OPENER_PARAMS`) closes when
    the story moves on or the tour ends.
13. **Gate on the setup, not the viewer.** Country content shows only when
    the company's own region says so; a step a module or plan hides drops
    out; a story under 3 steps is not offered.
14. **Narration never says a name and never blocks the story.** Clips are
    made ahead of time from `step.narration`; any missing, failed, stalled or
    muted clip falls back to the silent timing. Rules in
    `references/narration.md`.

## Steps

### 0. Size and ledger

An install is **L** (a new subsystem across the layout, the menus and the
data). Copy `templates/gates.md` to `gates/walkthrough.md`, fill the paths,
and flip boxes only with `node ~/.claude/skills/unlazy/scripts/gate-check.mjs`.
Add `--director` gates (allowlist, acting-as tests, restart restores every
table) when that tier is in scope.

### 1. Investigate

Follow `references/method.md` §1 and write `INVESTIGATION.md`, citing a
path for every row: the roles, role homes, menu chrome, screens without a
menu item, the state, motion, icon and illustration libraries, theme tokens,
header height, any existing loader, and the viewer id. For `--director`,
also the sandbox or demo layer, the persona model and how auth resolves the
caller.

### 2. Write the stories, then get a yes

Per `references/method.md` §2 and §3: 5 to 9 steps per role, each with a
title, a real route, what happened, why it matters, art, a hold, a `focus`
naming the one control it is about (a tab it clicks, or a control it only
lights), and a prompt where the real product would send a message. Then map
the feature stories (§3 "Feature stories"), with who gets each and what it
needs. Show the owner the step titles per story as a short list and wait for
approval before building. Titles are the cheapest thing to change.

Unless `--no-narration`, each step also gets `narration {lead, detail}`
(`references/narration.md` "Writing the narration"). Write it after the titles
are approved, and show one lead and one detail per story before generating.

### 3. Install the client

Copy `templates/react/walkthrough/` into the host (for example
`src/components/walkthrough/`) and `walkthrough.css` into the global styles.

- Imports: adjust to the host's aliases. Swap `@phosphor-icons/react`,
  `framer-motion` or Zustand only if the host lacks them (say so).
- Tokens: set every `--wt-*` value from the host theme (`--theme host`), and
  `--wt-header-h` to the header's real height. Dark mode overrides the same
  names.
- Art: wire the host's illustration set into `walkthrough-art.tsx`, list
  its slugs, keep the fixed sizes. No set: generate a small one with the
  image skill in the host's style, max three images per round without asking.
- Nav guide: fill `REACHED_THROUGH` from the investigation.
- Not Tailwind: convert the class strings to the host's styling, keeping
  every value.
- Narration (unless `--no-narration`): `narration-player.ts` and
  `useNarration.ts` come with the folder. Copy `templates/audio/` to
  `scripts/walkthrough/`, set `NARRATION_BASE` if static files are not served
  from `/audio/walkthrough`, ask for `ELEVENLABS_API_KEY` with a `[!SECRET]`
  callout, dry-run, generate, and commit the clips and `manifest.json`. Copy
  `narration-drift.test.ts` next to the walkthrough tests.

### 4. Wire it in

- Mount `<Walkthrough stories={...} viewerId={user.id} />` once in the
  signed-in layout, passing only the stories this viewer's role may take.
- Add a "Take the tour" item to the profile or help menu calling
  `startTour(roleStoryKey)`. Optional first-login start, once per viewer.
- Close or lift any host modal that would sit above z 120.

### 5. Director tier (`--director` only)

Follow `references/architecture.md` "Director tier":

1. **Allowlist:** `WALKTHROUGH_DIRECTOR_EMAILS` on the server, checked
   against the real user on every call.
2. **Acting-as:** in the auth resolver, return the persona only when every
   check passes, else the real user; cover it with tests BEFORE any UI.
3. **Tables and run module:** `templates/convex/` (`schema.ts`, `_story.ts`,
   `_ledger.ts`, `walkthrough_run.ts`). Port to the host backend if it is
   not Convex, keeping every rule in the comments.
4. **Effects:** effects write only through `recordingCtx`. The scheduler is
   swallowed and there are no emails.
5. **Client:** `templates/react/director/useConvexDriver.ts` feeds the same
   `useWalkthroughLoop`, with the persona switch passed as `show`.
6. **Tests:** restart restores every table with ids stripped, and every id
   resolves. A step back matches a run played straight to that step. Two tabs
   never double-step. A non-director can't act as anyone.

### 6. Check and report

- Typecheck, lint, and the walkthrough tests (ported from
  `templates/react/walkthrough/__tests__`; extend them for host-specific
  changes).
- `node ~/.claude/skills/walkthrough/scripts/check-routes.mjs <stories> <app dir>`
  must print `0 missing`.
- Grep the copy for dashes and script words, in every locale.
- Every focus `name` resolves in the catalog (the stories test should check
  it), only tabs carry `click`, and no route carries a full-screen or modal
  param. Every query param a step uses to open a pop-up is in
  `OPENER_PARAMS`.
- Every locale's catalog parses and has the same keys as English (diff the
  composed bundles' leaf keys; a compose can pass while a locale is short).
- Narration: the generator's `--dry-run` prints `0 to generate`, the drift
  test passes, and the report gives each story's spoken length from the
  manifest.
- Gate-check the ledger, then delete it when delivered.
- Report: what was installed where, the stories per role (titles), the
  checks with their real output, and what the owner should click through in
  the browser (a step whose reader should move, a step that opens and then
  closes a pop-up, a story picked from the bar). State plainly what was not verified.

## Files in this skill

| Path | What |
|---|---|
| `references/method.md` | investigating a host, writing stories, timing, entry points, copy |
| `references/design.md` | tokens, type, every piece's anatomy, z ladder, motion, theming |
| `references/architecture.md` | store, loop, drivers, nav guide, keys, focus pass, reader placement, openers, story picker and gating; director tier server design |
| `references/pitfalls.md` | every bug the two builds hit, as rules (1 to 25 the first host, 26 to 39 the second) |
| `references/narration.md` | the spoken narrator: fixed decisions, timing, autoplay, writing, generating, drift gate, upgrading an existing walkthrough |
| `templates/audio/` | the clip generator (ElevenLabs over fetch, hash skip, manifest), the shared clip list, the drift test |
| `templates/react/walkthrough/` | the client: types, store, local driver, loop, keys, nav guide, spotlight, reader, prompt layer, loader, bar, mount, copy, tokens, art adapter, tests |
| `templates/react/director/` | the Convex driver for the director tier |
| `templates/convex/` | director tier tables, story types, write ledger, run module (pattern code) |
| `templates/gates.md` | the unlazy ledger for an install |
| `scripts/check-routes.mjs` | fails when a story route has no App Router page |
