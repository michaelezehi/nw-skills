# Aesthetic — Plain Outline

Technical-drawing aesthetic. Outlined cards, hairline borders, monospaced labels, schematic diagrams. Reads like an engineering blueprint or an architectural drawing. White paper, ink-only, single accent for measurement marks.

Use for technical / engineering / infrastructure / architecture decks. Pairs well with system diagrams, cost tables, and structured data. Anti-thesis of editorial — no italic emphasis, no warmth, no serif. Just lines, type, and grid.

## Differences from editorial

| | Editorial | Plain Outline |
|---|---|---|
| Display font | Fraunces serif | Sans (uppercase headlines) |
| Cards | Borderless flow | Hairline-outlined boxes |
| Lines | Dotted hairlines | Solid 1px hairlines + 0.5px micro-rules |
| Color | Sage/brand accent | Single accent for measurement marks only |
| Mood | Refined, warm | Technical, schematic |
| Background | White | White (technical paper) |

## CSS `:root`

```css
:root {
  --paper:        #FFFFFF;
  --ink:          #0F0F0F;
  --ink-soft:     #1F1F1F;
  --stone-dark:   #404040;
  --stone:        #707070;
  --stone-light:  #A0A0A0;
  --rule:         #E0E0E0;
  --rule-strong:  #C0C0C0;
  --rule-micro:   rgba(0, 0, 0, 0.35);     /* dimensional / micro lines */

  --accent:       #6B8F71;       /* override with project --color-brand */
  --accent-deep:  #5C6B55;

  --f-sans:       'Geist', 'Inter', system-ui, sans-serif;
  --f-mono:       'JetBrains Mono', ui-monospace, monospace;

  --slide-w:      1280px;
  --slide-h:      720px;
  --pad-x:        80px;
  --pad-y:        56px;
}
```

## Google Fonts `<link>`

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />
```

## Typography scale

```css
.eyebrow      { font: 600 10px/1 var(--f-mono); letter-spacing: 0.28em; text-transform: uppercase; color: var(--accent); }
.display-l    { font: 700 64px/0.95 var(--f-sans); letter-spacing: -0.02em; text-transform: uppercase; color: var(--ink); }
.display-m    { font: 700 44px/1.0 var(--f-sans); letter-spacing: -0.015em; text-transform: uppercase; color: var(--ink); }
.display-s    { font: 600 28px/1.1 var(--f-sans); letter-spacing: -0.005em; color: var(--ink); }
.body-l       { font: 400 16px/1.5 var(--f-sans); color: var(--stone-dark); }
.body-m       { font: 400 14px/1.55 var(--f-sans); color: var(--stone-dark); }
.body-s       { font: 400 12px/1.5 var(--f-mono); color: var(--stone); }       /* mono in technical aesthetic */
.footnote     { font: 400 10.5px/1.45 var(--f-mono); color: var(--stone-light); }
```

Display headlines are uppercase. Body stays sentence case.

## Slide chrome — schematic style

Top-left: spec-style fragment with measurement annotation:

```html
<div class="slide-mark">
  <span class="brand">PERSPIVA</span>
  <span class="dim">·</span>
  <span class="num">02 / 14</span>
  <span class="dim">·</span>
  <span class="caption">FIG 02 — TASK MATRIX</span>
</div>
```

```css
.slide-mark        { position: absolute; top: 28px; left: var(--pad-x);
                     font: 500 9.5px/1 var(--f-mono); letter-spacing: 0.20em; text-transform: uppercase;
                     color: var(--stone); display: flex; gap: 12px; align-items: center; }
.slide-mark .brand { color: var(--ink); font-weight: 600; }
.slide-mark .num   { color: var(--accent); font-weight: 600; }
.slide-mark .dim   { color: var(--stone-light); }
.slide-mark .caption { color: var(--stone-dark); }
```

Bottom of every slide gets a `<svg>` measurement strip — drawn rule with tick marks, labelled at the 0/50/100 positions:

```html
<svg class="dim-strip" viewBox="0 0 1120 24" style="position: absolute; left: var(--pad-x); right: var(--pad-x); bottom: 28px; width: calc(100% - var(--pad-x) * 2); height: 24px;">
  <line x1="0" y1="12" x2="1120" y2="12" stroke="var(--rule-strong)" stroke-width="0.75"/>
  <!-- ticks every 100px -->
  <g stroke="var(--rule-micro)" stroke-width="0.5">
    <line x1="0" y1="6" x2="0" y2="18"/>
    <line x1="280" y1="9" x2="280" y2="15"/>
    <line x1="560" y1="6" x2="560" y2="18"/>
    <line x1="840" y1="9" x2="840" y2="15"/>
    <line x1="1120" y1="6" x2="1120" y2="18"/>
  </g>
  <text x="0" y="3" font-family="JetBrains Mono" font-size="8" fill="var(--stone-light)" letter-spacing="0.18em">0</text>
  <text x="555" y="3" font-family="JetBrains Mono" font-size="8" fill="var(--stone-light)" letter-spacing="0.18em">SLIDE.MID</text>
  <text x="1095" y="3" font-family="JetBrains Mono" font-size="8" fill="var(--stone-light)" letter-spacing="0.18em">END</text>
</svg>
```

Optional but signature for the aesthetic.

## Slide templates

### Cover

```html
<section class="slide cover">
  <div class="slide__inner">
    <!-- Top spec line -->
    <div class="spec-line">
      <span>FIG 0.0 — COVER</span>
      <span>SHEET 01 OF 14</span>
      <span>SCALE 1:1</span>
    </div>

    <!-- Big uppercase title -->
    <div style="margin-top: auto;">
      <div class="eyebrow">PERSPIVA · APRIL 2026</div>
      <h1 class="display-l" style="margin-top: 24px; max-width: 1000px;">{TITLE}</h1>
      <p class="body-l" style="margin-top: 24px; max-width: 720px;">{SUBTITLE}</p>
    </div>

    <!-- Outlined meta-grid -->
    <div class="meta-grid">
      <div><span class="meta-k">RAISE</span><span class="meta-v">£1.5M</span></div>
      <div><span class="meta-k">RUNWAY</span><span class="meta-v">18 MO</span></div>
      <div><span class="meta-k">TASKS</span><span class="meta-v">18</span></div>
      <div><span class="meta-k">FILES</span><span class="meta-v">17</span></div>
    </div>
  </div>
</section>
```

```css
.spec-line       { display: flex; gap: 32px; padding: 8px 0; border-bottom: 1px solid var(--rule);
                   font: 500 9.5px var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase;
                   color: var(--stone); }
.meta-grid       { margin-top: 56px; display: grid; grid-template-columns: repeat(4, 1fr);
                   border: 1px solid var(--rule); }
.meta-grid > div { padding: 18px 22px; border-right: 1px solid var(--rule); display: flex; flex-direction: column; gap: 8px; }
.meta-grid > div:last-child { border-right: none; }
.meta-k          { font: 600 9px var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase; color: var(--stone); }
.meta-v          { font: 700 24px var(--f-sans); color: var(--ink); }
```

### Outlined card grid (the signature pattern)

Replaces the stat-row from editorial. Cards are outlined, not borderless:

```html
<div class="card-grid">
  <div class="card">
    <div class="card-num">01</div>
    <div class="card-label">LAND THE NEW CATEGORY</div>
    <div class="card-body">"Customer Intelligence Platform" becomes the master tagline.</div>
  </div>
  ...×N
</div>
```

```css
.card-grid           { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
                       margin-top: 28px; border: 1px solid var(--rule); }
.card                { padding: 22px 24px; border-right: 1px solid var(--rule);
                       display: flex; flex-direction: column; gap: 12px;
                       background: var(--paper); }
.card:last-child     { border-right: none; }
.card-num            { font: 700 32px var(--f-sans); color: var(--accent);
                       border-bottom: 1px solid var(--rule); padding-bottom: 12px; }
.card-label          { font: 600 10px var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink); }
.card-body           { font: 400 13px/1.55 var(--f-sans); color: var(--stone-dark); }
```

### Table — schematic

```css
.tbl              { width: 100%; border-collapse: collapse; margin-top: 18px; }
.tbl thead th     { font: 600 9.5px/1 var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase;
                    color: var(--stone-dark); padding: 10px 14px; text-align: left;
                    border: 1px solid var(--rule-strong);
                    background: #FAFAFA; }
.tbl tbody td     { font: 400 13px var(--f-sans); color: var(--stone-dark);
                    padding: 8px 14px; border: 1px solid var(--rule); }
.tbl tbody td.cap { font-family: var(--f-mono); font-weight: 600; color: var(--ink); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
.tbl tbody td.num { font: 500 13px var(--f-mono); text-align: right; color: var(--ink); }
.tbl tbody tr.total td { font: 700 14px var(--f-sans); color: var(--ink); background: #FAFAFA; }
```

Solid 1px borders on every cell — the table reads as a schematic grid, not a flowing list.

### Diagram blocks

For architecture / flow / system diagrams. Use inline SVG with technical drawing conventions:

```html
<svg viewBox="0 0 1100 320" style="width: 100%; margin-top: 28px;">
  <!-- nodes -->
  <rect x="40" y="80" width="180" height="80" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
  <text x="130" y="125" font-family="Geist" font-size="14" font-weight="600" text-anchor="middle">Input</text>
  <text x="130" y="145" font-family="JetBrains Mono" font-size="10" letter-spacing="0.18em" fill="var(--stone)" text-anchor="middle">A.01</text>

  <!-- connector with accent dot -->
  <line x1="220" y1="120" x2="380" y2="120" stroke="var(--ink)" stroke-width="1.2"/>
  <circle cx="380" cy="120" r="3" fill="var(--accent)"/>

  <rect x="380" y="80" width="180" height="80" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
  <text x="470" y="125" font-family="Geist" font-size="14" font-weight="600" text-anchor="middle">Process</text>
  <text x="470" y="145" font-family="JetBrains Mono" font-size="10" letter-spacing="0.18em" fill="var(--stone)" text-anchor="middle">A.02</text>

  <!-- ... -->
</svg>
```

Always label every node with a mono ID code (`A.01`, `B.02`) — schematic discipline.

## Body shell

```css
html, body {
  background: #F0F0EC;          /* very pale gray-warm — engineering paper */
  color: var(--ink);
  font-family: var(--f-sans);
}

.slide {
  background: var(--paper);
  border: 1px solid var(--rule-strong);    /* subtle outline on the slide itself */
  box-shadow: none;                         /* no drop shadow — the line is the shadow */
}
```

## What this aesthetic explicitly avoids

- Any italic
- Any drop shadow
- Any rounded corner (always sharp)
- Any gradient
- Color tints inside cells (white only)
- Display serif (sans only, uppercase)
- Decorative imagery (only schematic SVG)
- Tinted callout boxes (forbidden across all aesthetics)

## When to pick this aesthetic

Pick `plain-outline` over `editorial` when:

- The deck is technical (architecture, infrastructure, data pipeline, financial model with heavy schedules)
- The audience is engineers / architects / financial analysts
- The content has many structured items that benefit from grid presentation
- The brand voice is precise / measured / utilitarian
- You'd ship the same content as a Notion document — the aesthetic shouldn't fight that
