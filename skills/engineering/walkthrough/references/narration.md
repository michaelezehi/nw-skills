# Narration: the spoken walkthrough

A narrator speaks every step. A short **lead** line plays as the step starts,
covering the switch to the next screen or persona. A longer **detail** clip
plays while the reader is open and expands on what happened and why it
matters. The viewer mutes it from the bar, the reader or the `M` key.

Ported from a working build (21 steps, 42 clips across three role stories),
which shipped with a reviewer pass and a fresh-eyes check against its PRD.

## Decisions that are fixed

| Decision | Why |
|---|---|
| Clips are made ahead of time, never generated live | no key in the running app, no first-play delay, no per-play cost |
| Narration never says a viewer's or persona's name ("your manager", "the coach") | one clip serves every viewer, which is what makes pre-generation work |
| Narration lives on the step (`step.narration {lead, detail}`), next to `explain` | the screen and the voice share one source; a step with none is silent |
| Sound is on by default, saved in localStorage `wt-sound` | the choice survives a new tab; kept apart from any other audio setting in the host |
| One shared audio element for the whole app | two clips can never overlap, and the unlock click blesses the element that plays later |
| With sound on, the clip sets the pace | the reader closes 1.5s after the detail clip ends; with Explain off the hold is `holdMs`, then the rest of the lead |
| With sound off, or any clip missing or failing, timing is exactly the silent walkthrough's | narration is an addition that can always fall away |

## Timing rules

- Reader, sound on, clip under way: wait for `detail` to end, then
  `DETAIL_GRACE_MS` (1500). Never longer than `CLIP_CEILING_MS` (60000): a
  stalled download fires neither `ended` nor `error`.
- Explain off: wait `holdMs`, then until the lead is over, capped at
  `LEAD_CEILING_MS` (30000).
- The reader's 30s countdown keeps running under a clip, so a clip that
  fails mid-way falls back to the silent timing at once.
- Pausing the story, the reader or "Show me how" pauses the clip. With a clip
  under way, a paused story also holds the reader's countdown.
- Back, Next, arrow keys, Start over, a story switch and mute cut the clip at
  once. Play only unlocks: it never cuts a clip a pause is holding. Folding
  the bar does not stop it either.
- A bar that unmounts (a persona switch remounting the layout) stops the clip
  only after `UNMOUNT_GRACE_MS` (3000), so a switch never cuts its own lead.
- The first run seen after a page load is recorded, not narrated: a reload
  mid-story does not replay the step already on screen.

## Autoplay

Browsers block audio until a user gesture. `unlock()` plays a few ms of
silence on the shared element inside the click. Call it from Play, Back,
Next, Start over, turning sound on, and every handled key. Before any
gesture, `play()` rejects; the clip counts as failed and the timing falls
back. iOS Safari needs both `playsInline` and the `playsinline` attribute.

## Writing the narration

- `lead`: one or two sentences, under about 220 characters, said while the
  screen switches. Sets up what is coming ("Now we look at this from the
  coach's side."). Never the title read aloud.
- `detail`: three to six sentences, said while the reader is open. Expands on
  `explain.what` and `explain.why`: what just happened, why it matters, what
  to notice on screen. Never the card read aloud word for word.
- No names, no `{placeholders}`, no dashes, no "AI", no puffery, the host's
  own product terms. Short sentences that read well aloud. Run unslop.
- Measure after generating: sum each story's `durationMs` from the manifest.
  Trim the detail copy of a story that runs long; do not cap clips in code.

## Generating the clips

`templates/audio/generate-narration.ts`, run with `npx tsx`:

```bash
npx tsx scripts/walkthrough/generate-narration.ts \
  --stories src/walkthrough/stories.ts --out public/audio/walkthrough [--dry-run] [--full] [--story <key>]
```

- Env: `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`, read from the shell or
  `.env.local`. Ask for the key with a `[!SECRET]` callout; never in chat.
  Optional `ELEVENLABS_TTS_MODEL` (default `eleven_turbo_v2_5`). If the host
  already has a narrator voice (questionnaires, a voice agent), reuse its
  voice id so the app has one voice.
- Output: `<out>/<story>/<stepId>/{lead,detail}.mp3` and `<out>/manifest.json`
  with a text hash per clip. A clip is skipped when its hash matches and the
  file exists. Commit the clips and the manifest.
- Always `--dry-run` first and show the owner the count and the cost
  estimate before a real run.
- The served URL is `${NARRATION_BASE}/<story>/<stepId>/<part>.mp3`
  (`NARRATION_BASE` in `useNarration.ts`, default `/audio/walkthrough`). If the
  host serves static files from a CDN, set it there; keep the layout.

## More than one language

- Text goes into every locale the host ships; voice only into the locales
  the owner asks for (in the reference host, English and Arabic). A locale
  with no clips plays the silent timing.
- Clips live under a locale folder (`<out>/<locale>/<story>/<stepId>/...`)
  and the manifest keys carry the locale. Run one locale at a time per app
  (`--locale`), never two runs on one manifest at once.
- Translate the step copy before generating that locale, then check it: no
  dashes, no doubled braces, every narration line in the target script, and
  every fragment parses as JSON. Translators turn curly quotes into bare
  `"` inside values; escape them before composing.
- Finish every translation write before composing the catalogs. A batch
  started with `&` can still be writing after the shell says done.
- End with a `--dry-run` over all locales: `0 to generate`.

## The drift gate

Copy `templates/audio/narration-drift.test.ts` next to the host's tests and
fix its two `HOST:` lines (the stories import and the `--out` folder). It
fails when a narrated step lacks a clip, when the manifest hash differs from
the current text (a copy edit without regenerating), or when the manifest
lists a step that is gone. It is the only thing that stops the voice saying
something the screen no longer does.

## Adding narration to an existing walkthrough

1. Find the install (`walkthrough-store.ts`, `useWalkthroughLoop.ts`,
   `ExplainReader.tsx`). Diff each against `templates/react/walkthrough/` and
   note host changes to keep.
2. Copy in `narration-player.ts` and `useNarration.ts`; port the narration
   hunks into the host's store, reader, loop, bar, keys, copy and step type.
   Never overwrite a host file wholesale.
3. Write `narration` for every step, then get a yes on a sample (one lead and
   one detail per story) before generating.
4. Generate, commit the clips, add the drift test, run the host's checks.
5. A host with a bespoke tour that did not come from these templates: map
   the same events (step change, reader open and close, pause, step request,
   story switch, restart) onto its own state and follow the timing rules
   above. Say in the report what could not be mapped.
