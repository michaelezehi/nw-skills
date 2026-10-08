# Content Mapping — Markdown → Slide Templates

The deck must have visual structure, not just paragraphs. Map markdown constructs to slide templates so the output reads as a deck, not a long page.

## Top-down structure

```
Markdown                          → Slide
───────────────────────────────────────────────────────────
H1 (first one)                    → Cover slide
First paragraph after H1          → Cover sub-headline
"Meta:" / table at top            → Cover meta row (4 items)

H2                                → Section divider OR section content slide
H3 under H2                       → Sub-slide of that section
H3 + bullet stat list             → Stat-row slide
H3 + table                        → Table slide
H3 + 3-column-bullets format      → Reconciliation grid slide

Markdown table (standalone)       → Table slide
Block quote ">"                   → Pull-quote slide
Image                             → Full-bleed image slide
Code fence ```mermaid             → Diagram slide (use mermaid.js CDN)
Code fence ```                    → Code-display slide (mono font, syntax)

<!-- slide -->                    → Force a new slide here
<!-- slide:cover -->              → Force a cover slide (use first H1 above)
<!-- slide:divider title="..." -->→ Insert a divider slide manually
<!-- aesthetic: brutalist -->     → Switch aesthetic for this slide
<!-- skip -->                     → Drop this section from the deck
```

## Slide template selection rules

For each H2 / H3 section, pick a template based on the *shape* of the content underneath, not the heading text:

### Cover (one per deck, always slide 1)

```
H1 title
Single descriptive paragraph (becomes sub-headline)
A definition list or key-value bullets become the meta row
```

If there's no H1, infer the title from the filename and use the first paragraph as sub-headline.

### Section divider

Use when an H2 introduces a major part of the document (e.g., "Part 1 — Problem", "Part 2 — Solution"). Body becomes the sub-headline.

### Stat row (4 metrics)

Detect when an H2 or H3 is followed by exactly 3–6 bullets shaped like:

```
- **Revenue**: £1.5M
- **Runway**: 18 months
- **Hires**: 5
- **Margin**: 78%
```

Each bullet becomes a stat card.

### Content slide (default)

For a heading + paragraphs + sub-headings, use a content slide:

- Eyebrow (mono, accent color) — reuse the H2 title
- Display heading — reuse the H3 title (or generate one)
- Body — paragraphs at body-m size
- Optional callout block at the bottom (footnote)

### Two-column

If the section has two distinct paragraphs labelled "What's X / What's Y" (or "Pros / Cons", "Before / After"), render as two columns side-by-side.

### Table

If the section contains a markdown table, render the table slide template. Keep the heading/eyebrow above the table.

### Reconciliation grid

If the section contains 3 stat-style items each with a percentage AND a description (e.g., "30% — Marketing — Press tour and creator partnerships"), render as a 3-up grid where the percentage is the hero number.

### Bar chart

If the section contains a list of items each with a numeric value (e.g., "Marketing: 50%, Tech: 25%, G&A: 25%"), render as an inline SVG bar chart. Keep it simple — horizontal bars, value labels.

### Pull quote

A blockquote `>` that's longer than 80 chars becomes its own slide with serif italic display type, attribution below.

## Slide budget

A 1280×720 slide can comfortably hold:

- ~600 chars of body text
- ~12 table rows
- ~6 bullets
- 1 hero stat block + 1 supporting paragraph

If a section overflows, **split it into a (cont.) slide** rather than shrinking type.

Hard cap: **25 slides per deck**. If markdown produces more than 25, append a final slide that says "Continued in source markdown — open `<filename>` for the full document" and stop.

## Slide chrome (every slide except cover)

- **Top-left:** `<BRAND> · NN` then a dot then the section name (small caps, mono)
- **Bottom-left:** `<BRAND> · <Section title>` (mono)
- **Bottom-right:** `<NN> / <total>` (mono)

The cover slide replaces this with a wordmark, period number, and a meta row.

## Title casing rules

- Cover title: keep as-is (proper nouns preserved)
- Eyebrows / slide marks: `UPPERCASE` with `0.22em` letter-spacing
- Display headings: keep as-is
- Captions / footnotes: keep as-is

## Edge cases

| Situation | Handling |
|---|---|
| No H1 in source | Use filename → "Title Case", show warning |
| Single H1, no H2/H3 | Render cover + one content slide with all paragraphs |
| Front-matter YAML at top | Use `title:`, `subtitle:`, `date:`, `audience:` to fill cover meta row |
| `<details>` block | Render summary on the slide, drop the body |
| Too many sub-bullets | Truncate to 6 + "(N more in source)" |
| Tables with > 12 rows | Split across continuation slides |
| Image without alt text | Render with `[image]` caption underneath |
| Mixed heading levels (H4, H5) | Treat as nested bullets within the parent slide |
| Footnotes (`[^1]` style) | Render at the slide bottom in `.footnote` style |

## Slide ordering

Default order = source order. Don't reorder unless the user passes a flag. Markdown is the spec.

## Empty-state slide

If a section has only a heading and no body, render a sparse slide with just the eyebrow + display heading + a single horizontal rule. Don't pad with filler text.
