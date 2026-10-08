# Token Detection — Reading a Project's Design System

The deck must visually belong to the project. That means pulling the project's actual color palette, fonts, and (where they exist) spacing/radius tokens, then mapping them onto the aesthetic's variable slots.

## Where to look

Check sources in order. Stop when you have a confident token map.

### 1. `CLAUDE.md` (highest priority — explicit author intent)

Search for sections titled:
- `## Design Tokens`
- `## Brand & Copy Rules`
- `## Design System`
- `## Brand`
- `## Colors` / `## Colours`

Inside, look for lines of the form:

```
- Background: `#F0ECE6` → `bg-background`
- Foreground: `#1A1A1A` → `text-foreground`
- Brand/Orange: `#E84A0C` → `bg-brand`
```

Extract the `#hex` and the semantic label. Common labels: background, foreground, brand, primary, accent, gold, sage, mist, paper, ink, stone.

### 2. `app/globals.css` (or `src/styles/globals.css`, `src/index.css`, `styles/globals.css`)

Look for `:root`, `@theme inline`, or `@theme` blocks. Extract custom properties:

```css
:root {
  --color-background: #F0ECE6;
  --color-foreground: #1A1A1A;
  --color-brand: #E84A0C;
  --color-brand-hover: #C43F0A;
}
```

Treat `--color-brand`, `--color-primary`, `--color-accent` as candidates for the `accent` slot. Treat `--color-background`, `--color-paper`, `--color-bg` as candidates for `paper`. Treat `--color-foreground`, `--color-ink`, `--color-text` as candidates for `ink`.

### 3. `tailwind.config.{js,ts}` (if present — Tailwind v3 projects)

Look for `theme.extend.colors`. Extract named colors. Tailwind v4 projects keep colors in `globals.css` `@theme` blocks instead.

### 4. Fonts — `app/layout.tsx`, `pages/_document.tsx`, or a Google Fonts `<link>` in `index.html`

Look for `next/font/google` imports:

```ts
import { Geist, Geist_Mono } from "next/font/google";
```

The font names are the project's sans + mono. Project may not have a serif — that's expected.

### 5. Conflict resolution

If `CLAUDE.md` and `globals.css` disagree on a value (this happens — the doc drifts), **trust `globals.css`**. It's what actually renders. Note the discrepancy and offer to reconcile after the deck ships.

## Mapping heuristic — project tokens → aesthetic slots

The editorial aesthetic needs these slots filled:

| Slot | Purpose | Map from project token |
|---|---|---|
| `paper` | Slide background | `--color-background`, `bg-paper`, `bg-bg`, named "background" / "paper" / "canvas". Lighten by 5% if the project's bg is too saturated for a deck. |
| `paper-warm` | Section-row tint inside tables | `paper` mixed with 4% of `accent`, or a slightly warmer neutral if defined |
| `ink` | Primary body / heading text | `--color-foreground`, `bg-fg`, named "foreground" / "ink" / "text". |
| `ink-soft` | Secondary text | `ink` at 90% opacity, or `--color-text-secondary` if defined |
| `stone-dark`, `stone`, `stone-light` | Caption / mute / muted | Neutral grays. Derive from `ink` at 70%, 55%, 40% if no explicit muted scale. |
| `mist` | Card backgrounds, hover states | A soft tint of `paper` toward `ink` (~92%) |
| `accent` | Primary highlight color (eyebrows, dots, accent text) | **`--color-brand`** / `--color-primary` / `--color-accent`. **This is the most important map.** |
| `accent-deep` | Deeper accent (italic emphasis, hover) | `--color-brand-hover` if present, else `accent` darkened 12% |
| `accent-bg` | Accent-tinted row backgrounds | `accent` at 8% opacity over `paper` |
| `rule` | Hairline borders | `rgba(0,0,0,0.08)` — universal |
| `rule-strong` | Stronger dotted dividers | `rgba(0,0,0,0.16)` — universal |

The 8-color palette bar at the top of cover/section slides should pull from the aesthetic's *default* palette unless the project defines an explicit pastel scale. The bar is decorative — it doesn't need to follow the project's palette strictly. **Exception:** if the project's brand color is bright/saturated (like Perspiva's `#E84A0C`), use a single 4px accent bar in the brand color instead of the 8-color rainbow.

## Font mapping

Which slots exist depends on the aesthetic. **The default (`straight`) has no serif slot at all.**

### `straight` (default) · `clean` — sans only

| Slot | Use | Default if project has none |
|---|---|---|
| `--f-display` | Display / headlines / cover title | **The project's sans** — the same family as `--f-sans`. `Geist` only if the project has none |
| `--f-sans` | Body, navigation, captions | Project's sans (Geist, Inter, etc.) — keep it |
| `--f-mono` | Eyebrows, slide marks, table numerics | Project's mono (Geist Mono, JetBrains Mono) — keep it |

**Do not add a serif because the project lacks one.** A missing serif is not a gap to fill — it's information. Most products ship a sans and no serif; importing Fraunces gives the deck a voice the product doesn't have. `--f-display` and `--f-sans` resolve to the **same family**, and weight contrast (300 display vs 400 body) does the work.

End sans stacks with `sans-serif` — never `Georgia`/`Times New Roman`/`serif`. The fallback is what renders while the webfont loads, and permanently on any machine that can't fetch it.

### `editorial` — serif display

| Slot | Use | Default if project has none |
|---|---|---|
| `--f-serif` | Display / headlines / cover title | `Fraunces` (variable, Google Fonts) |
| `--f-sans` | Body, navigation, captions | Project's sans — keep it |
| `--f-mono` | Eyebrows, slide marks, table numerics | Project's mono — keep it |

If the project has a serif, prefer it. If not, add `Fraunces` via Google Fonts `<link>` for the deck only. **This only applies when the user explicitly asked for `editorial`.**

## Token override precedence (highest wins)

1. User `--colors "key:#hex,..."` flag
2. `CLAUDE.md` explicit declarations
3. `globals.css` `:root` / `@theme` custom properties
4. `tailwind.config.{js,ts}` theme.extend.colors
5. Aesthetic defaults

## Reporting

After detection, summarize what you found:

```
Tokens detected (Perspiva):
  paper:       #F0ECE6  (CLAUDE.md → background)
  ink:         #1A1A1A  (CLAUDE.md → foreground)
  accent:      #E84A0C  (globals.css → --color-brand)
  accent-deep: #C43F0A  (globals.css → --color-brand-hover)
  display:     Geist    (app/layout.tsx — same family as sans; straight aesthetic)
  sans:        Geist    (app/layout.tsx)
  mono:        Geist Mono (app/layout.tsx)
```

If the project's brand color is contradicted by a stale token file, **usage wins**. Count real occurrences before trusting a declaration:

```bash
grep -rhoE '#[0-9A-Fa-f]{6}' apps/*/src packages/*/src | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head
```

A `tokens/colors.ts` that says the brand is purple while `globals.css` and 500+ call sites say red means the token file is stale. Report the discrepancy rather than silently picking one.

So the user knows what was inferred and what was added.
