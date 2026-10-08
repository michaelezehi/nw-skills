# House style — non-negotiable

Every sketch, reused or new, obeys these or it does not enter the repertoire.

## Drawing rules
- **One ink line.** `fill="none"` on the wrapper, `stroke-linecap="round"`, `stroke-linejoin="round"`. Stroke width 2.4–3.2.
- **Slightly irregular paths.** Use `q`/`a` curves and hand-wobbled coordinates, never perfect rectangles where a sketch would wobble.
- **Five colours only**, via tokens — never hard-code hex in a body:
  - `{INK}` primary stroke · `{FAINT}` secondary/de-emphasised stroke
  - `{HERO}` the single hero element's fill · `{ACCENT}` small accent detail strokes/fills
  - `{PAPER}` neutral fill behind shapes
- **One hero per sketch.** Exactly one element carries `{HERO}` fill — the thing the eye should land on. Everything else is `{INK}`/`{FAINT}`/`{PAPER}`.
- **No gradients. Ever.** Solid fills only. (User ban — applies everywhere.)

## Container rules
- A sketch renders inside a `<figure class="sk">` **component block** and nothing else.
- **No white card, no border, no box-shadow, no accent bar** around a sketch. It sits directly on the page surface. (User bans side/top accent bars and gradient containers.)
- The `<svg>` scales to its container width; height auto. Icons sized by `--size`/`style`.

## Kinds
- `icon` — square glyph (≈100×100 or 40×40), one concept, used inline above a label or in an icon set.
- `scene` — wireframe story (≈380–540 wide), narrates a before→after or a screen.

## Copy rules (carried from the projects)
- Never the word "AI" in any visible label/aria — use "smart"/"intelligent"/"companion".
- "Alignment", never "assessment", in Founders Align user-facing labels.
- No em-dashes in labels or captions.
