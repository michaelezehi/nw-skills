# Imagery: look it up, then draw it

A deck of type on paper is a document. What makes it read as a deck is one
drawing per slide, in one hand, in the project's own colours. This is how to get
that without commissioning a new illustration style per deck.

The rule is lookup first. A deck that needs a picture of a doorway should find
the doorway that already exists, not commission a second one in a slightly
different hand. A library stops reading as one hand the moment two frames
answer the same idea.

## The library

    _r&d/decks/_art/line/<id>.webp            ink linework, accent      light surfaces
    _r&d/decks/_art/line/<id>-on-dark.webp    cream linework            dark surfaces
    _r&d/decks/_art/line/<id>-on-ember.webp   warm cream, amber accent  the warm ground
    _r&d/decks/_art/line/<id>-<tint>.webp     a whole frame in one colour, when set
    _r&d/decks/_art/line/.raw/<id>.png        the original draw, kept

Every file is a real cut-out: the ground is transparency, not a black rectangle,
so a frame sits on paper, on a dark slide, on a photograph or on a video still
with no CSS at the call site and no box around it. Margins are trimmed to the
ink, so the width you set is the width of the drawing.

    _r&d/scripts/gen-deck-art.mjs        the pipeline
    _r&d/scripts/deck-art-frames.mjs     the subjects and the palette
    _r&d/decks/_art/README.md            what each frame shows and where it is used

## Step 1: what already exists

    node '_r&d/scripts/gen-deck-art.mjs' --list

Prints every frame with its shape and the first line of its subject. Match the
slide's idea against that list before anything else. Landscape frames crop badly
into a tall slot and portrait ones into a wide slot, so the shape is part of the
match, not an afterthought.

**Match on meaning, not on shape.** Ask what the slide is actually saying, then
ask whether a frame holds that. A slide about a threshold takes the doorway. A
slide about a decision does not, however doorway-shaped its layout is. Reuse is
there so a project does not end up with five near-identical doorways, not so
every idea is bent to fit thirty subjects drawn for someone else's deck. When
nothing in the list means what the slide means, that is a gap, and the next
section is one command long.

## Step 2: draw what is missing

    node '_r&d/scripts/add-frame.mjs' <id> "<subject>" --shape=landscape

One command: it appends the frame, draws it, and runs the cut-out check. See
"Adding a frame" below for the flags and the subject lint. By hand it is an
entry in `FRAMES` in `deck-art-frames.mjs`, then:

    node '_r&d/scripts/gen-deck-art.mjs' --only=<id>
    node '_r&d/scripts/check-art-alpha.mjs'

Writing a subject that comes back clean:

- Reuse the `FIGURE` constant for any person. That single sentence is why the
  whole set reads as one hand.
- Set `clean: true` for anything that will sit large on a slide. Dimension
  arrows are where the model invents lettering, because every engineering
  drawing it has ever seen carries figures on its leader lines. At thumbnail
  size that reads as texture. Half a slide wide it reads as broken text.
- Never write "on a surface", "on a desk" or "on a plain background". The model
  fills the frame with that surface, and a light ground inverts the matte and
  ships the drawing as a grey box. Write "floating in empty space with nothing
  behind them, surrounded by empty black".
- A subject that cues a *measured* object (a cabinet, a plate with a grid) comes
  back with numerals attached. Describe the same idea as a plain form: a tray of
  index cards, a stack of plain trays.
- A weak draw is fixed by raising `--seed` and redrawing that one frame. It is
  never fixed by rewriting the style.

## Step 3: colour, and when colour carries meaning

Nothing ships in the colours the model draws. Luminance becomes the alpha
channel, saturation separates the accent from the linework, and every pixel is
repainted from `PAINT`. That is what lets one generated frame serve a light
slide and a dark one, and it is why a palette change costs no API calls:

    node '_r&d/scripts/gen-deck-art.mjs' --repaint

When the colour is carrying meaning rather than decoration (three regions, three
tiers, three segments side by side on one ground), give those frames a `tint`.
Each writes one extra file in a colour of its own. Three copies of the same ink
sitting side by side read as one picture cut in three; the colour is what
separates them, which also means no coloured rule has to do it.

## Step 4: place it, and prove it

- Art lives in a grid cell with `min-height:0` and `object-fit:contain`, so a
  drawing can only ever shrink to fit. Absolute positioning is what puts a
  drawing off the edge of a page, and it never shows up in the source.
- `1fr` is `minmax(auto,1fr)`, so content can push a grid row past its
  container. Use `minmax(0,1fr)` on any row holding art or long text.
- Copy the frames the deck uses into `<deck>/art/` so the folder is portable,
  then prove nothing is missing and nothing is clipped:

      node '_r&d/scripts/check-deck-assets.mjs' deck.html
      node '_r&d/scripts/check-deck-safearea.mjs' <deck>.pdf --band 24

  The safe-area check rasterises the finished PDF, because clipping is the one
  deck fault that never appears in the HTML.

## Putting this in another project

Two ways, and both are fine.

**Inherit the drawings** (default, costs nothing):

    node ~/.claude/skills/deck/scripts/install-art.mjs
    # edit _r&d/decks/_art/palette.json to this project's ink and accent
    node '_r&d/scripts/gen-deck-art.mjs' --repaint
    node '_r&d/scripts/check-art-alpha.mjs'

**Draw its own** (costs thirty calls, gives a library nobody else has):

    node ~/.claude/skills/deck/scripts/install-art.mjs --fresh
    # edit palette.json, and edit FRAMES if the subjects should be its own
    node '_r&d/scripts/gen-deck-art.mjs'

Either way the project gets the pipeline, `add-frame.mjs`, and the thirteen deck
checkers. It writes a `palette.json` it will never overwrite on a second run,
because that file is the one thing here a person actually wrote.

**Why the default is free.** Every frame was drawn once, white linework and one
orange-red accent on black, and the original is kept in `line/.raw/`. Nothing
ships in those colours: luminance becomes the alpha channel, saturation
separates the accent from the linework, and every pixel is repainted. So a
project's colours are a repaint of the same drawing, not a redraw of a similar
one, which is the only way two projects genuinely read as one hand. It also
means changing a brand colour later is a repaint, never a regeneration.

The palette is merged over the built-in one a mode at a time, so a project only
names what differs. `--list` reports which palette is in force, which is the
fastest way to catch a `palette.json` being ignored because it is in the wrong
folder. Keys are the project's own, and a mode named in a frame's `tint` has to
exist in it.

Both art scripts default to `_r&d/decks/_art`. A project that keeps its library
somewhere else passes `--art=<dir>` or sets `DECK_ART_DIR` once.

## Adding a frame

The library is a starting point, not a house rule. Thirty subjects drawn for
someone else's decks will not hold every idea, and a drawing that means
something other than its slide is worse than no drawing at all.

    node '_r&d/scripts/add-frame.mjs' <id> "<subject>"
    node '_r&d/scripts/add-frame.mjs' circle "twelve chairs in a ring, {figure} seated on four" --tint=uk

It appends the frame, draws it, and runs the cut-out check. `{figure}` becomes
the house figure. `--shape=` picks square, landscape or portrait; `--busy` keeps
the dimension arrows; `--no-draw` registers without spending a call.

**Writing a subject that works.** Say the shapes and where they sit, never what
they mean. "Six plain outlined flat slabs in a row, set further apart as they go
right" draws; "the stages of recovery" does not. Keep `clean: true` for anything
that will sit large, since dimension arrows are where the pseudo-lettering
comes from. Reuse `{figure}` for every person.

The script lints for three traps before it spends anything, each of which cost a
redraw of a whole batch when it was found the hard way:

| In a subject | What ships |
|---|---|
| "on a surface", "on a desk" | the model fills the frame with a light ground, the matte inverts, and the frame is a solid rectangle |
| "ruled ground plane", "gridded floor" | pseudo-numerals along leader lines, even with `clean: true` |
| "drawn in orange-red" | a soft filled glow with no edge to key, which repaints as a smear. Say "outlined in orange-red" |

**A bad frame is a subject problem, not a seed problem.** Two failed draws means
rewrite the subject. A third identical retry with a new seed is the thing that
never works, and it is how a batch turns into an afternoon.

A frame that earns its place belongs back in `~/.claude/skills/deck/art/`, so
the next project inherits it instead of drawing its own near-copy. That is what
keeps one hand across projects while still letting each one draw what it needs.

Drawing costs money; repainting does not. Backends are fal.ai `flux/dev` by
default and OpenRouter as `--backend=openrouter`; keys are read from the
environment, then `.env` and `.env.local` at the repo root. Never write a key
back to disk.

**`sharp` is the one dependency.** The repaint is all it needs. A project
without it gets a module-not-found on the first run and nothing else is wrong.

## The two failures worth knowing before you hit them

1. **A frame ships as a solid rectangle.** The model returned the drawing on
   white, so the luminance matte keyed out the linework and kept the ground.
   The script samples the four corners and inverts the matte, but a frame whose
   corners are dark and whose middle is light will still slip through.
   `check-art-alpha.mjs` is the backstop: it fails any frame whose corners are
   opaque or which is less than a third transparent. Run it every time.
2. **An accent line ships at 40 percent opacity.** The accent sits far darker
   than white, so a luminance-only matte under-keys it and it reads as a smudge.
   Saturation carries its own alpha term and the two are combined with `max`.
   This is already handled; do not "simplify" the matte back to luminance.
