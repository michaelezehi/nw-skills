# Aesthetic — Clean

Pure minimalism. Sans-only. White-on-white. Lots of whitespace. The slide is the silence between the words.

Use when the content is dense and the editorial aesthetic feels too ornate, or for tech-leaning audiences (engineering, design, infrastructure decks). Sister aesthetic to `editorial-renovyn` — same chrome, same chart treatment, but stripped to essentials.

## Differences from editorial

| | Editorial | Clean |
|---|---|---|
| Display font | Fraunces serif | Sans (Geist / project sans) |
| Italic emphasis | Italic serif in accent-deep | Underline accent or weight 600 |
| Color bar | 4px accent or 8-color | None — slides are pure |
| Slide chrome | Slide-mark + slide-number + footer-meta | Slide-number only, very small |
| Section headers | Large serif | Sans 56pt at weight 200 |
| Table style | Dotted hairlines, mono numerals | Single 1px solid hairlines, sans numerals |
| Background | White | White |

## CSS `:root`

```css
:root {
  --paper:        #FFFFFF;
  --paper-warm:   #FAFAFA;
  --ink:          #0A0A0A;
  --ink-soft:     #1A1A1A;
  --stone-dark:   #404040;
  --stone:        #737373;
  --stone-light:  #A3A3A3;
  --mist:         #F5F5F5;
  --rule:         rgba(0, 0, 0, 0.06);
  --rule-strong:  rgba(0, 0, 0, 0.12);

  --accent:       #6B8F71;        /* override with project --color-brand */
  --accent-deep:  #5C6B55;
  --accent-bg:    #FAFAFA;        /* used only for table.total — not callouts */

  --f-sans:       'Geist', system-ui, -apple-system, sans-serif;
  --f-mono:       'JetBrains Mono', ui-monospace, monospace;
  /* No --f-serif — clean aesthetic does not use serif */

  --slide-w:      1280px;
  --slide-h:      720px;
  --pad-x:        96px;     /* slightly wider than editorial */
  --pad-y:        72px;
}
```

## Google Fonts `<link>`

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
```

## Typography scale

```css
.eyebrow      { font: 500 11px/1 var(--f-mono); letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); }
.display-l    { font: 200 84px/0.95 var(--f-sans); letter-spacing: -0.035em; color: var(--ink); }
.display-m    { font: 200 56px/1.0 var(--f-sans); letter-spacing: -0.025em; color: var(--ink); }
.display-s    { font: 300 36px/1.1 var(--f-sans); letter-spacing: -0.018em; color: var(--ink); }
.body-l       { font: 400 18px/1.6 var(--f-sans); color: var(--stone-dark); }
.body-m       { font: 400 15px/1.65 var(--f-sans); color: var(--stone-dark); }
.body-s       { font: 400 13px/1.55 var(--f-sans); color: var(--stone); }
.footnote     { font: 400 11px/1.5 var(--f-sans); color: var(--stone-light); }
```

The `.display-*` weights are extra-light (200/300) — that's the clean aesthetic's signature. Bold (`<strong>`) inside body becomes weight 600 + `var(--ink)`.

## Slide chrome

Editorial has 3 chrome elements. Clean has 1:

```html
<!-- bottom-right only -->
<div class="slide-number">02 / 14</div>
```

```css
.slide-number {
  position: absolute;
  bottom: 32px;
  right: var(--pad-x);
  font: 500 10px/1 var(--f-mono);
  letter-spacing: 0.18em;
  color: var(--stone-light);
}
```

No slide-mark in the top-left, no footer-meta in the bottom-left. The slide number is the only acknowledgement of "this is a deck."

## Slide templates

### Cover

```html
<section class="slide cover">
  <div class="slide__inner">
    <div style="margin-top: auto;">
      <div class="eyebrow" style="margin-bottom: 28px;">{LABEL}</div>
      <h1 class="display-l" style="max-width: 1080px;">{TITLE}</h1>
      <p class="body-l" style="margin-top: 28px; max-width: 720px;">{SUBTITLE}</p>
    </div>
    <div class="cover-meta-row">
      <div><div class="meta-k">{KEY}</div><div class="meta-v">{VALUE}</div></div>
      ...×4
    </div>
  </div>
  <div class="slide-number">01 / N</div>
</section>
```

```css
.cover .slide__inner {
  justify-content: space-between;
}
.cover-meta-row {
  display: flex;
  gap: 56px;
  padding-top: 24px;
  border-top: 1px solid var(--rule);
  margin-top: 56px;
}
.meta-k    { font: 500 9px/1 var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase; color: var(--stone-light); margin-bottom: 6px; }
.meta-v    { font: 400 14px var(--f-sans); color: var(--ink); }
```

### Content

```html
<section class="slide">
  <div class="slide__inner">
    <div class="eyebrow">{EYEBROW}</div>
    <h2 class="display-s" style="margin-top: 16px;">{HEADLINE}</h2>
    <p class="body-l" style="margin-top: 28px; max-width: 880px;">{BODY}</p>
  </div>
  <div class="slide-number">02 / N</div>
</section>
```

### Stat row

Same grid as editorial but with sans numerals at lighter weight:

```css
.stat-card .num { font: 200 56px/1 var(--f-sans); letter-spacing: -0.025em; color: var(--ink); }
.stat-card .num .accent { color: var(--accent); font-weight: 300; }
```

### Table

```css
.tbl thead th     { font: 500 10px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase;
                    color: var(--stone); padding: 14px 16px; text-align: left;
                    border-bottom: 1px solid var(--rule-strong); }
.tbl tbody td     { font: 400 14px var(--f-sans); color: var(--stone-dark);
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--rule); }
.tbl tbody td.cap { font-weight: 500; color: var(--ink); }
.tbl tbody td.num { font: 400 14px var(--f-mono); text-align: right; color: var(--ink); }
.tbl tbody tr.total td { font-weight: 600; color: var(--ink);
                         border-top: 1px solid var(--rule-strong);
                         border-bottom: 1px solid var(--rule-strong); background: var(--paper); }
```

Solid hairlines (not dotted). Single weight throughout. Mono numerals only for numeric cells.

### Pull quote (clean variant)

No serif italic. Just bigger sans, lighter weight:

```html
<section class="slide pullquote">
  <div class="slide__inner" style="justify-content: center;">
    <h2 class="display-l" style="font-weight: 200; max-width: 1080px;">"{QUOTE}"</h2>
    <div class="footnote" style="margin-top: 32px;">— {ATTRIBUTION}</div>
  </div>
</section>
```

## Body shell

Same as editorial but with the dark page surround replaced by a tinted near-white:

```css
html, body {
  background: #f5f5f5;       /* very pale gray — slide floats */
  color: var(--ink);
  font-family: var(--f-sans);
}
```

## What this aesthetic explicitly avoids

- Serif fonts entirely
- Italic emphasis (use weight or color instead)
- Dotted lines (always solid)
- Color bars / decorative strips
- Mixed font weights inside a single line
- Drop shadows on slide bodies (slides float on the page bg, not on a shadow)
- Tinted callout boxes (forbidden across all aesthetics)
