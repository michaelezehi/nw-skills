---
name: sketches
description: Hand-drawn SVG sketch/doodle system with a growing, brand-themeable repertoire. Use when the user says "Sketches" (e.g. "Sketches for this page", "add sketches here", "sketch these items") or wants doodle icons/wireframe illustrations on a deck, page, or report. Reuses an existing sketch when one fits, draws a new one in the house style when none does, and always adds new ones back to the repertoire.
argument-hint: [theme] item1, item2, ... | get <name> | find <words>
---

# Sketches

A self-improving library of hand-drawn SVG sketches. Every sketch is stored once,
palette-tokenised, and recoloured per brand. The rule the user cares about:
**reuse what we already have; only draw something new when nothing fits; then keep it.**

## What "Sketches" means
When the user says **"Sketches"** for a page and gives (or implies) a list of items,
turn each item into a sketch: look it up in the repertoire first, reuse + recolour it,
and only invent one when there is no real match. Sketches always render inside a
**component block** (`<figure class="sk">`) — never a white card, border, accent bar,
or gradient (see `references/house-style.md`).

## The repertoire
- `repertoire/library.json` — every sketch, palette-tokenised + compressed (one line each).
- `repertoire/INDEX.md` — browsable table (auto-healed on every `add`).
- Seeded from both real projects: 15 Founders Align wireframe **scenes** + 13 Renovyn
  **icons/scenes** (sunrise, shield-check, voice-bubble, two-people, recovery tracker,
  site shield, voice companion, supporter network, growth bars, …).
- Tokens: `{INK} {FAINT} {HERO} {ACCENT} {PAPER}`. Themes in `references/palettes.md`.

## The CLI (`render.py`) — always use it, never hand-write SVG
```bash
cd <skill-dir>
python3 render.py list [--kind icon|scene] [--tag X]   # browse
python3 render.py find  "<page item words>"            # rank reuse candidates
python3 render.py get   <name> --theme renovyn --size 88
python3 render.py page  foyer assessment blueprint --theme founders-align
python3 render.py add    <name> --kind icon --viewbox "0 0 100 100" \
                         --sw 3 --tags "..." --origin <src> --body-file new.svg
python3 render.py theme  acme --ink ... --faint ... --hero ... --accent ... --paper ...
```

## Workflow when asked for "Sketches" on a list
1. **Resolve the theme.** Match the project (founders-align / renovyn) or register a new
   one with `theme`. Default `founders-align`.
2. **For each item, `find` first.** Reuse the top match if its tags genuinely fit the
   item's concept. This is the "use an existing one" rule — do not redraw what exists.
3. **Only on a real miss, draw new.** Follow `references/house-style.md` (single ink
   line, one `{HERO}`, 5 tokens, no container). Optionally start from a harvested shape
   per `references/sources.md`, normalise it, then **`add` it** so the repertoire grows
   (self-heal). Give it a clear `name` + good `tags` so it's reused next time.
4. **Render the block(s).** `get` for one, `page` for a labelled grid. Paste the emitted
   `<figure>`/grid into the page. The block is self-contained; style the surface (chip
   bg colour, spacing) in the page CSS, never with a gradient or accent bar.
5. **Verify** before handing off: zero em-dashes in labels, no "AI" in copy, no white
   card around the sketch, one hero colour per sketch.

## Icon sets
"Icon set" = render several `icon` sketches at one uniform `--size` + theme so weight
and stroke match. Per-icon background chip (if wanted) is a solid `{PAPER}`/`{HERO}`
rounded square set in CSS. The set stays consistent and improves each time because new
icons are added back with the same tokens.

## Self-heal contract
Anything you draw for a real page gets `add`ed to `library.json` (INDEX auto-rewrites).
Next time the same concept appears — same project or another — `find` surfaces it and
you reuse it. The library only grows; bodies stay compressed (one tokenised line).

References: `references/house-style.md`, `references/palettes.md`, `references/sources.md`.
The skill's own doodle mark is `icon.svg`.
