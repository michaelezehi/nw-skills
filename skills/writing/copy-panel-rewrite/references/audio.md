# Narration audio (optional step)

Only when the product reads strings aloud from pre-generated clips. The skill
builds and tests the pipeline and a preview command. It never runs paid
generation: the owner listens to the previews first and runs the batch.

## Find out first

- Where clips are generated (script, vendor, voice id source) and where they
  are served from.
- How the player picks a clip. If the key is a position (`q12`) rather than a
  stable item slug, a new questionnaire version silently plays the old
  version's clips. Key clips on the item slug; fall back to position only
  when there is no slug.
- Whether a manifest records what text each clip was made from. If not, add
  one (sha256 of the spoken text), so a rerun regenerates only what changed
  and a drift test can fail when copy changes without new audio.

## What to say aloud

Narrate what the person sees, in the same words. Intros are the heading, a
pause, then the body; never the body alone. Ask the owner in Step 0 whether
answer options are narrated (usually not: question only).

A `speakableText()` pass before sending text to the vendor:

- Dashes become commas; slashes become "or"; "e.g." becomes "for example";
  "&" between words becomes "and"; parentheses are folded into the sentence.
- Quote marks wrapping a whole option are dropped.
- Paragraph breaks stay, for pacing.
- Pauses as SSML breaks where the vendor supports them (ElevenLabs:
  `<break time="0.4s"/>` before a colon that introduces options,
  `<break time="0.8s"/>` between a heading and its body). Do not fake pauses
  with an ellipsis.

## ElevenLabs settings that made it sound human

- Model `eleven_multilingual_v2` for batch narration (steadier than turbo or
  flash, which suit live conversation). One constant, overridable by env.
- `previous_text` and `next_text`: the neighbouring item in the same part, so
  delivery runs on instead of starting cold every clip.
- A fixed `seed`, so a rerun of unchanged text sounds the same.
- `apply_text_normalization: "on"`.
- Named presets in one place, chosen by env var, with a default:

| Preset | speed | stability | style |
|---|---|---|---|
| current | whatever ships today | | |
| calm | 0.92 | 0.50 | 0.25 |
| warm | 0.95 | 0.40 | 0.35 |
| steady | 0.96 | 0.45 | 0.30 |

`similarity_boost` 0.78 and speaker boost on for all. The voice panel (P3)
gets a `preset` call in its packet and the winner becomes the default. Its
research should cite the vendor's settings guidance and the evidence on
synthetic speech rate.

## Preview command

A script that renders 3 sample texts (one question, one intro, one recap)
in every preset into a scratch folder, so the owner can listen side by side.
Cost: a dozen short clips. Even this is the owner's to run.

## Tests

- `speakableText` unit tests for each rule above.
- Request-body test: model, seed, normalisation, preset values, neighbours.
- Drift test: every narrated item has a manifest entry whose hash matches its
  current spoken text (skip cleanly until the first generation exists).

## Report tab: Audio (not run)

The preset chosen and the votes, what changed in the pipeline, the preview
command, then the generation commands in order with the dry-run flag first
and the cost estimate the dry run prints.
