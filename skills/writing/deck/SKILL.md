---
name: deck
description: Generate a beautiful, self-contained HTML deck from a markdown file using the target project's design tokens (color palette, fonts) and its shared line-art library, so every slide carries a drawing in one hand. Copy is run through unslop and a plain-language check, so it gets to the point and carries no puffery and no engineering vocabulary. Default aesthetic is `straight` — the project's own sans as the display face, no italics ever, emphasis by colour and weight, fixed-size 1280×720 paper slides that print to PDF cleanly. Architected so additional aesthetics can be added later. Use when the user asks to turn markdown / a PRD / notes / a financial model / a pitch outline into HTML slides, an HTML deck, or a document. Triggers on phrases like "make a deck from", "render this as HTML slides", "turn this PRD into a deck", "build an HTML version of this".
license: MIT — Created for the Perspiva / Kaleido project family. Customize freely.
---
# /deck — Markdown → Branded HTML Deck

Take a `.md` file and produce a single self-contained HTML deck. The deck inherits the *target project's* design tokens (color palette, fonts) so it visually belongs to the project. Default aesthetic mimics the canonical reference: `examples/renovyn-financial-model.html`.

## When to invoke

- User points at a markdown file and asks for an HTML deck, slides, document, presentation, or financial-model render
- User shows the Renovyn `financial-model.html` (or similar) and says "do this for our project"
- User says "render the PRD as HTML", "make this a deck", "turn the notes into slides"

## Inputs

| Argument | Required | Default | Notes |
|---|---|---|---|
| `<input.md>` | yes | — | Path to a markdown file |
| `--project <path>` | no | cwd | Project root to read tokens from |
| `--aesthetic <name>` | no | **`straight`** | One of: `straight` · `editorial` · `clean` · `plain-outline`. See [Aesthetics](#aesthetics) below |
| `--colors "k:#hex,k:#hex"` | no | (auto) | Override / supplement detected tokens. Keys: `paper`, `ink`, `stone`, `accent`, `accent-deep`, `accent-bg` |
| `--fonts "display:Name,sans:Name,mono:Name"` | no | (auto) | Override detected fonts. `straight`/`clean` use `display` + `sans` (same family by default); `editorial` also takes `serif:`. Falls back to Geist / JetBrains Mono, plus Fraunces for `editorial` only |
| `--title "..."` | no | (from H1) | Cover title override |
| `--art` | no | on | Give every slide a drawing from the shared line-art library, drawing new frames only for ideas it does not already hold. Disable with `--no-art` |
| `--icons` | no | on | Include Iconify CDN. Adds ~12KB. Disables with `--no-icons` |
| `--charts` | no | off | Include ApexCharts CDN (~110KB). Auto-on when source has chart fences |
| `--3d` | no | off | Include Spline viewer CDN. Auto-on when source has `<!-- spline:url -->` directive |
| `--lottie` | no | off | Include lottie-web CDN. Auto-on when source references `.lottie.json` files |
| `--out <path>` | no | (see below) | Output path override |

## Output convention

Default output path mirrors the project's `_r&d/prd/` convention:

```
<project-root>/_r&d/decks/<slug>/<MM-DD>/<HH-MM>/deck.html
```

Where `<slug>` is derived from the input filename (kebab-case). Self-contained — no companion CSS, JS, or asset files. Web fonts loaded via `<link>` from Google Fonts. Prints cleanly to PDF via `window.print()` or browser save-as-PDF.

## Workflow

Execute these steps in order. Read the referenced files only when you need that step's context.

### 1. Resolve the input

- Read the markdown file. If the path is relative, resolve from cwd.
- If the file is not markdown (no extension or `.txt`), still attempt to parse — markdown features are graceful.
- If the input is a directory, look for `PRD.md` first, then `README.md`, then any `.md`.

### 2. Detect tokens from the target project

See `reference/token-detection.md` for the full procedure. Summary:

1. Read `<project>/CLAUDE.md` — search for a "Design Tokens" / "Brand & Copy" / "Design System" section. Extract any `#hex` values and the labels next to them.
2. Read `<project>/app/globals.css` (or `src/styles/globals.css`, or `index.css`) — extract `--color-*` custom properties from `:root` or `@theme` blocks.
3. Read `<project>/app/layout.tsx` (or equivalent) — extract Google Font imports and CSS variable names.
4. Build a token map. The keys the aesthetic needs are: `paper`, `ink`, `ink-soft`, `stone-dark`, `stone`, `stone-light`, `mist`, `accent`, `accent-deep`, `accent-bg`. Map the project's tokens to these slots — see `reference/token-detection.md` for the mapping heuristic.
5. **Apply user `--colors` overrides on top** — explicit user input wins.

**Paper defaults to white.** Decks default to `--paper: #FFFFFF` regardless of the project's UI background. A project's warm bg (e.g. Perspiva's `#F0ECE6`) is for the *running app*, not for slide canvases — slides read sharper on white. Override with `--colors "paper:#XXXXXX"` only when the user asks for tinted paper or the project explicitly names a deck background.

The `accent` token does pick up the project brand — that's the whole point. Background tinting is the exception, accent inheritance is the rule.

If a project has *no* tokens (e.g. CLAUDE.md missing), fall back to the chosen aesthetic's defaults.

### 3. Choose aesthetic

- **Default: `straight`** (the house style — project's sans, nothing slants)
- Read `reference/aesthetics/<name>.md` for the full aesthetic spec — slide structure, CSS variables, typography, slide template HTML, print rules.
- Validate the requested aesthetic exists; if not, fall back to `straight` and warn the user.
- Only depart from `straight` when the user names another aesthetic, or when the project genuinely ships a serif and wants an editorial voice.

### 4. Map markdown content to slide templates

See `reference/content-mapping.md` for the full mapping rules. Summary:

| Markdown construct | Slide template |
|---|---|
| First H1 + paragraph + meta block | **Cover** slide |
| H2 (top-level section) | **Section divider** slide (or content slide if it has body) |
| H3 + paragraphs + lists | **Content** slide |
| Markdown table | **Table** slide |
| H2/H3 followed by 3–4 stat-style bullets (`**Label**: value`) | **Stat row** slide |
| Block quote | **Pull-quote** slide (or callout in current slide) |
| `<!-- slide -->` comment | Force a new slide break |
| `<!-- aesthetic: X -->` HTML comment | Override aesthetic for that slide |
| `<!-- skip -->` | Drop section from the deck |

Group content into 1280×720 slides. If a section overflows, split into continuation slides labelled `Section title (cont.)`.

### 5. Write the words

**Do this before the HTML exists.** Rewriting copy inside a rendered deck means
re-checking every line break, and it is where fluff survives, because a sentence
that already sits neatly on a slide stops getting read.

**Run the `unslop` skill over every string the deck will carry.** Headlines,
leads, table cells, labels, footnotes, the cover, the appendix. It binds
internal decks as much as external ones.

Then hold every line to these four, which are what a deck specifically gets
wrong:

1. **Say the thing, then stop.** A slide headline states the claim in one
   clause. "The riskiest days are the ones nobody watches" is a headline. "An
   overview of our approach to the post-discharge period" is a table of
   contents entry wearing a headline's clothes. If a heading needs a label above
   it to make sense, the heading is not doing its job.
2. **Write it the way a person in that room would say it.** Use the audience's
   own trade language and none of your own. A clinical director says cohort,
   discharge, aftercare, caseload, safeguarding; they do not say pipeline,
   schema, roll-up, export, or binary. A salesperson says accelerator, band,
   quota and pipeline, and for them pipeline is the right word. The test is not
   "is this word simple", it is "would the reader use this word".
3. **Never describe the software the way the software describes itself.** This
   is the single biggest source of jargon in a product deck, and it reads as
   though nobody translated. `check-deck-plain.mjs` fails a deck for it:

       node '_r&d/scripts/check-deck-plain.mjs' <deck>.html

   It reads only visible copy, so class names and comments are safe. A word that
   is genuinely the audience's own gets declared in the deck rather than argued
   about: `<meta name="deck-plain-ok" content="pipeline">`.
4. **Cut every sentence that would read the same on any other project.** Name
   the number, the mechanism or the file instead of the feeling about it. If a
   line survives a find-and-replace of the company name, it is filler.

Two hard bans, from the house style and enforced by check:

- **No em dash and no en dash**, anywhere a person reads. Split the sentence or
  use a comma. No hyphen-as-dash and no parentheses standing in for one.
- **Never "AI"** in user-facing copy. "Smart" or "intelligent", or better, name
  what it actually does.

And the density budget: **no body paragraph over 45 words on a numbered slide**,
enforced by `check-deck-density.mjs`. A slide that needs more than that is two
slides, or it is a document.

### 6. Imagery

Read `reference/imagery.md` before touching art. The short version:

**If the project has no library yet, install one.** One command, from the
project root:

    node ~/.claude/skills/deck/scripts/install-art.mjs

That copies the thirty originals, the art pipeline and the fourteen deck
checkers in, and writes a `palette.json`. Edit the palette to the project's own
ink and accent, then `--repaint`. The project now has the same thirty drawings
in its own colours, and it cost no API calls, because every frame was drawn once
white-on-black and colour is applied afterwards. That is the whole reason two
projects can read as one hand.

Paths below assume the default install (`_r&d/scripts`, `_r&d/decks/_art`). Both
art scripts take `--art=<dir>` or `DECK_ART_DIR` if a project puts its library
somewhere else.

1. **Look before you draw, and match on meaning.**
   `node '_r&d/scripts/gen-deck-art.mjs' --list` prints every frame with its
   shape and subject. Ask what each slide actually *means*, then ask whether a
   frame holds that. A slide about a threshold uses the doorway that exists. A
   slide about a decision does not, however doorway-shaped the layout is: a
   drawing that means something other than the slide is worse than no drawing,
   because a reader feels the mismatch before they can name it.

   **The library is a guide, not a rule.** It exists so a project does not draw
   five near-identical doorways, not so every idea gets bent to fit thirty
   shapes drawn for someone else's deck. Reuse where the meaning is genuinely
   the same. Draw where it is not.
2. **Draw the gaps with one command.**

       node '_r&d/scripts/add-frame.mjs' <id> "<subject>" --shape=landscape

   It appends the frame, draws it, and runs the cut-out check. `{figure}` in a
   subject becomes the house figure, so every person in the set is drawn by one
   hand. `--busy` keeps the dimension arrows, `--tint=<mode>` writes an extra
   repaint, `--no-draw` registers without spending a call.

   It lints the subject first, against three failures that each cost a redraw of
   a whole batch: "on a surface" ships a solid rectangle, a "ruled ground plane"
   attaches pseudo-numerals, and "drawn in orange-red" gets a glow with no edge
   to key. They are warnings, not refusals.

   **A frame that fails is a subject problem, not a seed problem.** Two bad
   draws means rewrite the subject; a third identical retry is the thing that
   never works.

   A frame that earns its place belongs back in `~/.claude/skills/deck/art/` so
   the next project inherits it rather than drawing its own near-copy.

   A project whose ideas are entirely its own can start with none of these
   drawings at all: `install-art.mjs --fresh` installs the pipeline and the
   subject list, and the project draws all thirty itself.
3. **Check it is a cut-out.** `node '_r&d/scripts/check-art-alpha.mjs'`. A frame
   whose ground was never keyed writes a perfectly valid file and only shows up
   as a visible box once it is on a slide.
4. **Copy the frames the deck uses into `<deck>/art/`** so the folder is
   portable, and reference them from there rather than across the repo.

Skip this step only on `--no-art`.

### 7. Render the HTML

- Build a single HTML file with `<style>` block (no external CSS).
- Header: load Google Fonts via `<link>` (use only fonts the aesthetic needs).
- CSS `:root` block: project tokens mapped to the aesthetic's variable names.
- Fixed slide dimensions per aesthetic spec.
- Include a top-bar with "Download PDF" → `javascript:window.print()` and "View as deck" → top of page anchor.
- Include `@page` and `@media print` rules so the deck prints to crisp PDF without browser chrome.
- Each slide gets a slide mark (top-left), slide number (bottom-right), and footer meta (bottom-left).

### 8. Write to disk

- Compute output path: `<project-root>/_r&d/decks/<slug>/<MM-DD>/<HH-MM>/deck.html` (use today's date and current time).
- `mkdir -p` the parent directories.
- Write the HTML file.

### 9. Check it, then report

A deck is not finished when it renders. Print it and run the gauntlet, because
three of these faults are invisible in the source and one is invisible on
screen:

    # print first: two of the checks read the PDF, not the HTML
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      --headless=new --disable-gpu --no-pdf-header-footer \
      --virtual-time-budget=15000 --user-data-dir=/tmp/deck-print \
      --print-to-pdf="$PWD/<deck>.pdf" "file://$PWD/<deck>.html"

    for c in plain density figures grounds rails claims duplication alignment chrome assets rhythm; do
      node "_r&d/scripts/check-deck-$c.mjs" <deck>.html || echo "FAILED $c"
    done
    node '_r&d/scripts/check-deck-safearea.mjs' <deck>.pdf   # nothing clipped
    node '_r&d/scripts/check-deck-overlap.mjs'  <deck>.pdf   # nothing printed over

The two PDF checks earn their place:

- **`safearea`** rasterises each page and looks for ink inside the margin.
  Clipping never appears in the source: the CSS is valid, the browser prints
  without complaint, and the drawing simply runs off the paper.
- **`overlap`** reads the PDF's word boxes and fails when text prints on top of
  text. A slide taller than its stage does not clip and does not run off the
  page. It lands on the footer, and two paragraphs print through each other,
  which `safearea` passes happily because the ink is nowhere near the margin.

Chrome does not exit after `--print-to-pdf`. Wait for the file size to settle,
then `pkill -f headless`. Never run two headless instances at once: they share a
profile and silently drop each other's output.

Then report to the user in the shape under [Reporting](#reporting).

## Aesthetics

Four are shipped today. **Default to `straight`.** Pick another only when the user names it — see each spec for full CSS, slide templates, and "what this aesthetic explicitly avoids":

| Aesthetic | Mood | Best for | Spec |
|---|---|---|---|
| **`straight` (default)** | **House style. The project's own sans as the display face, light weights, tight tracking. Nothing slants; emphasis is colour + weight. Three grounds, a drawing on every slide at 360 to 588px, the split set per slide, hairlines only and never a rail.** | **Everything, unless told otherwise. Client decks, comparisons, product and sales decks, any project that ships a sans and no serif.** | `reference/aesthetics/straight.md` |
| `editorial` | Refined, warm, paper feel. Fraunces serif + sans + mono. Italic emphasis. Renovyn-style. | Investor decks, brand stories, financial models, founder narratives — where a serif voice is genuinely wanted | `reference/aesthetics/editorial-renovyn.md` |
| `clean` | Pure minimalist. Sans-only, extra-light. Chrome stripped to a slide number, solid hairlines, pale surround. | When even `straight`'s chrome is too much — engineering decks, design reviews | `reference/aesthetics/clean.md` |
| `plain-outline` | Schematic / blueprint. Outlined cards, 1px hairlines, mono labels. Uppercase headlines. | Architecture, infrastructure, financial schedules, technical reviews — anything that benefits from grid presentation | `reference/aesthetics/plain-outline.md` |

**`straight` vs `clean`** — both are sans-only and italic-free. `straight` keeps editorial's furniture (slide-mark, footer-meta, dotted rules, accent bar, dark surround); `clean` strips it to a slide number on a pale surround with solid rules. Reach for `clean` only when asked for something barer.

The architecture is open: dropping `reference/aesthetics/<name>.md` adds a new aesthetic. No central registry.

## Rich media — icons, charts, 3D, animation

**Always include Iconify by default** (~12KB). Beautiful icons everywhere a label could carry one — eyebrows, stat-cards, table cells. Browse 200k+ icons at icon-sets.iconify.design.

```html
<iconify-icon icon="ph:trend-up-bold" width="24" height="24" style="color: var(--accent);"></iconify-icon>
```

**Add charts (ApexCharts) when the content has data**:

- Markdown table with numeric columns → consider rendering as both a table slide AND a chart slide
- Markdown code fence with ```chart language → render as inline ApexCharts
- For editorial aesthetic: prefer hand-rolled inline SVG bar charts (matches the typography)

**Add 3D (Spline)** for hero / concept slides — never on data slides:

- HTML comment directive in markdown: `<!-- spline: https://prod.spline.design/SCENE-ID/scene.splinecode -->`
- Renders as full-width `<spline-viewer>` element

**Add Lottie** for vector animation:

- Markdown image with `.lottie.json` extension → render as `<div>` with `lottie.loadAnimation()`

**Conditional CDN inclusion** — never load libraries the deck doesn't use. Each library adds weight; deck is self-contained but should still be lean. The skill auto-detects which libraries to include based on source content, then writes only the needed CDN `<script>` tags into `<head>`.

See `reference/icons-and-charts.md` for full CDN URLs, usage patterns, sizing rules, themeing, and graceful CDN-failure fallback.

## Forbidden patterns (across all aesthetics)

These are the "AI slop" patterns that make decks feel generated rather than designed. **Never emit:**

- **Tinted callout boxes with colored left border** (`background: var(--accent-bg); border-left: 3px solid var(--accent);`) — feels like a system note. Use the type-only emphasis patterns in each aesthetic spec instead.
- **Drop shadows on slide bodies** — slides float on the page surround, not on shadows
- **Hard corners** (`border-radius: 0`, or a reset that zeroes it). House rule: containers, chips, buttons and the slide surface are curved; only hairline rules, table separators and text stay square
- **Gradient backgrounds inside slides** — the slide is paper, not a screen
- **Solid color strips dividing slide content** — only the top color-bar (decorative chrome) is allowed
- **Emoji as decoration** — use Iconify; emoji are inconsistent across renderers
- **Stock photography or a second illustration style** — one deck, one hand. If
  the idea is not in the library, draw it *into* the library rather than beside it
- **A drawing that means something other than its slide** — reaching for the
  nearest existing frame because it is there. Reuse is for when the meaning
  matches; when it does not, `add-frame.mjs` costs one call
- **A drawing sitting in a bordered or filled box** — the frames carry real
  transparency precisely so they need no container
- **Default to dark mode** — paper is light unless user opts into a dark aesthetic explicitly
- **Faux-italic on a sans** — most sans faces ship no true italic, so the browser synthesises a skew and it looks broken. In `straight`/`clean`, emphasise with colour + weight. `straight` bans slant outright (`em, i { font-style: normal }`)
- **A serif in the fallback chain of a sans stack** (`'Geist', Georgia, serif`) — that's what actually renders while the webfont loads, and forever on a machine that can't fetch it. End sans stacks with `sans-serif`
- **Cyan-on-dark / purple-blue gradients / neon glow** — see `frontend-design` skill's color reference for what to avoid
- **Puffery**: leverage, delve, pivotal, tapestry, seamless, robust, groundbreaking, showcase, foster, realm, landscape, testament, underscore, crucial, enhance, comprehensive, world-class, best-in-class, cutting-edge. Kill on sight, and `check-deck-plain.mjs` fails a deck that keeps one
- **Engineering vocabulary in a slide**: binary, schema, deterministic classifier, metadata, roll-up, aggregation, identifier, append-only, production, UTC, payload, endpoint. Describe what the reader gets, not what the code is called. A word that is genuinely the audience's own trade language is declared in the deck: `<meta name="deck-plain-ok" content="pipeline">`
- **Em dashes and en dashes** in any string a person reads. A comma or a full stop, never a hyphen-as-dash or parentheses standing in for one
- **The literal string "AI"** in user-facing copy. Say "smart", or better, say what it does
- **"Not just X, but Y"**, forced groups of three, and fancy ways to say "is" (serves as, stands as, boasts, features)
- **A heading with a label above it that only restates it** — the running head already names the section

## Reference files (read only when needed)

- `reference/imagery.md` — the shared line-art library, how to look a frame up, how to draw a missing one, colour and tints, and how to adopt the pipeline in another project
- `checks/` — the fourteen deck checkers this skill installs into a project, and runs in step 9
- `art/` — the thirty originals and the art pipeline, which `scripts/install-art.mjs` copies into a project
- `reference/token-detection.md` — how to extract tokens from a project, mapping heuristic, white-default rule
- `reference/content-mapping.md` — markdown → slide template rules, edge cases
- `reference/icons-and-charts.md` — Iconify, ApexCharts, Spline, Three.js, Lottie — CDN URLs, usage, themeing
- `reference/aesthetics/straight.md` — **the default** — house sans aesthetic, no italics
- `reference/aesthetics/editorial-renovyn.md` — editorial aesthetic spec
- `reference/aesthetics/clean.md` — minimalist sans-only aesthetic
- `reference/aesthetics/plain-outline.md` — schematic / blueprint aesthetic
- `examples/renovyn-financial-model.html` — canonical output reference. Open it for ground-truth visual quality.

## Adding new aesthetics

To add a new aesthetic (e.g., `brutalist`, `minimal`, `dark-cinema`):

1. Create `reference/aesthetics/<name>.md` with: CSS `:root` variables, slide structure, typography, slide template HTML examples, print rules.
2. List it in this SKILL.md's "Inputs" table description if discoverable.
3. Test by passing `--aesthetic <name>` to a sample render.

The skill picks aesthetics by filename match — no central registry to update.

## Quality bar

A successful deck:

- Opens in any modern browser, no setup
- Prints to PDF with each slide on its own page (no clipping, no browser chrome)
- Uses the project's brand color as the primary accent (not the aesthetic default)
- Has at least one cover slide and one content slide
- Slides do not overflow the 1280×720 frame — if content is too long, split or trim
- **No dead band.** The frame under the mark and above the footer is 572px. A slide either centres in it (`.slide__inner`, the default) or pins its first block to the top and its last to the floor (`.slide__inner.fill`), so a stat strip lands on the bottom of the page. Content clustered at the top with nothing under it has not been placed, it has been left
- **The composition changes.** Copy and drawing share the frame in an uneven split set per slide, drawings run 360 to 588px, and the drawing swaps sides at the turns of the argument. `check-deck-rhythm.mjs` fails a deck where one composition carries more than three slides in five, or three in a row. Fourteen slides on one grid read as a template at thumbnail size, whatever the type
- **Every non-obvious number in the CSS carries its measurement.** `line-height:1.16` because 0.92 printed the digits over the label; `margin-top:34px` because pdftotext puts the figure's box 27px below its baseline. A number with no reason beside it is the one the next person "tidies" back into a fault
- **Nothing wraps that would fit on one line.** The slide body is 1104px wide (1280 minus padding). Do not cap `.lead`, `.cover-sub`, headlines or notes with a `max-width` that forces a second line; cap only when the measure genuinely needs it and the text still fills the line. Eyebrows, labels, stat captions, meta rows, table headers and numbers carry `white-space: nowrap`. A footer or meta row that overflows gets shorter copy or a smaller gap, not a wrapped item. If a line cannot fit, break it deliberately at a clause (`<em class="gl">`) or shrink the size; never let the browser pick the break
- **Accent clauses that end a heading get their own full line** (`<em class="gl">`) — mid-sentence emphasis stays inline. In `straight` that emphasis is colour + weight; in `editorial` it's italic serif
- **Nothing slants in `straight`** — verify on the *rendered page*, not the stylesheet: every text element's computed `font-style` must be `normal`. `<em>`/`<i>` are italic by browser default, so the reset is mandatory
- **Every slide carries a drawing**, dividers and appendix included, unless the
  user passed `--no-art`. A slide with a heading and three bullets and nothing
  else is a document page, not a slide
- **Every drawing is a real cut-out**, proven by `check-art-alpha.mjs`, and sits
  in a grid cell with `min-height:0` and `object-fit:contain` so it can only
  shrink to fit. Absolutely positioned art is what runs off the edge of a page,
  and that never shows up in the source
- **Every string passed `unslop`**, and `check-deck-plain.mjs` finds no puffery
  and no engineering vocabulary. A deck that describes the software the way the
  software describes itself has not been written, only transcribed
- **No body paragraph over 45 words** on a numbered slide, proven by
  `check-deck-density.mjs`. Longer than that is a document page
- **No text prints on top of other text**, proven by `check-deck-overlap.mjs`
  against the PDF. A slide taller than its stage lands on the footer, and that
  fault is invisible in the source and passes the safe-area check
- Typography hierarchy is clear: display > heading > body > caption > footnote
- No "AI slop" aesthetics (cyan-on-dark, purple gradients, neon glows) — see `frontend-design` skill's color-and-contrast reference for what to avoid

## Failure modes

- **Project has no tokens at all** → fall back to aesthetic defaults, warn the user
- **Markdown has no H1** → infer title from filename, warn the user
- **Markdown is huge (>30 sections)** → tell the user the section count and ask whether to render all of it or cut to the sections the audience needs
- **Output dir not writable** → fall back to cwd `/deck-<slug>-<timestamp>.html`

## Reporting

After writing the file, report to the user:

```
Deck written: <path>
  Slides: N
  Aesthetic: straight
  Tokens source: project (CLAUDE.md + globals.css)  |  defaults  |  user override
  Brand color: #XXXXXX
  Art: N frames, M reused from the library, K newly drawn  |  none (--no-art)
  Display font: <resolved project sans>  (straight/clean only)
  Open: open <path>
  Print: open in browser → cmd-P → save as PDF
```
