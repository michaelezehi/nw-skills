---
name: promo-film
description: Make a cinematic Unframed film with Remotion — brand promos, product launches, feature announcements, launch trailers, product tours, and social cutdowns. Routes to the right Remotion and shot-design skills, enforces the house brand and the eight-stage pipeline, and covers capture, voice, score, render and QA. Use when asked for a promo, brand film, product video, trailer, teaser, intro, demo video, ad, or a vertical/social cut of one.
---

# promo-film — the house video pipeline

## Writing

Titles, captions, VO, and any on-screen copy must pass
`agent-skills/unslop/SKILL.md`. Em dashes are prohibited. Use a period or a
comma.

One entry point for every Unframed film. It does not replace the Remotion
skills; it decides **which one to read when**, and pins the decisions that make
our films look like ours and not like a template.

## Before anything else

Read `references/brand.md` in this skill. Every film obeys it. A film that
looks good but breaks the brand gets rebuilt, so load it first, not last.

### The house look: colour throughout, mono for the last movement

**Every film, from 2026-08-02.** A film plays in colour from first frame to the
closing reel. Then — and only then — the footage goes black and white with the
brand red left standing, and it stays that way through to the logo. The colour
drains as the tour ends and the mark lands.

Mono over the whole film reads as a mood and spends the close's one change in
the first ten seconds. Held back to the end, it marks the ending.

The treatment is baked into the media by `pnpm grade`
(`scripts/grade-footage.mjs`) and reached through `src/footage.ts`. `PeopleReel`
is the only component that asks for it, because `PeopleReel` exists for the
close and nothing else. Screen recordings have no mono twin and can never be
handed one. New stock footage: drop it in the pool, run `pnpm grade`, done.

Then confirm three things and write them down — they are the contract for
everything that follows:

| | |
|---|---|
| **Product** | ATS (`app.x-unframed.com`) or HR (`hr.x-unframed.com`) — they have *different* visual languages, never blend them |
| **Job** | brand film · launch · feature announcement · product tour · social ad · logo sting |
| **Cut list** | duration(s) and aspect ratio(s), decided up front — a 9:16 is recomposed, never cropped |

## Which skill for which problem

The Remotion skills are installed in this repo at `.claude/skills/`. Read the
one that matches the problem instead of guessing at the API.

| Problem | Read |
|---|---|
| Any Remotion code at all | `remotion-best-practices` (it fans out to the rest) |
| Timing, springs, interpolation, sequencing | `remotion-markup` → `rules/timing.md`, `rules/animations.md` |
| New composition or project scaffold | `remotion-create` |
| Rendering, stills, codecs, Lambda | `remotion-render` |
| Subtitles, burned-in captions, TikTok-style word highlight | `remotion-captions` |
| Reading video/audio duration, extracting frames, decode checks | `mediabunny` |
| Making a film editable in Studio by a non-coder | `remotion-interactivity` |
| An API you cannot remember | `remotion-docs` |
| Upgrading Remotion across the monorepo | `remotion-upgrade` |
| Animated maps, routes, geographic reveals | `remotion-maps` |
| **What shot to use and how to move the camera** | `video-shotcraft` |

### On video-shotcraft

`video-shotcraft` is the shot-design vocabulary: 106 recipe cards, each with
purpose, energy, duration, tuned parameters, pitfalls, and a working Remotion
implementation under `demos/<card>/`. Use it whenever the question is
*"what should this shot actually do?"* rather than *"what is the API?"*.

- Its docs are written in Chinese. Read them anyway — the TSX in `demos/` is
  the real payload and is language-neutral.
- `gallery/llms.txt` is the searchable index of all 106 cards with one-line
  descriptions. **Start there**, then read only the cards you picked.
- Ignore its mode-selection preamble (template / free / guided). Our mode is
  always: pick cards, implement them in `packages/promo-video`, house brand.
- **Never** ship the Ink Press template's paper-ink-amber look. Ink Press is a
  reference for *craft* — pacing, camera, sound design — not for style.
- Heavy media (`gallery/media`, `assets/audio`, `template/`) is not in git.
  Run `scripts/video/fetch-shotcraft-assets.sh` if you need the SFX bank or
  the rendered previews.

Shot cards that consistently earn their place in our films:

- **Openers** — `crane-rise-reveal`, `brand-ink-open`, `crash-zoom-punch`
- **Product** — `spotlight-hero-card`, `graze-face-tour`, `deck-deal-flyin`,
  `command-palette-summon`, `crane-rise-reveal`
- **Data** — `chart-live-moves`, `odometer-digit-roll`, `gauge-readout-moves`
- **Transitions** — `circle-match-iris`, `whip pan` (in `shot-transitions`),
  `color-block-step-wipe`, `line-carry-transition`
- **Type** — `gradient-word-sweep`, `type-assembly-moves`, `split-flap-title`
- **Close** — `ui-to-brand-morph`, `ui-strip-away-outro`

## The pipeline

Eight stages. Cheap judgements come before expensive per-shot work, because a
wrong creative direction discovered at stage 5 throws away every shot built so
far. Do not start writing scene code before stage 3 is settled.

**1 · Understand.** What does this product actually do, who is the film for,
what must the viewer believe at the end. Look at the real app, not the
marketing copy. Positioning notes live in `references/positioning.md`.

**2 · Direction.** One sentence of creative intent, then a styleframe — a
single still that proves the look. Get the styleframe right before anything
moves.

**3 · Shot map + storyboard.** A table: `# | time | shot card | copy | asset`.
Every row names a real `video-shotcraft` card and a real asset. This table is
the build order, and it is where you catch a film that is all product and no
feeling. **Vary shot size** — a promo cut entirely in mediums reads as a demo,
not a film.

**4 · Capture.** Real product beats generated product, always. Screen
recordings and page captures go in the asset library (see `ASSETS.md` in
`packages/promo-video`), never in git. Capture *after* the storyboard is
locked, or you will shoot the wrong screens.

**5 · Build shots.** Implement each row. End every shot with
`npx remotion still <id> out/qa/<shot>.jpeg --frame=N` and actually look at it.

**6 · Sound.** VO, score, SFX, ducking, beat map. See "Voice and score" below
and `video-shotcraft/references/sound-design.md` for the SFX grammar. Silence
is a choice too — a beat of nothing before the logo lands is worth more than
another swell.

**7 · QA.** `pnpm qa <id>` builds a contact sheet. Look at it for clipped text,
low contrast, empty frames, logo drift, dead air, and — on vertical cuts —
anything sitting under a platform overlay.

**8 · Deliver.** Render every format, write the README, hand over the files.

## Build it here

`packages/promo-video` is the durable home for every film. Do not start a new
Remotion project in a scratchpad, because the scratchpad is deleted with the
session directory.

```bash
cd packages/promo-video
node scripts/link-assets.mjs      # symlink recordings + footage from the library
pnpm grade                        # mono pass over any stock clip not graded yet
node scripts/scan-captures.mjs    # which captures exist, per language + lengths
node scripts/scan-stability.mjs   # frame-to-frame delta over every capture
node scripts/pick-inpoints.mjs    # → the startFrom / rate for each shot
pnpm studio                       # preview and scrub
pnpm audio                        # VO + score for anything missing in films.json
node scripts/render.mjs hr3-60    # render (macOS retry dance built in)
pnpm qa hr3-60                    # contact sheet for the vision pass
```

`films.json` is the source of truth for durations, taglines, VO scripts and
music prompts. Add a film there and to `src/Root.tsx` in the same change, or
the render script will refuse the id.

### Two languages, one film

A film is **not** duplicated per language. `buildBeats(lang)` builds one
structure and the two cuts differ only in three things:

| | |
|---|---|
| Words | `src/tour-copy.ts` — one dictionary, `en` and `ar` side by side |
| Voice | cue ids prefixed by `voId(lang, …)` → `tf-open` / `ar-tf-open` |
| Footage | `capture(lang, 'dashboard.mp4')` → `rec3/` or `rec3-ar/` |

So write shots as `capture="dashboard.mp4"`, never `src="rec3/dashboard.mp4"`.
The Arabic cut then picks up an Arabic recording the moment one is dropped into
`public/rec3-ar/` under the same filename, and falls back to the English
capture until then. Re-record one screen, re-run `scan-captures`, re-render
Arabic — English is untouched and does not need re-rendering.

**Pass `lang` to every scene component.** A missing `lang` prop does not fail;
it silently renders Arabic through the English typesetter — left-to-right,
left-aligned, wrong face. It looks fine in a contact sheet if you cannot read
Arabic. Grep for scene components without it before shipping a non-English cut.

Renders land in `out/English/` and `out/Arabic/` under the same base name.

### Flicker is usually the footage, not the renderer

Before touching `--gl`, concurrency or the codec, check whether the flash is in
the capture. Screen recordings contain route changes that repaint the whole
viewport in one frame; a shot playing at 2x+ crosses them as white flashes.
`scan-stability` + `pick-inpoints` locate the calm windows — see
`references/pipeline-checklist.md` §5. Render settings cannot fix this one.

## Voice and score

The platform speaks with one voice everywhere — the ConvAI advisor's. This is
a repo-wide rule, not a promo preference (see the root `CLAUDE.md`).

- **Voice** `Cz0K1kOv9tD8l0b5Qu53`, **model** `eleven_v3` — the only ElevenLabs
  model carrying Bengali *and* Arabic *and* English.
- **Key** `ELEVENLABS_API_KEY`, read from the environment or `apps/hr/.env.local`.
- **Music** via `POST /v1/music` with `music_length_ms`. Prompts that name a
  real brand ("Apple-style", "Hollywood") are **rejected as a ToS violation** —
  describe the sound instead: instrumentation, arc, ending, "no vocals, no
  fade-out, exactly N seconds".
- Score ducks under VO. Land the last chord clean; never fade out under a logo.

## Rendering on macOS

Four failures, already handled in `scripts/render.mjs`. Keep them handled:

1. Remotion's downloaded `chrome-headless-shell` is SIGKILLed by Gatekeeper
   (exit 137 / spawn errno -88). Always pass
   `--browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
2. Renders intermittently die with *"Visited localhost… got no response"*.
   Retry up to 3×, and verify the output file's mtime and size — a piped
   `| tail` swallows the exit code and a failed render looks like a pass.
3. Chromium's fast-path CSS `blur()` on a full-bleed composited layer
   intermittently rasterizes it as a **tiled mosaic or a black frame** — seen
   as flicker at scene transitions, on both the GPU and `--gl=swangle` paths.
   Never put `filter: blur()` on a scene-sized layer; use `BlurLayer` from
   `packages/promo-video/src/shared.tsx` (SVG `feGaussianBlur` reference
   filter — correct pipeline, identical look). Word-level blurs on small
   inline spans are fine.
4. **Parallel Chrome render pages corrupt frames.** At `--concurrency` > 1 the
   GPU raster path nondeterministically emits the same tiled-mosaic/black
   frames — in any scene, worse under machine load, `--gl=swangle` worse
   still. `scripts/render.mjs` pins `--concurrency=1` (hardware GL), which
   renders clean; don't raise it (RENDER_CONCURRENCY) without re-verifying.
   QA every render with blackdetect **plus** a scene-spike scan
   (`select='gt(scene,0.35)'` → visually check each spike frame against its
   neighbours) — blackdetect alone misses mosaics. Don't render two films at
   once on one machine for the same reason.

## Multiple formats

A 9:16 is not a cropped 16:9. Recompose: move the subject to the upper third,
scale type up (a 32px caption is unreadable on a phone), keep the bottom ~20%
clear of platform UI, and re-time — social cuts want the hook in the first
second. Give each ratio its own composition in `Root.tsx`.

## Reference

- `references/brand.md` — tokens, type, motion rules for ATS and HR
- `references/positioning.md` — what these films argue and against whom
- `references/pipeline-checklist.md` — the stage gates as a tick list
