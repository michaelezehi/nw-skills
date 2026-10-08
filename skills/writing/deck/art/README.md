# Renovyn line art

The house drawing style for decks, briefs and marketing pages. One technical
blueprint look: thin outlined linework, exploded isometric construction,
dimension arrows and dashed centre lines, with a single sage accent marking
the one thing the frame is about. No lettering, so nothing needs translating.

## Two files per frame

    line/<id>.webp          ink linework, sage accent      for light surfaces
    line/<id>-on-dark.webp  cream linework, light sage      for dark surfaces

Both are cut out. The ground is real transparency, not a black rectangle, so a
frame sits on paper, on the olive slides, on a photograph or on a video still
with no CSS at the call site and no box around it. Margins are trimmed to the
ink, so the width you set is the width of the drawing.

## Drawing more

    node '_r&d/scripts/gen-deck-art.mjs'                  # only missing frames
    node '_r&d/scripts/gen-deck-art.mjs' --only=retreat   # one frame
    node '_r&d/scripts/gen-deck-art.mjs' --force --seed=23 --only=growth
    node '_r&d/scripts/gen-deck-art.mjs' --repaint        # recolour, no API call

Add a frame by adding one entry to `FRAMES` in that script. Keep the subject
to what is in the picture and let `STYLE` carry the look. Reuse the `FIGURE`
constant for any person, so the whole set reads as one hand.

If a draw comes back weak, raise the seed and redraw that frame alone. It is
one API call. The originals are kept in `line/.raw/`, so `--repaint` can
recolour the whole library to a new palette without redrawing anything.

## Region tints

A frame with `tint` set in `FRAMES` writes one extra file in a colour of its
own, used where the colour is carrying meaning rather than decoration:

    line/scale-uk-uk.webp             sage       the UK column
    line/scale-europe-europe.webp     ember      the Europe column
    line/scale-world-world.webp       olive      the rest of the world

They exist because the investor deck's regional market slide puts three
drawings side by side on one paper ground, and three copies of the same ink
would read as one picture cut in three. The colour does the separating, so no
coloured rule has to, which keeps the deck's no-rails rule intact.

## How the colour works

The model is asked for white lines and an orange-red accent on black, because
that is the combination it draws most cleanly. Nothing ships in those colours.
Luminance becomes the alpha channel and saturation separates the accent from
the linework, then every pixel is repainted in the Renovyn palette. That is
what lets one generated frame serve a light slide and a dark one, and what
makes a palette change cost nothing.

Two failure modes are handled in the script rather than by eye:

- The model sometimes returns the same drawing on white. A luminance matte
  then keys out the linework and keeps the ground, which writes a valid file
  that renders as a solid rectangle. The four corners are sampled and the
  matte is inverted when the ground is light.
- The accent is much darker than white, so a luminance-only matte would ship
  those lines at about 40 percent opacity. Saturation carries its own alpha
  term and the two are combined.

`node '_r&d/scripts/check-art-alpha.mjs'` fails any frame that is not a real
cut-out. Run it after any change to the pipeline.

## Frames

| id | what it shows | used on |
|---|---|---|
| cover | figure under a stack of app screens | deck cover |
| market | three concentric plates, innermost marked | TAM, SAM and SOM |
| scale-uk | a tight cluster of figures on one platform | UK market column |
| scale-europe | five linked platforms in a wide arc | Europe market column |
| scale-world | a wireframe globe with figures on it | global market column |
| discharge | figure walking out of a doorway | the problem |
| ninety-days | a steep drop with a figure at the top | why it matters |
| two-people | two figures joined by a dashed line | who uses it |
| two-routes | two roads meeting at one platform | who buys |
| phone-layers | a phone exploded into screen layers | the product |
| shield | figure inside seven nested shells | Shield |
| voice | figure under a waveform arc | Buddy |
| pathway | stepped path climbing left to right | the programme |
| console | staff console of member cards | for providers |
| cohort | grid of figures feeding an export tray | outcomes, model |
| growth | rising bars with a dashed projection | traction |
| retreat | villa terrace with an olive tree | retreats |
| map | coastline with pins and arcs | expansion |
| evidence | stacked plates with an export tray | assurance |
| team | three figures joined in a triangle | team |
| ask | one cube funding three platforms | the ask |
| gambling | bars rising out of a flat phone | where it grows fastest |
| pipeline | four linked trays, each holding fewer cubes | the data pipeline |
| bands | a doorway with slabs receding from it | discharge bands |
| fellowship | a circle of chairs, one marked | the unmeasured hypothesis |

## Two subject rules learned drawing the provider set, 9 September

Both cost a redraw of all three frames, so they are worth stating plainly.

1. **A ruled ground plane cues a measured drawing.** Every one of the first
   three attempts came back covered in pseudo numerals along leader lines, even
   with `clean: true`, because a plane ruled into a grid is what an engineering
   drawing looks like and the model completes the picture. Replace it with
   "floating with nothing behind them" and the numerals go.
2. **Say "outlined in orange-red", never "drawn in orange-red".** The second
   phrasing gets a soft filled glow rather than a line, and a glow repaints as
   a smeared blob with no edge. The accent has to be linework for the
   saturation matte to separate it.
