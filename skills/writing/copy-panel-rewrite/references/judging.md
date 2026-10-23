# How a panel judges a packet

You sit as one panel of three. The other two panels work separately and you
will never see their verdicts. The owner has asked the panels to decide the
wording of the product's questions and screens, so that people understand it
at once and want to start, keep going and finish.

## What you have

- Your panel's BRIEF.md: your three seats, your research findings and your rubric. Judge by it.
- HOUSE-RULES.md: fixed rules any text you pick or write must obey.
- A packet: a JSON array of items. Each item has `pid`, `surface` (question,
  answer option, intro, recap, screen text, name, decision), `context`,
  sometimes `mustKeep` (keywords a scored option must still contain), and
  `versions` labelled A, B and so on. The labels are random. Nothing tells you
  which version is older, newer, or who wrote it, and nothing should.

## What you do for every item

1. Each of your three seats reads every version as their persona and scores it on the rubric.
2. The panel agrees one verdict by majority of seats:
   - `"A"`, `"B"`, and so on: that version is best as it stands.
   - `"WRITE"`: every version fails a rubric gate or a house rule, and you can
     write one clearly better. Put it in `text`. It must obey HOUSE-RULES.md,
     keep the meaning of the item, keep any `mustKeep` keyword, and for an
     answer option stay the same kind of answer. Write only when it is clearly
     better; do not write to polish.
3. Give a `reason` of at most 20 words that names the deciding criterion.

Answer options belong to a set. When judging one, picture it next to the
question in `context` and keep it distinct from the other answers a person
could pick. A dash in a version is a house-rule break, but punctuation alone is
a reason to WRITE a fixed copy only when that version would otherwise win.

Write only the string itself in `text`: no quotes around it, no code, no
labels.

## Output

Write `verdicts-<same suffix as the packet>.json` in your panel folder, for
example `P1/packet-q-2.json` gives `P1/verdicts-q-2.json`. It is a JSON array
with one entry per packet item, in the same order:

```json
{ "pid": "q0002", "choice": "B", "reason": "Concrete and short; A's 'becomes distant' is abstract.", "seats": { "seat1": "B", "seat2": "B", "seat3": "A" } }
{ "pid": "q0040", "choice": "WRITE", "text": "...", "reason": "...", "seats": { "seat1": "WRITE", "seat2": "A", "seat3": "WRITE" } }
```

Every pid in the packet must appear exactly once. Validate the file with
`node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"` before you finish.

## Round 2

A `round2-packet.json` lists items the three panels split on. Each item's
versions are the candidates the panels picked or wrote, relabelled at random.
Rank all of them best first and write `round2-verdicts.json`:
`[{ "pid": "...", "ranking": ["B", "A", "C"], "reason": "..." }]`.

## Independence

Read only your BRIEF.md, HOUSE-RULES.md, this file and your packet. Do not
open other panels' folders, `../proposals`, `../key`, any style guide, the git
history, or the source code. Do not search the repo for the strings. Your
verdict must come from your panel's research and judgement alone.
