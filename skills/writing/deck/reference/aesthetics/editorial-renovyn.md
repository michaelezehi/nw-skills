# Aesthetic — Editorial / Renovyn

The default deck aesthetic. Modeled on the Renovyn financial-model HTML — paper background, refined serif/sans/mono typography, dotted hairline rules, sage accent (or project's brand color), 1280×720 fixed slides, prints crisp PDF.

**Canonical reference:** `examples/renovyn-financial-model.html` — open it in a browser to see the bar.

## Slide dimensions

```
--slide-w: 1280px
--slide-h: 720px
--pad-x:    88px   (left/right slide padding)
--pad-y:    60px   (top/bottom slide padding)
```

Slides are fixed-size `<section>` blocks with `box-shadow: 0 32px 72px -20px rgba(0,0,0,0.5)` floating on a dark page background (`#1a1a17`). Body has 32px top padding, 72px bottom padding, slides spaced `28px` apart.

## CSS `:root` — full default token set

Use this verbatim, then **override `--paper`, `--ink`, `--accent`, `--accent-deep`, `--accent-bg` with the project's detected tokens**.

**Background default — pure white (`#FFFFFF`).** Only tint paper if the user explicitly passes `--colors "paper:#XXXXXX"` or the project's CLAUDE.md *explicitly* names a non-white deck background. A project's UI-background color (e.g., Perspiva's warm `#F0ECE6`) does **not** automatically become the deck background — decks read better on white.

```css
:root {
  /* Paper / ink — neutrals */
  --paper:        #FFFFFF;          /* DEFAULT WHITE — do not tint without explicit instruction */
  --paper-warm:   #FAFAF7;          /* used only for table-section row tints */
  --ink:          #0F0F0F;
  --ink-soft:     #1A1A1A;
  --stone-dark:   #3A3A35;
  --stone:        #6B6B6B;
  --stone-light:  #9A9A90;
  --mist:         #E5E5DF;
  --rule:         rgba(0, 0, 0, 0.08);
  --rule-strong:  rgba(0, 0, 0, 0.16);

  /* Accent (override with project brand color) */
  --accent:       #6B8F71;   /* sage default — REPLACE WITH project --color-brand */
  --accent-deep:  #5C6B55;
  --accent-bg:    #F4F7F4;   /* used ONLY for table.total row backgrounds — NOT for callouts */
  --accent-tint:  rgba(107, 143, 113, 0.10);

  /* 8-color palette bar (decorative — keep defaults unless project has its own) */
  --p-sage:       #B8CCBE;
  --p-mint:       #A8D4C4;
  --p-sky:        #B0C8D8;
  --p-lavender:   #C8B8D4;
  --p-rose:       #E4B0BE;
  --p-peach:      #F0C4B0;
  --p-butter:     #EDDA9E;
  --p-gold:       #E8D4A0;

  /* Fonts */
  --f-serif:      'Fraunces', 'Times New Roman', serif;
  --f-sans:       'Geist', system-ui, -apple-system, sans-serif;
  --f-mono:       'JetBrains Mono', ui-monospace, monospace;

  /* Slide layout */
  --slide-w:      1280px;
  --slide-h:      720px;
  --pad-x:        88px;
  --pad-y:        60px;
}
```

If the project's brand color is bright/saturated (e.g., Perspiva `#E84A0C`), the deck looks better with a single 4px accent bar in the brand color instead of the 8-color palette bar. Detect brightness via HSL saturation > 60% and lightness 35–65%.

## Google Fonts `<link>`

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..500;1,9..144,300..500&family=Geist:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
```

If the project has its own sans (e.g., Inter, Geist already loaded elsewhere), substitute it in the `--f-sans` variable but keep Fraunces and JetBrains Mono for serif and mono since those carry the editorial feel.

## Typography scale

```css
.eyebrow     { font: 500 11px/1 var(--f-mono); letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); }
.display-l   { font: 300 64px/1.0 var(--f-serif); letter-spacing: -0.022em; color: var(--ink); }
.display-m   { font: 300 44px/1.06 var(--f-serif); letter-spacing: -0.018em; color: var(--ink); }
.display-s   { font: 400 32px/1.12 var(--f-serif); letter-spacing: -0.014em; color: var(--ink); }
.body-l      { font: 400 19px/1.55 var(--f-sans); color: var(--stone-dark); }
.body-m      { font: 400 16px/1.6  var(--f-sans); color: var(--stone-dark); }
.body-s      { font: 400 13px/1.55 var(--f-sans); color: var(--stone); }
.footnote    { font: italic 400 11.5px/1.5 var(--f-sans); color: var(--stone-light); }
```

Italic in display sizes uses the same weight (300/400) — Fraunces handles this beautifully with optical sizing. Bold (`<strong>`) inside body text bumps to `var(--ink)` and weight 600 — never use weight 700+ in body copy.

**Multi-line eyebrows must breathe.** `.eyebrow` ships at `line-height: 1` — correct for a single line, but a wrapping mono kicker at `letter-spacing: .24em` jams and orphans its last word (e.g. `…SUBJECT TO ADVANCE / ASSURANCE`). If a kicker won't fit one line, break it into deliberate lines with `<br>` at a logical `·` boundary AND set `line-height: 1.6–1.7`. Never let a mono eyebrow wrap on its own with `line-height: 1`.

## Slide chrome

Every slide except the cover has these absolute-positioned elements:

```html
<!-- Top-left -->
<div class="slide-mark">
  <span class="brand">RENOVYN · 02</span>
  <span class="dot"></span>
  AT A GLANCE
</div>

<!-- Bottom-left -->
<div class="footer-meta">Renovyn<span class="sep">·</span>At a glance</div>

<!-- Bottom-right -->
<div class="slide-number"><strong>02</strong> / 10</div>
```

The dot is `5×5px`, `border-radius: 50%`, `background: var(--accent)`, vertically aligned with `transform: translateY(-1px)`.

## Slide templates

### 1. Cover

```html
<section class="slide cover" data-slide="1">
  <div class="color-bar"><span></span>...×8</div>
  <div class="slide__inner">
    <div class="cover-top">
      <div class="wordmark"><span class="dot"></span>{BRAND}</div>
      <div class="footer-meta" style="position:static;">{SUBTITLE} · {DATE}</div>
    </div>
    <div>
      <div class="cover-title">{TITLE}<span class="period">.</span></div>
      <div class="cover-headline">{HEADLINE}</div>
      <div class="cover-sub">{SUB}</div>
    </div>
    <div class="cover-foot">
      <div class="cover-meta">
        <div class="item"><div class="k">{KEY1}</div><div class="v">{VAL1}</div></div>
        ...
      </div>
      <div class="footer-meta" style="position:static;color:var(--accent);">{TAGLINE}</div>
    </div>
  </div>
  <div class="slide-number"><strong>01</strong> / {N}</div>
</section>
```

Cover uses serif at 96px for the title, period in accent color. Headline at 40px serif with italic emphasis sections. Sub at 17px sans.

### 2. Section divider / At-a-glance

```html
<section class="slide" data-slide="2">
  <div class="slide-mark">...</div>
  <div class="slide__inner">
    <div class="eyebrow">{EYEBROW}</div>
    <div class="display-m" style="margin-top:14px;max-width:1080px;">{HEADLINE}</div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="lab">{METRIC_LABEL}</div>
        <div class="num"><span class="accent">{PREFIX}</span>{VALUE}</div>
        <div class="sub">{CAPTION}</div>
      </div>
      ...×4
    </div>
    <!-- optional supporting body grid -->
  </div>
  <div class="footer-meta">...</div>
  <div class="slide-number">...</div>
</section>
```

### 3. Content slide (default)

```html
<section class="slide">
  <div class="slide-mark">...</div>
  <div class="slide__inner">
    <div class="eyebrow">{EYEBROW}</div>
    <div class="display-s" style="margin-top:12px;">{HEADLINE} <em>{ITALIC_PART}</em></div>
    <p class="body-m" style="margin-top:20px;max-width:920px;">{BODY}</p>
    <p class="footnote" style="margin-top:32px;">{FOOTNOTE}</p>
  </div>
  ...
</section>
```

### 4. Two-column

```html
<div style="margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:36px;">
  <div>
    <div class="eyebrow" style="margin-bottom:10px;">{LEFT_LABEL}</div>
    <div class="body-m">{LEFT_BODY}</div>
  </div>
  <div>
    <div class="eyebrow" style="margin-bottom:10px;">{RIGHT_LABEL}</div>
    <div class="body-m">{RIGHT_BODY}</div>
  </div>
</div>
```

### 5. Table

```html
<table class="tbl">
  <thead>
    <tr>
      <th>{COL1}</th>
      <th class="right">{COL2}</th>
      <th class="center">{COL3}</th>
    </tr>
  </thead>
  <tbody>
    <tr class="section"><td colspan="3">{SECTION_HEADER}</td></tr>
    <tr>
      <td class="cap">{ROW_LABEL}</td>
      <td class="num">{NUMBER}</td>
      <td class="canon">{TAG}</td>
    </tr>
    ...
    <tr class="total">
      <td>Total</td>
      <td class="num">{TOTAL}</td>
      <td></td>
    </tr>
  </tbody>
</table>
```

CSS:
```css
.tbl              { width: 100%; border-collapse: collapse; margin-top: 18px; font-family: var(--f-sans); }
.tbl thead th     { font: 500 10px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase;
                    color: var(--stone); padding: 12px 14px; text-align: left;
                    border-bottom: 1px solid var(--rule-strong); }
.tbl thead th.right { text-align: right; }
.tbl thead th.center { text-align: center; }
.tbl tbody td     { font-size: 13.5px; color: var(--stone-dark); padding: 11px 14px;
                    border-bottom: 1px dotted var(--rule-strong); vertical-align: top; }
.tbl tbody td.cap   { font-weight: 600; color: var(--ink); }
.tbl tbody td.num   { font-family: var(--f-mono); text-align: right; color: var(--ink); }
.tbl tbody td.right { text-align: right; }
.tbl tbody td.center{ text-align: center; }
.tbl tbody td.illu  { font-family: var(--f-mono); font-size: 9.5px; text-transform: uppercase;
                      letter-spacing: 0.14em; color: var(--stone-light); }
.tbl tbody td.canon { font-family: var(--f-mono); font-size: 9.5px; text-transform: uppercase;
                      letter-spacing: 0.14em; color: var(--accent); font-weight: 500; }
.tbl tbody tr.total td { font-weight: 600; color: var(--ink);
                         border-top: 1px solid var(--rule-strong);
                         border-bottom: 1px solid var(--rule-strong);
                         background: var(--accent-bg); }
.tbl tbody tr.section td { background: var(--paper-warm); font: 400 16px var(--f-serif);
                           color: var(--ink); padding: 14px 14px; }
```

### 6. Reconciliation grid (3-up percentage)

```html
<div class="recon-grid">
  <div class="recon-cell">
    <div class="lab">{LABEL}</div>
    <div class="pct">{PCT}%</div>
    <div class="desc">{DESCRIPTION}</div>
    <div class="amt">{AMOUNT}</div>
  </div>
  ...×3
</div>
```

```css
.recon-grid       { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 24px;
                    border-top: 1px dotted var(--rule-strong);
                    border-left: 1px dotted var(--rule-strong); }
.recon-cell       { padding: 20px 22px; border-right: 1px dotted var(--rule-strong);
                    border-bottom: 1px dotted var(--rule-strong);
                    display: flex; flex-direction: column; gap: 10px; }
.recon-cell .pct  { font: 400 56px/1 var(--f-serif); color: var(--accent); letter-spacing: -0.02em; }
.recon-cell .lab  { font: 500 10px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--stone); }
.recon-cell .desc { font-size: 12.5px; color: var(--stone-dark); line-height: 1.5; }
.recon-cell .amt  { font: 400 13px var(--f-mono); color: var(--ink); }
```

### 7. Bar chart (inline SVG)

```html
<div class="barchart">
  <svg viewBox="0 0 1100 220">
    <!-- bars -->
    <rect x="0" y="40" width="550" height="34" fill="var(--accent)" />
    <text x="0" y="30" font-family="var(--f-mono)" font-size="11" fill="var(--stone)">MARKETING</text>
    <text x="560" y="65" font-family="var(--f-mono)" font-size="13" fill="var(--ink)">£750K · 50%</text>
    ...
  </svg>
</div>
```

### 8. Pull quote

```html
<section class="slide pullquote">
  <div class="slide-mark">...</div>
  <div class="slide__inner" style="justify-content:center;">
    <div class="display-l" style="font-style:italic;max-width:1000px;">"{QUOTE}"</div>
    <div class="footer-meta" style="margin-top:32px;position:static;">— {ATTRIBUTION}</div>
  </div>
  ...
</section>
```

## 4-stat row CSS

```css
.stats-row       { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px;
                   margin-top: 28px; padding-top: 22px; border-top: 1px dotted var(--rule-strong); }
.stat-card .lab  { font: 500 10px/1 var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase; color: var(--stone); margin-bottom: 8px; }
.stat-card .num  { font: 400 52px/1 var(--f-serif); letter-spacing: -0.022em; color: var(--ink); }
.stat-card .num .accent { color: var(--accent); }
.stat-card .sub  { font-size: 12px; color: var(--stone-dark); margin-top: 8px; line-height: 1.4; }
```

## Cover-specific CSS

```css
.cover .slide__inner { padding: 36px var(--pad-x) 80px; justify-content: space-between; }
.cover-top      { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.wordmark       { display: inline-flex; align-items: center; gap: 10px; font: 600 17px var(--f-sans); }
.wordmark .dot  { width: 9px; height: 9px; background: var(--accent); border-radius: 50%; }
.cover-title    { font: 300 96px/0.95 var(--f-serif); letter-spacing: -0.035em; color: var(--ink); margin-bottom: 18px; }
.cover-title .period { color: var(--accent); }
.cover-headline { font: 300 40px/1.08 var(--f-serif); letter-spacing: -0.018em; color: var(--ink); max-width: 920px; margin-bottom: 20px; }
.cover-headline em { font-style: italic; color: var(--accent-deep); }
.cover-sub      { font: 400 17px/1.55 var(--f-sans); color: var(--stone-dark); max-width: 720px; }
.cover-foot     { border-top: 1px dotted var(--rule-strong); padding-top: 18px;
                  display: flex; justify-content: space-between; align-items: flex-end; }
.cover-meta     { display: flex; gap: 48px; }
.cover-meta .item .k { font: 500 9px/1 var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase; color: var(--stone-light); margin-bottom: 4px; }
.cover-meta .item .v { font: 500 13px var(--f-sans); color: var(--ink); }
```

## Color bar (decorative)

```html
<div class="color-bar">
  <span></span><span></span><span></span><span></span>
  <span></span><span></span><span></span><span></span>
</div>
```

```css
.color-bar          { display: flex; height: 4px; width: 100%; flex-shrink: 0; }
.color-bar > span   { flex: 1; }
.color-bar > span:nth-child(1) { background: var(--p-sage); }
.color-bar > span:nth-child(2) { background: var(--p-mint); }
.color-bar > span:nth-child(3) { background: var(--p-sky); }
.color-bar > span:nth-child(4) { background: var(--p-lavender); }
.color-bar > span:nth-child(5) { background: var(--p-rose); }
.color-bar > span:nth-child(6) { background: var(--p-peach); }
.color-bar > span:nth-child(7) { background: var(--p-butter); }
.color-bar > span:nth-child(8) { background: var(--p-gold); }
```

**Single-accent variant** (when project has a saturated brand color):

```html
<div class="accent-bar"></div>
```

```css
.accent-bar { height: 4px; width: 100%; background: var(--accent); flex-shrink: 0; }
```

## Top bar (download / print)

```html
<div class="topbar">
  <a href="javascript:window.print()">Download PDF</a>
</div>
```

```css
.topbar       { position: fixed; top: 18px; right: 28px; display: flex; gap: 10px; z-index: 200; }
.topbar a     { border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04);
                color: #fff; padding: 10px 16px; border-radius: 999px;
                font: 500 11px var(--f-mono); letter-spacing: 0.12em;
                text-transform: uppercase; text-decoration: none; }
.topbar a:hover         { background: rgba(255,255,255,0.12); }
.topbar a.primary       { background: var(--accent); border-color: var(--accent); color: #fff; }
.topbar a.primary:hover { background: var(--accent-deep); border-color: var(--accent-deep); }
```

## Print rules — required

```css
@page { size: 1280px 720px; margin: 0; }
@media print {
  html, body { background: #fff; }
  body { padding: 0; }
  .topbar { display: none !important; }
  .deck { width: var(--slide-w); }
  .slide {
    margin: 0;
    box-shadow: none;
    break-after: page;
  }
  .slide:last-child { break-after: auto; }
}
```

Without these, the printed PDF will have browser headers/footers, multiple slides per page, and broken margins.

## Body shell

```html
<body>
  <div class="topbar">...</div>
  <div class="deck">
    <section class="slide cover">...</section>
    <section class="slide">...</section>
    ...
  </div>
</body>
```

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: #1a1a17;        /* dark page surround so paper slides float */
  color: var(--ink);
  font-family: var(--f-sans);
  -webkit-font-smoothing: antialiased;
}
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0 72px;
}
.deck { width: var(--slide-w); max-width: 100vw; }
.slide {
  position: relative;
  width: var(--slide-w);
  height: var(--slide-h);
  background: var(--paper);
  overflow: hidden;
  margin: 0 auto 28px;
  box-shadow: 0 32px 72px -20px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
}
.slide__inner {
  position: relative;
  z-index: 2;
  flex: 1;
  padding: var(--pad-y) var(--pad-x) 88px var(--pad-x);
  display: flex;
  flex-direction: column;
  justify-content: center;   /* centre content vertically — kills bottom-heavy negative space on sparse slides */
  overflow: hidden;
}
```

## Italic-in-display convention

Display headings often use italic for emotional emphasis on a sub-clause. Apply via `<em>`:

```html
<div class="display-m">£1.5M seed. <em>18 months.</em> Global launch, marketing-weighted.</div>
```

The italic part renders in `var(--accent-deep)` and italic style. This is the editorial "voice" — use it once or twice per slide, never more.

### Green clause on its own full line

When an accent/italic clause **ends** a display heading (i.e. the `<em>` is the last thing in the heading), give it its own full line so it lands as a deliberate second beat instead of a ragged wrap on the tail of the ink line. Mark the trailing clause with `class="gl"`:

```html
<div class="display-m">A recovery companion that travels with the person <em class="gl">after they leave you.</em></div>
```

```css
.display-m em.gl, .display-s em.gl { display: block; margin-top: .06em; }
```

**Only the trailing clause gets `gl`.** When the green is *mid-sentence* (ink text follows it — e.g. `we build to the standard your <em>governance team</em> will ask for.`), leave it inline. Do **not** use `em:last-child` for this — CSS ignores trailing text nodes, so `:last-child` wrongly blocks mid-sentence emphasis and orphans the text after it.

### Vertical rhythm — no bottom-heavy negative space

Content slides centre vertically (`.slide__inner { justify-content: center }`). A sparse slide should read as *centred and calm*, never as content clustered at the top with a dead band beneath it. If a slide still feels thin after centring, make the type earn the space — bump list/`feat` rows to ~17px with ~18px gaps and widen `max-width`, rather than leaving a void. Verify by rendering: content should sit visually centred between the top chrome and the footer, with balanced margins above and below.

## Emphasis blocks (NO tinted side-bar callouts)

**Do NOT use** the colored left-border + tinted-background callout pattern. It looks like a "system note" box and breaks the editorial paper feel.

Instead, emphasize using one of these three type-only patterns:

### Pattern 1 — Hero quote (centered, serif, italic)

For a single line meant to *land*:

```html
<div class="emphasis-quote">
  <div class="display-m" style="font-style: italic; max-width: 980px;">
    Most companies don't have a survey problem. They have an
    <span style="color: var(--accent-deep);">insight problem.</span>
  </div>
  <div class="emphasis-attribution">— Yasmeen Turayhi · Co-founder</div>
</div>
```

```css
.emphasis-quote { margin-top: 32px; max-width: 1080px; }
.emphasis-attribution {
  margin-top: 14px;
  font: 500 9.5px/1 var(--f-mono);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--stone);
}
```

No fill. No left bar. Just type. The italic + accent-coloured fragment carries the emphasis.

### Pattern 2 — Indented note (thin vertical rule, no fill)

For a side-comment that must be visually separated but not heavy:

```html
<div class="emphasis-note">
  <div class="body-m">
    F-9 acceptance includes a byte-identity check: the kicker
    must be byte-identical to the original after the rewrite.
  </div>
</div>
```

```css
.emphasis-note {
  margin-top: 24px;
  padding: 6px 0 6px 22px;
  border-left: 1px solid var(--accent);
  max-width: 880px;
}
```

A 1px hairline rule. No fill. Hugs the type. Disappears in print at low ink levels — subtle, not loud.

### Pattern 3 — Display-only callout (giant type, no chrome)

For a thesis-level moment, give the line its own slide via the pull-quote template (see "Slide templates → Pull quote"). Do not wrap pull-quotes in boxes.

## Forbidden patterns

These ruin the editorial feel — never emit them in this aesthetic:

- Left-bordered tinted callout boxes (`background: var(--accent-bg); border-left: 3px solid var(--accent);`)
- Rounded cards with drop shadows on the slide body
- Solid-colored strip headers across slides (the chrome top is the only horizontal solid)
- Gradient backgrounds inside slide bodies
- Emoji as decoration (icons via Iconify only — see `reference/icons-and-charts.md`)

## What this aesthetic is NOT

- Not dark mode. Paper is light.
- Not animated. Static, print-ready.
- Not responsive. Fixed 1280×720 by design — `<meta name="viewport" content="width=1280" />` forces desktop view on mobile so it stays readable.
- Not interactive (beyond top-bar print button). It's a deck, not an app.
- Not full-bleed images. Imagery is rare and editorial — never decorative.
