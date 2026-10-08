# Stage gates

Tick these as you go. A gate that fails sends you back a stage.

## 1 · Understand
- [ ] Product named: ATS or HR (never both in one look)
- [ ] Audience and the one belief the viewer should leave with
- [ ] The real app has been looked at, not just the marketing copy
- [ ] Durations and aspect ratios fixed

## 2 · Direction
- [ ] One sentence of creative intent, written down
- [ ] A styleframe still that proves the look
- [ ] Styleframe checked against `brand.md` — right palette, radius, type, grain

## 3 · Shot map
- [ ] Table exists: `# | time | shot card | copy | asset`
- [ ] Every row names a real `video-shotcraft` card
- [ ] Every row names a real asset that exists or is scheduled for capture
- [ ] Shot sizes vary — not all mediums
- [ ] Total duration matches the target within a second
- [ ] There is at least one shot that is about a person, not a feature

## 4 · Capture
- [ ] Storyboard locked *before* recording started
- [ ] Recordings show real, populated, non-embarrassing data
- [ ] No customer PII, no real salaries, no live credentials on screen
- [ ] Assets in the library, not in git

## 5 · Shots
- [ ] `node scripts/scan-stability.mjs && node scripts/pick-inpoints.mjs` run, and
      every product shot's `startFrom` / `rate` came from it — never from a guess
- [ ] Any capture reported as having **no safe window** was re-recorded or its
      beat shortened; it was not shipped by nudging the rate up
- [ ] Product shots address footage as `capture="name.mp4"`, not `src="rec3/…"`,
      so the other language picks up its own recording when it is shot
- [ ] Each shot ends with a `remotion still` that was actually looked at
- [ ] House primitives used where they fit, rather than reinvented
- [ ] Nothing is locked-off static
- [ ] Grain and vignette present

### Why in-points are measured, not chosen

A screen recording is not uniformly usable. Between the stretches where someone
is reading, scrolling or typing sit the route changes — the whole viewport
repaints in a single frame. Played at 1x you read that as navigation. Played at
the 2.0–2.6x a tour uses to cover its narration, it is a white flash, and a
scene that crosses four of them flickers.

This is in the footage, so no render setting fixes it. `--gl`, concurrency and
codec changes are all dead ends; the in-point has to move. `scan-stability`
measures the frame-to-frame image difference (`tblend=difference` → mean luma)
and `pick-inpoints` finds a window long enough for the scene with no repaint
inside it, trying rates high to low.

Expect the honest rates to be **lower than feels right** — 0.7–2.4x, not a flat
2.4x. A shot that has to race to cover its line is the wrong length, not the
wrong speed.

## 6 · Sound
- [ ] VO on the advisor voice, `eleven_v3`
- [ ] Music prompt names no real brand
- [ ] Score ducks under VO
- [ ] Ending resolves clean, no fade-out under the logo
- [ ] SFX on the major transitions, not on every move

## 7 · QA
- [ ] Contact sheet generated and read
- [ ] No clipped or overflowing text
- [ ] No low-contrast copy
- [ ] No empty or half-built frames
- [ ] Logo consistent every appearance
- [ ] No dead air
- [ ] Vertical cuts: nothing important in the bottom 20% or under the top overlay
- [ ] Vertical cuts: type legible at phone size
- [ ] Watched start to finish, with sound, at full size

## 8 · Deliver
- [ ] Every format rendered
- [ ] `films.json` and `src/Root.tsx` agree
- [ ] Output split by language — `out/English/`, `out/Arabic/`, same base name
- [ ] The delivery folder actually contains the current films. A stale file in
      the hand-over folder is indistinguishable, to the person watching, from a
      bug you did not fix
- [ ] README lists what each file is
- [ ] Committed — source in the repo, media in the library
