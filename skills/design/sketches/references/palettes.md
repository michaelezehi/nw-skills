# Palettes (themes)

A theme maps the 5 tokens to hex. One sketch body serves every brand — recolour,
never redraw. Stored in `repertoire/library.json` under `themes`.

| token | role | founders-align | renovyn |
|---|---|---|---|
| `{INK}` | primary stroke | `#1e293b` | `#2b3a30` |
| `{FAINT}` | secondary stroke | `#cbd5e1` | `#cfc6b8` |
| `{HERO}` | hero element fill | `#fde047` (yellow) | `#a9c7ad` (light sage) |
| `{ACCENT}` | accent detail stroke/fill | `#fde047` | `#6B8F71` (sage) |
| `{PAPER}` | neutral fill | `#ffffff` | `#faf8f3` (paper) |

In Founders Align, hero and accent are the same yellow. In Renovyn they split
(light-sage hero fill, darker-sage accent strokes). A new brand just needs a row.

## Add / change a theme
```
python3 render.py theme acme \
  --ink "#111827" --faint "#d1d5db" --hero "#fca5a5" --accent "#ef4444" --paper "#fffaf5"
```
Then render any existing sketch in it: `python3 render.py get blueprint --theme acme`.

## Icon-set rule
When a page asks for an icon set, render the icons at one uniform `--size` and the
same theme so strokes/weights match. The icon background (if a chip is wanted) is a
solid `{PAPER}` or `{HERO}` rounded square set in the page CSS, **never** a gradient
and never an accent bar.
