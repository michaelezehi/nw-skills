# Aesthetic — Straight (default)

The house default. One sans, nothing slants, three grounds, a drawing on every
slide, and a composition that changes from slide to slide so the deck reads as
designed rather than templated.

This spec is the Unframed HR investor deck of 10 September 2026, which is the
best deck this system has produced, written down so the next one starts there.
Where a number below is odd (`line-height:1.16`, `margin-top:34px`), it was
measured on a printed page and the reason is beside it. Keep the reasons when
you copy the CSS; they are the part that stops the next person "tidying" a
fault back in.

**Use it unless the user names another aesthetic.**

## What makes it read as expensive

Six things, in order of weight. The type is the least of them.

1. **The composition changes.** Copy and drawing share the frame in an uneven
   split that is set per slide, and the drawing swaps sides for the beats that
   turn the argument. Fourteen slides on one grid read as a template at
   thumbnail size, however good the type.
2. **The frame is centred or filled, never floated.** Under the mark and above
   the footer there are 572px. A slide either centres its content in that
   (default) or pins its first block to the top and its last to the floor
   (`.fill`). A stat strip that ends 120px above the footer has not been
   placed; it has been left.
3. **Drawings are large.** 360 to 588px wide. A drawing pinned into a 260px
   column is a polite illustration; at half the page it is the slide.
4. **One number, when there is one.** A market, a raise, a result: set it at
   150px and demote everything else on the slide to a strip.
5. **The ground is a beat, not a rotation.** Paper is the page. Olive is the
   cover and the closes. Ember is reserved for the two turns of the argument
   and nothing else. Grounds land roughly 7 / 5 / 2 in a fourteen-slide deck.
6. **Light weight, tight tracking, one family.** 300 at 46px, 200 at 150px,
   tracking from `-.028em` to `-.05em` as size rises. Emphasis is weight 500
   in the accent, never a slant.

## The display font — resolve, don't assume

`--f-display` and `--f-sans` are **the project's own sans**, the same family
for both. Take it from `reference/token-detection.md`; fall back to Geist only
when the project ships none. A deck in two sans families reads as an accident.

Request the full weight range and **no italic axis**:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
```

## Tokens

Three grounds, and every component below paints with the `--fg / --acc /
--line / --panel` trio. **A ground swap is one class on the section**, and
nothing inside the slide knows which ground it landed on. That is the whole
reason the CSS stays short.

```css
:root {
  /* paper, the default ground */
  --paper:#FFFFFF;  --ink:#15110D;  --ink-2:#3A352D;  --stone:#6B665B;
  --accent:#E5301B;        /* REPLACE with the project brand */
  --accent-deep:#B81F0E;   /* brand, darkened; carries emphasis on paper */

  /* olive, the deep ground for the cover and the closes. Warm near-black in
     the project's own dark, never #000. */
  --olive:#0E0B08;  --on-olive:#F4EFE6;  --on-olive-2:#C9C2B4;
  --accent-olive:#F2513C;  /* brand, lifted so small text clears 4.5:1 on olive */

  /* ember, the warm ground reserved for the two turns of the argument. Use the
     brand's own red rather than a brick: this is as light as the ground can go
     while secondary text still clears 4.5:1 on it. Measure yours. */
  --ember:#C92C12;  --on-ember:#FFF6F2;  --on-ember-2:#FFE8E0;
  --accent-ember:#FFC46B;  /* a warm accent; the brand red vanishes on itself */

  --f-display:'Geist',system-ui,-apple-system,sans-serif;
  --f-sans:'Geist',system-ui,-apple-system,sans-serif;
  --f-mono:'JetBrains Mono',ui-monospace,monospace;

  --slide-w:1280px; --slide-h:720px; --pad-x:84px; --pad-y:84px;
  --r:12px;   /* panels, cells and the slide on screen. 0 in print. */
}

.slide {
  --bg:var(--paper); --fg:var(--ink); --fg-2:var(--ink-2); --fg-3:var(--stone);
  --acc:var(--accent); --acc-2:var(--accent-deep);
  --line:rgba(21,17,13,.10); --line-2:rgba(21,17,13,.20);
  --panel:rgba(21,17,13,.035); --panel-acc:rgba(229,48,27,.07);
}
.slide.ol {
  --bg:var(--olive); --fg:var(--on-olive); --fg-2:var(--on-olive-2); --fg-3:var(--on-olive-2);
  --acc:var(--accent-olive); --acc-2:var(--accent-olive);
  --line:rgba(244,239,230,.14); --line-2:rgba(244,239,230,.24);
  --panel:rgba(244,239,230,.055); --panel-acc:rgba(242,81,60,.14);
}
.slide.em {
  --bg:var(--ember); --fg:var(--on-ember); --fg-2:var(--on-ember-2); --fg-3:var(--on-ember-2);
  --acc:var(--accent-ember); --acc-2:var(--accent-ember);
  --line:rgba(255,246,242,.22); --line-2:rgba(255,246,242,.36);
  --panel:rgba(255,246,242,.10); --panel-acc:rgba(255,196,107,.18);
}
```

Every `--on-*` and `--accent-*` value is measured against its ground, not
eyeballed: body 4.5:1, secondary 4.5:1, accent at least 3:1 at display size.
`check-deck-contrast.mjs` reads the declared pairs. Do not "simplify" ember to
the paper accent; the brand red on the brand red is invisible.

## Shell

```css
* { box-sizing:border-box; margin:0; padding:0; }
em, i { font-style:normal; }                           /* mandatory, see below */
html, body, .slide, .slide * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html, body { background:#16130F; color:var(--ink); font-family:var(--f-sans); -webkit-font-smoothing:antialiased; }
body { min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:32px 0 72px; }

.topbar { position:fixed; top:0; left:0; right:0; z-index:50; display:flex; justify-content:center; gap:10px; padding:10px; background:rgba(22,19,15,.92); backdrop-filter:blur(6px); }
.topbar a { font:500 11px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:#D9D5CC; text-decoration:none; padding:8px 14px; border:1px solid rgba(255,255,255,.14); border-radius:999px; }
.topbar a:hover { border-color:var(--accent-olive); color:#fff; }

.deck { width:var(--slide-w); max-width:100vw; margin-top:36px; }

.slide {
  position:relative; width:var(--slide-w); height:var(--slide-h);
  background:var(--bg); color:var(--fg); overflow:hidden;
  margin:0 auto 28px; border-radius:var(--r); display:flex; flex-direction:column;
}
/* The frame under the mark and above the footer is 572px tall. A slide either
   centres in it (the default) or pins its first block to the top and its last
   to the bottom (.fill), so a base band of figures sits on the floor of the
   page instead of floating above a dead strip. */
.slide__inner { position:relative; z-index:2; flex:1; min-height:0; padding:var(--pad-y) var(--pad-x) 64px; display:flex; flex-direction:column; justify-content:center; }
.slide__inner.fill { justify-content:space-between; }
```

No box shadow on a slide. The deck sits on a dark surround and the surround is
the contrast. A shadow is the one thing that makes a paper slide look like a
screen.

## Chrome

Three elements on every slide but the cover. The mark carries the logo and the
number; the meta repeats brand and section at the foot; the page number sits
opposite. Nothing else. No accent bar, no top rule, no strip: the checkers fail
every one of those as a rail.

```html
<div class="mark"><span class="logo">{LOGO SVG}<span class="suffix">{SUFFIX}</span></span><span class="no">02</span><span class="dot"></span>{SECTION}</div>
<div class="meta">{BRAND}<span class="sep">&middot;</span>{SECTION}</div>
<div class="pageno"><strong>02</strong> / {N}</div>
```

```css
.mark { position:absolute; top:36px; left:var(--pad-x); z-index:3; display:flex; align-items:center; gap:10px; font:500 10px/1 var(--f-mono); letter-spacing:.2em; text-transform:uppercase; color:var(--fg-3); }
.mark .no { color:var(--fg); }
.mark .dot { width:5px; height:5px; border-radius:50%; background:var(--acc); }
.meta { position:absolute; bottom:36px; left:var(--pad-x); z-index:3; font:500 10px/1 var(--f-mono); letter-spacing:.18em; text-transform:uppercase; color:var(--fg-3); }
.meta .sep { margin:0 8px; color:var(--acc); }
.pageno { position:absolute; bottom:36px; right:var(--pad-x); z-index:3; font:400 11px/1 var(--f-mono); letter-spacing:.12em; color:var(--fg-3); }
.pageno strong { color:var(--fg); font-weight:600; }

/* the logo lockup takes its wordmark colour from the ground it sits on */
.logo { display:inline-flex; align-items:center; gap:7px; color:var(--fg); }
.logo svg { height:20px; width:auto; display:block; }
.logo .suffix { font:600 12px/1 var(--f-sans); letter-spacing:-.01em; color:var(--fg); transform:translateY(1px); }
.logo--cover svg { height:44px; }
.logo--cover .suffix { font-size:25px; transform:translateY(2px); }
.mark .logo { margin-right:12px; transform:translateY(-1px); }
```

## Type

```css
.eyebrow { font:500 11px/1 var(--f-mono); letter-spacing:.24em; text-transform:uppercase; color:var(--acc); margin-bottom:18px; }
.h1 { font:300 108px/0.94 var(--f-display); letter-spacing:-.042em; }
.h2 { font:300 46px/1.10 var(--f-display); letter-spacing:-.028em; }
.h2.md { font-size:40px; }
.h2.lg { font-size:52px; line-height:1.04; letter-spacing:-.032em; }
.h2.xl { font-size:68px; line-height:1.0; letter-spacing:-.038em; }
.h3 { font:400 30px/1.16 var(--f-display); letter-spacing:-.020em; }
.h4 { font:400 20px/1.30 var(--f-display); letter-spacing:-.015em; }
.lead { margin-top:16px; font:400 18px/1.55 var(--f-sans); color:var(--fg-2); }
.body-m { font:400 15px/1.55 var(--f-sans); color:var(--fg-2); }
.body-s { font:400 13px/1.5 var(--f-sans); color:var(--fg-2); }
.note { font:400 12px/1.5 var(--f-sans); color:var(--fg-3); }
.statement { font:300 26px/1.22 var(--f-display); letter-spacing:-.02em; color:var(--fg); }
.h1 em, .h2 em, .h3 em, .h4 em, .statement em { font-weight:500; color:var(--acc-2); }
.body-m em, .body-s em, .lead em { font-weight:500; color:var(--acc-2); }
em.gl { display:block; margin-top:.06em; }
strong { font-weight:600; color:var(--fg); }
.lab { font:500 10px/1 var(--f-mono); letter-spacing:.2em; text-transform:uppercase; color:var(--fg-3); margin-bottom:10px; }
.lab.acc { color:var(--acc); }
```

**Nothing slants.** `<em>` and `<i>` are italic by browser default and the
reset above is mandatory. Verify on the rendered page: computed `font-style`
must be `normal` on every text element. A sans forced into faux-oblique is the
ugliest thing this aesthetic can produce, and it is why emphasis is weight 500
in the accent.

**The trailing clause takes its own line.** When an `<em>` ends a heading, give
it `class="gl"` so it lands as a second beat rather than a ragged wrap. Only the
trailing clause; mid-sentence emphasis stays inline. This is also how a heading
in a narrow column is kept from breaking at whatever word the browser reaches.

**One heading per slide, and the running mark already names the section.** A
heading that needs a label above it is not doing its job; the eyebrow carries
the number and the section, nothing more.

## The frame: copy and drawing

```css
/* Copy and the drawing share the frame in an uneven split. The drawing is a
   real grid cell that can take half the page, so it is never a polite column
   on the right, and the split changes side and proportion from slide to slide. */
.split { display:grid; gap:44px; align-items:start; }
.split > * { min-width:0; }
.split.mid { align-items:center; }
.art { min-width:0; display:flex; justify-content:center; }
.art img { display:block; width:100%; height:auto; }
```

The proportions are set **per slide, inline**, because that is the point:

```html
<div class="split mid" style="grid-template-columns:440px minmax(0,1fr)">   <!-- drawing left, 440 -->
<div class="split"     style="grid-template-columns:minmax(0,1fr) 500px">   <!-- drawing right, 500 -->
<div class="split mid" style="grid-template-columns:minmax(0,1fr) 588px">   <!-- drawing right, dominant -->
```

Rules for the split:

- **Drawings run 360 to 588px.** Below 360 it is an icon; pick a different
  frame or drop it. The cover drawing is the exception: a 548px-tall portrait
  frame, absolutely positioned, because the cover has no footer to protect.
- **The drawing swaps sides at the turns.** Left on the ember slides, right
  elsewhere, so the two beats that change the argument look changed.
- **Landscape frames go in wide cells, portrait in tall ones.** A landscape
  frame in a 440px column is 300px tall and looks pinned; give it 588.
- **`minmax(0,1fr)`, never `1fr`.** `1fr` is `minmax(auto,1fr)`, so a nowrap
  value widens its own track and the drawing beside it shrinks to make room.
  This is also how one row of a table ends up ragged against the rest.
- **Anything with a long list under a heading uses `.fill`** on `.slide__inner`
  so the list sits on the floor. Anything that is a heading, a drawing and one
  component centres.

## The hero figure

One number the slide is almost entirely made of. Everything else on the slide
becomes a strip beside the drawing.

```css
/* 0.92 was tighter than the glyphs: at 150px the digits overflowed their own
   line box and printed across the label underneath, which no HTML check can
   see and check-deck-overlap.mjs caught on the PDF. */
.hero .n { font:200 150px/1.16 var(--f-display); letter-spacing:-.05em; color:var(--fg); white-space:nowrap; }
.hero .n small { font-size:54px; letter-spacing:-.02em; color:var(--acc-2); font-weight:400; margin-left:6px; }
/* 34px, not eyeballed: pdftotext reports the 150px figure's box running 27 CSS px
   below its own baseline on font descent, so anything closer prints under it.
   The digits have no descender, so on the page this reads as a normal gap. */
.hero .k { margin-top:34px; font:500 10px/1 var(--f-mono); letter-spacing:.18em; text-transform:uppercase; color:var(--acc); white-space:nowrap; }
.hero .d { margin-top:8px; font:400 15px/1.5 var(--f-sans); color:var(--fg-2); max-width:520px; }
```

```html
<div class="hero">
  <div class="n">$224<small>M</small></div>
  <div class="k">SOM</div>
  <p class="d">Saudi and UAE SME seats a year at list price. 7M employees at SAR 10 a month.</p>
</div>
```

The figure is bottom-up and the arithmetic is on the slide. A number with no
working beside it is a number the reader has to take on faith.

## Cover

Olive. The drawing is the only portrait frame in the library at its full
height, the title is the product name at 108px, and the headline is the one
sentence the deck exists to say.

```html
<section class="slide cover ol">
  <div class="cover-art"><img src="art/cover-on-dark.webp" alt="" /></div>
  <div class="slide__inner">
    <div class="cover-top">
      <div class="logo logo--cover">{LOGO SVG}<span class="suffix">{SUFFIX}</span></div>
      <div class="kicker">{KIND}<span style="color:var(--acc);margin:0 8px">&middot;</span>{STAGE}<span style="color:var(--acc);margin:0 8px">&middot;</span>{DATE}</div>
    </div>
    <div class="cover-copy">
      <div class="kicker acc" style="margin-bottom:36px">{POSITIONING}</div>
      <h1 class="h1">{PRODUCT}<em style="color:var(--acc)">.</em></h1>
      <p class="lead" style="font-size:30px;line-height:1.2;color:var(--fg);margin-top:20px">{HEADLINE} <em class="gl">{EMPHASIS}</em></p>
      <p class="body-m" style="margin-top:18px;color:var(--fg-3)">{ONE LINE OF FACT}</p>
    </div>
    <div class="cover-foot">
      <div class="cover-meta">
        <div><div class="k">{KEY}</div><div class="v">{VALUE}</div></div>
      </div>
      <div class="kicker acc">{CONFIDENTIAL}<span style="color:var(--fg-3);margin-left:8px">{WHERE THE REST IS}</span></div>
    </div>
  </div>
  <div class="pageno"><strong>01</strong> / {N}</div>
</section>
```

```css
.cover .slide__inner { justify-content:space-between; padding:40px var(--pad-x) 64px; }
.cover-art { position:absolute; top:92px; right:var(--pad-x); height:548px; z-index:1; }
.cover-art img { display:block; height:100%; width:auto; }
.cover-top { display:flex; align-items:center; gap:28px; }
.cover-copy, .cover-foot { width:740px; }
.kicker { font:500 9.5px/1 var(--f-mono); letter-spacing:.2em; text-transform:uppercase; color:var(--fg-3); }
.kicker.acc { color:var(--acc); }
.cover-foot { border-top:1px solid var(--line); padding-top:18px; display:flex; flex-direction:column; gap:14px; }
.cover-meta { display:flex; gap:30px; }
.cover-meta .k { font:500 9px/1 var(--f-mono); letter-spacing:.22em; text-transform:uppercase; color:var(--fg-3); margin-bottom:6px; }
.cover-meta .v { font:500 13px var(--f-sans); color:var(--fg); }
```

## Components

Every one paints with the trio, so all of them work on all three grounds
without a single override. Flat blocks and hairlines. **Never a coloured rail**:
no accent border-left, no accent border-top, no strip. "Us" is marked by a fill
with the border removed, which reads as a highlight rather than a fence.

```css
/* flat blocks */
.tint { background:var(--panel); border-radius:var(--r); padding:16px 20px; }
.tint.acc { background:var(--panel-acc); }
.card { border:1px solid var(--line-2); border-radius:var(--r); padding:16px 18px; }
.card.on { border-color:transparent; background:var(--panel-acc); }

/* a stacked list of claims, one hairline between each */
.stack > * { padding:12px 0; border-top:1px solid var(--line); }
.stack > *:first-child { padding-top:0; border-top:none; }

/* bullets: a dot, never a square, never an emoji */
.feat { display:flex; flex-direction:column; gap:11px; margin-top:16px; }
.feat li { list-style:none; display:flex; gap:12px; align-items:baseline; font:400 15px/1.5 var(--f-sans); color:var(--fg-2); }
.feat li::before { content:""; flex:0 0 5px; width:5px; height:5px; border-radius:50%; background:var(--acc); transform:translateY(-3px); }
.feat.tight li { font-size:13.5px; }
.feat.tight { gap:8px; }

/* numbered steps, marked by the numeral and a hairline above, not a bar */
.steps { margin-top:20px; display:grid; gap:12px; }
.steps.s7 { grid-template-columns:repeat(7,minmax(0,1fr)); }
.steps.s5 { grid-template-columns:repeat(5,minmax(0,1fr)); }
.step { padding-top:12px; border-top:1px solid var(--line-2); }
.step .n { font:500 10px/1 var(--f-mono); letter-spacing:.16em; color:var(--acc); margin-bottom:9px; }
.step .h { font:400 16px/1.2 var(--f-display); letter-spacing:-.015em; color:var(--fg); margin-bottom:6px; }
.step .d { font:400 11.5px/1.42 var(--f-sans); color:var(--fg-2); }
.steps.s5 .step .h { font-size:19px; }
.steps.s5 .step .d { font-size:12.5px; }

/* stat strip: a base band, so it belongs on the floor of a .fill slide */
.stats { margin-top:18px; display:grid; gap:0; border-top:1px solid var(--line-2); border-bottom:1px solid var(--line-2); }
.stats.s3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
.stats.s4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
.stats.s5 { grid-template-columns:repeat(5,minmax(0,1fr)); }
.stat { padding:16px 18px 16px 0; border-right:1px solid var(--line); }
.stat + .stat { padding-left:20px; }
.stat:last-child { border-right:none; }
.stat .n { font:300 46px/1 var(--f-display); letter-spacing:-.035em; color:var(--fg); white-space:nowrap; }
.stat .n small { font-size:20px; letter-spacing:-.01em; color:var(--acc-2); font-weight:500; margin-left:3px; }
.stat .k { margin-top:8px; font:500 10px/1 var(--f-mono); letter-spacing:.18em; text-transform:uppercase; color:var(--acc); white-space:nowrap; }
.stat .d { margin-top:7px; font:400 12px/1.42 var(--f-sans); color:var(--fg-3); }
.stats.s5 .stat .n { font-size:36px; }
.stats.s3 .stat .n { font-size:42px; }
/* the small strip that sits beside a hero figure */
.stats.sm .stat { padding:14px 12px 14px 0; }
.stats.sm .stat + .stat { padding-left:14px; }
.stats.sm .stat .n { font-size:34px; }
.stats.sm .stat .n small { font-size:16px; }
.stats.sm .stat .d { font-size:11.5px; }

/* columns */
.cols { display:grid; gap:34px; }
.cols.c2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
.cols.c3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
.cols.top { border-top:1px solid var(--line-2); padding-top:18px; }

/* label + value rows that share one track across the whole block */
.rows { display:grid; gap:0; }
.rows .row { display:grid; grid-template-columns:minmax(0,1fr) 132px; gap:16px; align-items:baseline; padding:9px 0; border-top:1px solid var(--line); }
.rows.narrow .row { grid-template-columns:minmax(0,1fr) 84px; gap:10px; }
.rows .row:first-child { border-top:none; }
.rows .row .h { font:400 15.5px/1.25 var(--f-display); letter-spacing:-.012em; color:var(--fg); white-space:nowrap; }
.rows .row .n { font:500 10px/1.5 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--fg-3); white-space:nowrap; }

/* table: hairlines, mono numerals, everything left aligned */
.tbl { width:100%; border-collapse:collapse; margin-top:14px; }
.tbl thead th { font:500 10px/1 var(--f-mono); letter-spacing:.18em; text-transform:uppercase; color:var(--fg-3); padding:10px 12px 10px 0; text-align:left; border-bottom:1px solid var(--line-2); }
.tbl tbody td { font:400 13.5px/1.4 var(--f-sans); color:var(--fg-2); padding:9px 12px 9px 0; border-bottom:1px solid var(--line); vertical-align:top; }
.tbl tbody td.cap { font-weight:600; color:var(--fg); white-space:nowrap; }
.tbl tbody td.num { font-family:var(--f-mono); font-size:13px; color:var(--fg); white-space:nowrap; }
.tbl.compact tbody td { padding:6.5px 10px 6.5px 0; font-size:12.5px; }
.tbl.compact thead th { padding:8px 10px 8px 0; }

/* a two-by-two: axes in mono, us filled, nobody dashed */
.matrix { margin-top:18px; display:grid; grid-template-columns:150px minmax(0,1fr) minmax(0,1fr); gap:10px; }
.matrix .ax { font:500 10px/1.5 var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--fg-3); display:flex; align-items:center; }
.matrix .ax.x { justify-content:center; padding-bottom:2px; }
.matrix .cell { min-height:104px; border:1px solid var(--line-2); border-radius:var(--r); padding:14px 16px; }
.matrix .cell.on { border-color:transparent; background:var(--panel-acc); }
.matrix .cell.none { border-style:dashed; display:flex; align-items:center; }
.matrix .cell .h { font:400 17px/1.2 var(--f-display); letter-spacing:-.015em; color:var(--fg); margin-bottom:6px; }
.matrix .cell.on .h { font-weight:500; color:var(--acc-2); }
.matrix .cell .d { font:400 12px/1.42 var(--f-sans); color:var(--fg-2); }
.matrix .cell.none .d { color:var(--fg-3); }

/* people */
.people { margin-top:20px; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.people.p2 { margin-top:0; grid-template-columns:repeat(2,minmax(0,1fr)); }
.person { border:1px solid var(--line-2); border-radius:var(--r); padding:14px 16px; }
.person.on { border-color:transparent; background:var(--panel-acc); }
.person .k { font:500 9.5px/1 var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--acc); margin-bottom:9px; white-space:nowrap; }
.person .name { font:300 23px/1.05 var(--f-display); letter-spacing:-.022em; color:var(--fg); margin-bottom:7px; white-space:nowrap; }
.person .d { font:400 11.5px/1.45 var(--f-sans); color:var(--fg-2); }

/* use of funds: a bar per line, the bar in the accent */
.funds { margin-top:12px; display:grid; gap:9px; }
.fund { display:grid; grid-template-columns:64px minmax(0,1fr); gap:16px; align-items:center; }
.fund .p { font:300 27px/1 var(--f-display); letter-spacing:-.025em; color:var(--fg); white-space:nowrap; }
.fund .t { font:400 13px/1.3 var(--f-sans); color:var(--fg-2); margin-bottom:6px; white-space:nowrap; }
.fund .t b { display:block; font-weight:600; color:var(--fg); margin-bottom:1px; }
.fund .bar { height:5px; border-radius:3px; background:var(--panel); overflow:hidden; }
.fund .bar span { display:block; height:100%; background:var(--acc); border-radius:3px; }

/* nothing wraps that the width allows on one line */
.eyebrow, .mark, .meta, .pageno, .kicker, .cover-meta .k, .cover-meta .v,
.lab, .step .h, .reg .k, .person .k, .person .name, .matrix .ax,
.tbl thead th, .tbl tbody td.num, .stat .n, .stat .k, .fund .p, .fund .t { white-space:nowrap; }
```

**A nowrap label wider than its track prints across its neighbour.** That is
the one way `white-space:nowrap` goes wrong, and it is invisible in the source.
Give a long label a wider track (`.rows.narrow` exists for the opposite case),
or shorten it. `check-deck-overlap.mjs` catches it on the PDF.

## Print

```css
@page { size:1280px 720px; margin:0; }
@media print {
  html, body { background:#fff; }
  body { padding:0; }
  .topbar { display:none !important; }
  .deck { width:var(--slide-w); margin-top:0; }
  .slide { margin:0; border-radius:0; break-after:page; }
  .slide:last-child { break-after:auto; }
}
```

`print-color-adjust:exact` lives in the shell, **outside** `@media print`, or
browsers drop every background and the olive cover prints as a white page with
near-white text on it. Verify with a PDF printed with backgrounds off and sample
the pixels; a computed style is not proof.

## Copy on the slide

The words are step 5 of the skill and are checked before the HTML exists. On
the slide itself, four things hold:

- **A stat an investor cannot price is padding.** Commit counts, package
  counts, lines of code. A slide that restates a figure from an earlier slide
  and then adds three more is that slide again, with padding.
- **Argue once.** A slide that makes its case three times in three paragraphs
  makes it once in three columns.
- **A figure carries its working.** SOM is bottom-up, on the slide: the
  population, the price, the arithmetic. A share of an analyst number is a
  guess with a citation.
- **Nothing inferred.** A duration subtracted from a date nobody stated is a
  claim nobody made. If the source does not say it, the slide does not.

## What this aesthetic explicitly avoids

- **Italics of any kind.** The reset is not optional.
- **A second font family**, a serif in any stack, or a serif fallback.
- **Heavy display weights.** 600+ at 44px and above reads as a default template.
- **A coloured rail anywhere**: accent bar on the cover, border-top on a
  column, border-left on a callout, a strip between sections. All of them fail
  `check-deck-rails.mjs`.
- **Drop shadows on slides**, gradients, a tinted callout with a coloured edge.
- **A drawing pinned in a fixed 260px column on every slide.** That is the
  template look, and it is what this spec replaced.
- **A dead band.** Content clustered at the top with nothing under it. Centre
  it or `.fill` it.
- **The same split on every slide.** `check-deck-rhythm.mjs` fails a deck
  where more than four slides in five share one composition.
- **Emoji, square bullets, dotted hairlines, a box shadow, `1fr` tracks.**

## Verify before handing off

- [ ] Computed `font-style` is `normal` on every text element
- [ ] No `ital@` in the Google Fonts URL; no serif in any stack
- [ ] `--f-display` resolves to the project's sans, not a guess
- [ ] Every `--on-*` and `--accent-*` value measured against its ground
- [ ] Drawings 360 to 588px wide; the cover drawing at 548px tall
- [ ] No two adjacent slides share a split, and the drawing swaps sides at the turns
- [ ] Every list-heavy slide uses `.fill`; every heading-and-one-thing slide centres
- [ ] The full check set passes, including `safearea`, `overlap` and `rhythm` on the PDF
- [ ] `print-color-adjust:exact` outside `@media print`, and a backgrounds-off PDF still shows the olive cover
