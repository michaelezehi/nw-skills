# Harvest sources (for NEW sketches only)

The repertoire is the first stop. When `find` returns no real match and you must
create a new sketch, you may start from one of these instead of from scratch — then
**normalise it to the house style** (single ink line, 5 tokens, one hero, no
container) and `add` it. These are sources of raw shapes, not runtime dependencies.

| source | what | licence | use for |
|---|---|---|---|
| [Khushmeen doodle icons](https://khushmeen.com/icons.html) | single-stroke hand-drawn SVG icons | free / CC0-style | new `icon` glyphs |
| [Open Doodles](https://www.opendoodles.com/) | copy-paste hand-made SVG doodles | CC0 | larger `scene` filler |
| [Highlights (Outdraw)](https://www.toools.design/free-open-source-illustrations) | 100+ sketch illustrations | CC0 | `scene` illustrations |
| [SVG Repo — hand-drawn](https://www.svgrepo.com/) | mixed hand-drawn vectors | per-icon, check | either |

## Why we do NOT add an npm dependency
- **Rough.js / svg2roughjs** ([roughjs.com](https://roughjs.com/)) only make *existing*
  shapes look sketchy at render time; they cannot author a concept like "conflict
  triangle" or "recovery tracker". They also need a JS/canvas runtime, which fights
  our static HTML → Chrome-headless → PDF pipeline. Our bodies are already
  single-stroke + 5-token recolourable, so a runtime sketch-ifier adds nothing.
- **Tabler / Lucide** are clean line icons, not hand-drawn — wrong vibe.

Optional: if you ever want extra wobble on a *generated* shape, run its path through
`svg2roughjs` once offline, then store the wobbled path in the body. Still no runtime dep.

## Normalising a harvested SVG before `add`
1. Strip `width`/`height`/`<defs>`/`style`; keep `viewBox` + path geometry.
2. Replace every colour with a token: outline → `{INK}`, faint detail → `{FAINT}`,
   the one focal fill → `{HERO}`, small accents → `{ACCENT}`, backing fill → `{PAPER}`.
3. Set `fill="none"` + round caps on the wrapper (render.py does this).
4. Ensure exactly one `{HERO}`. Collapse to one line.
5. `python3 render.py add <name> --kind icon|scene --viewbox "..." --tags "..." --origin <src> --body-file new.svg`
