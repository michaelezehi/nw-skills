---
name: the-broadside
description: Install the broadside editorial slide-deck design system into the current React/Next.js project. Asymmetric horizontal-snap story flow with 9 numbered layout variants invokable by version (v1 Split, v2 Overlay, v3 CardsSide, v4 CardsTop, v5 Scatter, v6 Portrait, v7 Agency, v8 Poster, v9 Magazine), monochrome film-grain photography, single signal-accent color, paired ink+accent side chevrons, and a 3-card bottom strip. Detects framework, installs deps, drops self-contained components with a chosen color theme baked in. Themes ship as named accents (signal, coral, lime, cobalt, mustard, sage, ember) — pick which one becomes the flow's signal color. Composes pages via three modes — explicit (e.g. `v1 v7 v8`), `--random`, or `--smart` (DEFAULT, content-aware variant selection). Hero slide is always full vh/vw with one of the hero-suitable variants (v2 / v6 / v8 / v9). Idempotent — safe to re-run to upgrade. Invoke with `--list` to print the full catalog without installing.
disable-model-invocation: true
---

# the-broadside

A *broadside* is a large single-sheet print used for declarations, manifestos, and bold poster art. This skill installs the editorial slide-deck design system that runs on the same instinct: **asymmetric grids, oversized monochrome imagery with film-grain, mixed-case Geist typography, a single signal-accent that punches through the B&W**, and a horizontal-snap story flow that turns marketing pages into deliberate sequences.

## When to use

The user wants to:
- Install a story-driven slide deck on a new page (`/companies`, `/about`, `/why-us`, etc.)
- Add an editorial composition system to an existing React/Next.js project
- Replace a generic landing-page hero with a multi-slide story flow
- Theme a sequence of slides with a specific brand accent color

## What gets installed

```
src/components/<base>/
├── tokens.ts             — palette + getAccent(flow) helper
├── slide.tsx             — Frame, Plate, Pagination, BottomCards, AccentDot, types
├── layouts.tsx           — v1–v5: Split / Overlay / CardsSide / CardsTop / Scatter
├── layouts-extended.tsx  — v6–v9: Portrait / Agency / Poster / Magazine + SerifAccent
├── versions.tsx          — numeric registry + <EditorialVersion version={1..9} />
├── chevrons.tsx          — left/right nav with paired ink + accent outline
├── container.tsx         — outer story container (close button, sign-in/up chrome, snap scroll)
├── pagination.tsx         — minimal inline pagination dots
└── index.ts              — barrel exports
```

Each slide gets `<EditorialFrame>` → one of the 9 layout components → done. Pop in the eyebrow, headline, intro, image, cards, and pagination — the layout decides where each slot lands. Or invoke any variant by number via `<EditorialVersion version={N} {...props} />`.

## The 9 layout variants

| # | Variant | Composition | Best for |
|---|---|---|---|
| **v1** | **Split** | Text + image side-by-side, 3 cards bottom strip. `imageSide` flips left/right | Default rhythm, most slides |
| **v2** | **Overlay** | Image dominates, headline overlaid in bold uppercase, dark/red/light bottom band | Hero, closing CTA — dramatic |
| **v3** | **CardsSide** | Text+image stacked left, 3 cards stacked vertical right | Feature lists, artefact arrays |
| **v4** | **CardsTop** | 3 cards on top, split text+image below | Comparison rows, was→is |
| **v5** | **Scatter** | Asymmetric 12-col grid — eyebrow, headline, intro, image, cards in distinct cells | Dense story slides, mocks |
| **v6** | **Portrait** | Bold mixed-weight headline + oversized serif numeral + vertical accent rule + outlined CTA, full-height portrait right, caption bottom-right | Editorial portraits, brand intros |
| **v7** | **Agency** | Tri-column — accent-block hero + serif wordmark left, diagonal-slashed headline + image-card pair + accent CTA center, side card + aside + social links right | Agency-style multi-cell flagship slides |
| **v8** | **Poster** | Single oversized centered uppercase headline filling canvas, radial vignette of background image, optional accent CTA, pagination at bottom-center | Manifesto, closing thesis, hero declaration |
| **v9** | **Magazine** | Masthead band top, hero image left with oversized numeral overlay, narrow text column right with accent rule + inline CTA | Magazine-cover storytelling, chapter openers |

Mix variants across slides for visual rhythm. Each takes the same base prop shape — swapping a slide's variant is a one-line change.

### Per-variant extras

Beyond the shared `EditorialLayoutProps` (eyebrow, headline, intro, imageSrc, imageObjectPosition, visual, cards, pagination, aside), the extended variants accept optional slots:

| Prop | Used by | Purpose |
|---|---|---|
| `numeral` | v6, v8, v9 | Oversized page/issue number (serif italic in v6, sans bold in v9) |
| `wordmark` | v7 | Bottom wordmark overlaid on the accent block (serif italic) |
| `cta` | v6, v7, v8, v9 | `{label, href}` button (outlined in v6, full-width in v7, filled in v8, inline-arrow in v9) |
| `socialLinks` | v7 | Stacked footer links |
| `brandMark` | v6, v7 | Top-corner brand mark (defaults: `W.` for v6, crown for v7) |
| `caption` | v6, v9 | Small caption text |
| `nav` | v6 | Top eyebrow chips (string[]) |
| `imageSide` | v1 | `'left' | 'right'` |

### Numeric invocation

```tsx
import { EditorialFrame, EditorialVersion } from '@/components/broadside';

<EditorialFrame>
  <EditorialVersion version={7} eyebrow="Agency" headline={…} imageSrc={…} cards={[…]} />
</EditorialFrame>
```

`EditorialVersion` forwards extra props (`imageSide`, `numeral`, `wordmark`, etc.) to whichever underlying component matches the version. `getEditorialLayout(N)` returns the raw component if you need it.

## `--list` flag

When invoked as `/the-broadside --list`, print the two tables above (themes + 9 variants) and **stop** — do not run any installation workflow. Useful for catalog recall without modifying the filesystem.

## Page composition modes

When generating a full page (one `<EditorialFrame>` per slide), the skill picks variants according to one of three modes. **`--smart` is the default** — run it whenever the user gives intent but no explicit list.

### Mode 1: explicit — `v1 v7 v8` / `v1,v7,v8`

User passes a space- or comma-separated sequence of version numbers. The skill generates one slide per token, in order, using the named variant. Example:

```
/the-broadside v6 v1 v3 v8
```

→ four slides: Portrait hero, Split, CardsSide, Poster close. Keep the user's order; do not reorder for "balance."

### Mode 2: `--random`

The skill rolls all 9 variants with bias-toward-rhythm: shuffle into a queue, then walk slide-by-slide, but never repeat the same variant twice consecutively. Slide count comes from the user's content (one slide per chapter / section). If no content given, default to 5 slides.

The hero rule (below) still applies: slide 1 is randomly drawn from {v2, v6, v8, v9} only.

### Mode 3: `--smart` (DEFAULT)

The skill reads the user's content (PRD, outline, copy, or conversation context) and picks the variant that matches each slide's shape. This is the default — invoking `/the-broadside` with content but no flag should always run smart mode.

**Smart selection rules — pick the FIRST matching rule per slide:**

| Slide signal | Variant |
|---|---|
| Slide 1 (any content) → hero rule (see below) | one of {v2, v6, v8, v9} |
| Last slide is a closing CTA / manifesto / declaration | **v8 Poster** |
| Slide has a `numeral` / chapter number AND a hero image | **v9 Magazine** |
| Slide is about a person, portrait image, brand intro tone | **v6 Portrait** |
| Slide has 3+ stakeholders OR multi-cell brand mark + wordmark + side card | **v7 Agency** |
| Slide is a comparison / before→after / was→is (cards present, headline lighter) | **v4 CardsTop** |
| Slide has 3 cards AND text-heavy bodies (features explained) | **v3 CardsSide** |
| Slide has many micro-slots (eyebrow + headline + intro + image + 3+ cards + aside) | **v5 Scatter** |
| Slide is image-dominant with bold short headline overlaid | **v2 Overlay** |
| Otherwise (default rhythm: headline + intro + image + 3 cards) | **v1 Split** |

Avoid using the same variant twice in a row unless the content clearly demands it.

### Hero rule (applies to ALL three modes)

Slide 1 of every generated page is the **hero**. It must:

1. Be one of the hero-suitable variants: **v2 Overlay, v6 Portrait, v8 Poster, v9 Magazine**. These four have the typographic weight and image dominance to anchor a page.
2. Render full **viewport height AND width** — `min-h-screen w-screen` on the outermost frame element, no max-width wrapper. The hero overrides any container padding from `BroadsideContainer`.
3. In smart mode, hero variant selection follows: **portrait/person → v6**; **manifesto/declaration → v8**; **chapter/numeral → v9**; **image-dominant cinematic → v2**.

If the user passes an explicit sequence that puts a non-hero-suitable variant in slot 1 (e.g. `/the-broadside v1 v3 v8`), **warn once and substitute the closest hero candidate** (v1 → v2, v3 → v6, v4 → v9, v5 → v9, v7 → v6). Tell the user what you swapped.

### Selecting the slide count

- Explicit mode: from the token list length.
- `--smart`: from the content's natural section count (one slide per heading / chapter / list section). If unclear, default to 4.
- `--random`: default 5 unless user passes `--count=N`.

## Theme catalog

The skill takes a `--theme` (or asks the user) and bakes the accent into `tokens.ts`. Each theme is a `{bg, ink, isLight}` triple — `isLight` flips text-on-accent to dark when the accent surface is bright.

| Theme | Accent bg | Ink-on-accent | Vibe |
|---|---|---|---|
| `signal` | `#E5301B` | white | Bold, urgent, editorial-red |
| `coral` | `#F26B5E` | white | Warm, humanistic |
| `lime` | `#E8FF00` | dark `#111100` | Youthful, electric |
| `cobalt` | `#2952FF` | white | Confident, professional |
| `mustard` | `#D4A33A` | dark `#1A1308` | Warm, refined editorial |
| `sage` | `#5C6B55` | white | Calm, considered |
| `ember` | `#FF6A2B` | white | Energetic orange |

Pick one as the project's primary signal. If the project has multiple flows (employer/talent/graduate), run the skill once per flow with a different theme — `tokens.ts` is built to extend.

## Workflow

### Step 1 — Detect framework
Read `package.json`. Confirm React (must have `react` >= 18). Note presence of:
- `next` → Next.js (App Router or Pages)
- `vite` → Vite + React
- `motion` → already present, skip install. If only legacy `framer-motion` (≥11) is present, skip install too — but rewrite the template imports from `'motion/react'` to `'framer-motion'` when writing files.
- `@phosphor-icons/react` → already present, skip install

If neither Next nor Vite is detected, ask the user which framework they're using.

### Step 2 — Decide install path
Default base: `src/components/sections/broadside/`.
If the project already has `src/components/sections/`, install there. Otherwise drop into `src/components/broadside/`.
Confirm path with user before writing.

### Step 3 — Pick theme
Use `AskUserQuestion` to offer the 7 named themes. Show the accent color hex in each option's description. Allow custom — if user picks "Other", ask for a hex.

If the user wants multiple flows (e.g. "I want red for companies, coral for talent"), capture that as a comma-separated list and have the skill emit a multi-flow `tokens.ts`.

### Step 4 — Install dependencies
Detect package manager (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm). Run:
```
<pm> add motion @phosphor-icons/react
```
Skip any that are already present. (`motion` is the successor to `framer-motion` — same API, imported from `motion/react`. Never install `framer-motion` fresh; it's no longer developed.)

### Step 5 — Read each template, substitute, write
Templates live in `templates/` next to this SKILL.md. Each is the real component file with `{{PLACEHOLDER}}` tokens for theme values.

| Placeholder | Meaning | Example |
|---|---|---|
| `{{ACCENT_NAME}}` | Theme name (snake_case) | `signal` |
| `{{ACCENT_BG}}` | Accent background hex | `#E5301B` |
| `{{ACCENT_INK}}` | Ink color on accent | `#FFFFFF` |
| `{{ACCENT_IS_LIGHT}}` | `true` if accent surface is bright | `false` |
| `{{PAPER}}` | Outer warm-grey ambient | `#E8E4DD` |
| `{{CARD}}` | Inner card surface | `#FBFAF7` |
| `{{INK}}` | Primary text color | `#15110D` |
| `{{RAIL}}` | Dark side rail / dark cards | `#181613` |
| `{{SMOKE}}` | Secondary text | `#5A574F` |
| `{{ASH}}` | Hairline divider | `#B5AFA1` |
| `{{MIST}}` | Subtle border | `#D5CFC1` |

The neutral palette stays constant across themes — only the accent triple changes.

For each template file in `templates/`:
1. Read the template
2. Replace every `{{PLACEHOLDER}}` with the resolved theme value
3. Write to `<base>/<filename>` (strip the `.tmpl` suffix)

### Step 6 — Generate the page (smart by default)

If user invoked /the-broadside with content (a PRD, outline, copy, or even a single intent sentence) OR said "yes, generate a starter page", write `app/<route>/page.tsx` (Next.js App Router) or `pages/<route>.tsx` (Pages router) using one of the three composition modes from the section above.

**Mode selection — pick once, then commit:**
1. User explicitly listed versions (e.g. `v1 v7 v8`, `--versions=v1,v3,v9`) → **explicit mode**
2. User passed `--random` → **random mode**
3. Otherwise → **smart mode** (DEFAULT). Smart mode applies even when no flag is present.

For each slide:
1. Pick the variant per the mode's rules (smart selection rules / random shuffle / explicit token).
2. Apply the hero rule to slide 1 — substitute a hero-suitable variant if needed and tell the user what you swapped.
3. Render the slide as `<EditorialFrame hero={i === 0}>` with `<EditorialVersion version={N} {...slotProps} />` inside. The `hero` prop forces `min-h-screen w-screen` on the frame's outermost element so the hero is true full-bleed regardless of any parent container.
4. Populate slot props from content. If content is sparse, leave optional slots empty rather than padding with lorem ipsum.

If user explicitly declined a starter page AND gave no content, skip this step.

**Required code change before this step works:** `EditorialFrame` must accept a `hero?: boolean` prop. When `hero` is true, the outermost wrapper uses `min-h-screen w-screen` (not just `min-h-screen w-full`) and strips any horizontal padding/margins set by `BroadsideContainer` so the hero bleeds edge-to-edge. The skill's `slide.tsx.tmpl` must be patched accordingly during install — verify the template includes this `hero` prop before writing it. If installing into an existing project that has the older `EditorialFrame`, patch the existing file to add the `hero` prop rather than overwriting.

### Step 7 — Print usage summary
End with a cheat-sheet showing how to compose a slide — both name-based and numeric:

```tsx
// By name
<EditorialFrame>
  <EditorialOverlay
    eyebrow="For Companies"
    headline={<>Hire by<br />proof.</>}
    intro={<p>Every hire arrives as a record.</p>}
    imageSrc="/path/to/photo.webp"
    pagination={<EditorialPagination current={1} total={8} />}
    cards={[
      { kind: 'red',   eyebrow: '01', title: 'A signed record on every hire.' },
      { kind: 'dark',  eyebrow: '02', title: 'Defensible at audit.' },
      { kind: 'light', eyebrow: '03', title: 'Priced like software.', cta: { label: 'See sample', href: '/sample' } },
    ]}
  />
</EditorialFrame>

// By version number (interchangeable with name)
<EditorialFrame>
  <EditorialVersion
    version={6}
    eyebrow="Actuality"
    nav={['Actuality', 'Trend']}
    headline={<><strong>PORTRAIT</strong><br /><SerifAccent>WOMEN IN<br />THE WORLD</SerifAccent></>}
    numeral="01"
    imageSrc="/portrait.webp"
    cta={{ label: 'More about us', href: '/about' }}
    caption="Ipsum dolor sit pochette"
    pagination={<EditorialPagination current={1} total={8} />}
  />
</EditorialFrame>
```

## Idempotency

Re-running the skill on a project that already has the broadside installed should:
- Skip the `pnpm add` if deps are present
- Diff the existing `tokens.ts` against the new theme. If different, ask the user "switch from {old} to {new}?" before overwriting.
- Always rewrite `slide.tsx`, `layouts.tsx`, `layouts-extended.tsx`, `versions.tsx`, `chevrons.tsx`, `container.tsx`, `pagination.tsx`, `index.ts` (these are the design system — re-running upgrades them).
- Never touch the starter page if it exists.

## Localization

The components ship without hardcoded strings — every label (Close, Sign In, Sign Up, Welcome, regions, copyright, prev/next aria) is rendered via `props` passed by the consumer. The skill does NOT auto-wire i18n; the consumer plugs in their own `t()` hook at the call site.

If the project has `next-intl`, `react-i18next`, or a custom locale system, mention this in the closing summary so the user knows where to inject translations.

## Styling assumptions

- Tailwind CSS 4 must be installed (CSS-first config — no `tailwind.config` needed; the components use utility classes + inline styles only, no `@theme` additions). On a v3.4 project they mostly work, but bare alpha modifiers like `text-white/85` need bracket syntax (`/[0.85]`) there — flag this rather than silently installing.
- Geist Sans font expected at CSS variable `--font-geist-sans`. If the project uses a different font, the skill substitutes the variable name on install (ask user).
- The neutral palette is hardcoded into `tokens.ts` — stable across themes. The user can edit those constants to brand-match later.

## Out of scope

- The `<DossierMock>` illustrative card from the original implementation — that's project-specific content, not a primitive. Ship a simple `<EditorialPlate>` with an image instead.
- Multi-language support — components accept ReactNode props; the consumer wires translation themselves.
- Server-side rendering quirks beyond what Next.js App Router handles natively.
