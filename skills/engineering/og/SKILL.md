---
name: og
description: Installs a dynamic Open Graph and Twitter card route (`app/og/route.tsx`, 1200x630 PNG via next/og) in the broadside-on-black design into a Next.js 14+ App Router project, with a named accent theme and downloaded Anton and Barlow fonts. Idempotent. Use on /og, /og --theme=<name>, or /og --list to print the theme catalog.
disable-model-invocation: true
---

# og: social card route

Installs the "broadside-on-black" Open Graph card into a Next.js project: one route, one font fetch. Every page that wires its title through the metadata helper gets a 1200×630 PNG in the project's accent color.

## When to use

- Add or replace a dynamic OG image route in a Next.js project.
- Re-theme an existing card to the project's signal color.
- Set up a social card for a new site before shipping.

Not for static OG PNGs (use a design tool), non-Next frameworks, or sites below React 18 / Next 14. Per-page `opengraph-image.tsx` is a different pattern: this skill ships one shared `/og?title=` route reused by every page, on purpose.

## The design

```
┌────────────────────────────────────────────────┐
│ ⌖ FOUNDERS ALIGN           VOL. 01 · ON THE RECORD ▓│  ← header row (Barlow 600, tracked)
│                                             ▓▓▓▓▓▓▓│
│   ── CO-FOUNDER ALIGNMENT  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← red eyebrow with rule
│                            ▓▓▓▓ red slash ▓▓│
│   FIND A COFOUNDER         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Anton display headline,
│   COACH OR MENTOR          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     cream, uppercase,
│                            ░░░░ deep red ░░░│     punches into the wedge
│ ─────────────────────────────────────────────│
│ FOUNDERS-ALIGN.COM      BUILD BETTER TOGETHER ▪│  ← Barlow footer rule
└────────────────────────────────────────────────┘
   ▓ = SIGNAL (theme accent)   ░ = SIGNAL_DEEP (theme accent, deeper)
```

Two stacked wedges (`rotate(22deg)`) anchor the right side: bright accent on top, deeper accent below. Cream text on near-black. There is no left side accent rail, on purpose; do not add one.

## What gets installed

```
<app>/src/app/og/
├── route.tsx                  the GET handler that renders the PNG
└── _fonts/
    ├── Anton-Regular.ttf      display headline (downloaded at install)
    ├── Barlow-Regular.ttf     body and footer (downloaded at install)
    ├── Barlow-SemiBold.ttf    eyebrow and header (downloaded at install)
    └── Barlow-Bold.ttf        accent badge (downloaded at install)
```

Optionally patches `<app>/src/lib/seo/metadata.ts` (if it exists) so all pages share a `buildDynamicOgImage(title)` helper pointing at `/og?title=...`.

## Theme catalog

The skill takes `--theme` (or asks) and bakes the accent values into `route.tsx`.

| Theme | SIGNAL (top wedge) | SIGNAL_DEEP (bottom wedge) | Vibe |
|---|---|---|---|
| `crimson` | `#e63946` | `#b91c1c` | Bold editorial red, Founders Align default |
| `cobalt` | `#2952ff` | `#1e40af` | Confident deep blue |
| `mustard` | `#d4a33a` | `#92710a` | Warm gold, editorial luxe |
| `ember` | `#ff6a2b` | `#c2410c` | Energetic orange |
| `lime` | `#a3e635` | `#4d7c0f` | Electric green |
| `coral` | `#f26b5e` | `#c0392b` | Warm humanistic |
| `sage` | `#84a98c` | `#52796f` | Calm considered green |
| `slate` | `#94a3b8` | `#475569` | Neutral, restrained |

Every theme keeps the near-black canvas (`#0a0a0a`) and cream text (`#f5f1ea`); only the two accents change. Custom pairs are accepted: `--signal=#XXXXXX --signal-deep=#YYYYYY`, or "Other" at the prompt.

## `--list`

`/og --list` prints the theme catalog table above and stops. No installation step runs.

## Workflow

### Step 1: confirm framework

Read `package.json`. Require `next` >= 14 (`ImageResponse` lives at `next/og` since v14; checked through Next 16). If `next` is missing or older, stop and say the skill needs Next.js 14+ App Router. The template pins `export const runtime = 'nodejs'` with `fs.readFileSync` font loading; keep it (Vercel deprecated Edge Functions in 2025, and `fetch(new URL(...))` font loading fails on the Node runtime).

Monorepo (root `package.json` has `workspaces`, or a `pnpm-workspace.yaml` exists):
- Default target is `apps/web/`. If it does not exist, scan `apps/*/package.json` for one with `next`.
- If several Next apps exist, ask which to target.

Single-app repo: target is `./`.

### Step 2: locate the App Router

Look for `<app>/src/app/` first, then `<app>/app/`. If neither exists, stop and say the skill needs the App Router.

### Step 3: check for an existing OG route

If `<app>/(src/)app/og/route.tsx` exists, read it and ask "Replace existing OG route with broadside-on-black design?" (default yes). If declined, stop.

### Step 4: pick the theme

Use `AskUserQuestion` to offer the 8 themes, each option showing its two hexes (e.g. "crimson · #e63946 → #b91c1c"). On "Other", ask for a SIGNAL hex and a SIGNAL_DEEP hex, or take a single SIGNAL and derive SIGNAL_DEEP (see "Deriving SIGNAL_DEEP").

Skip the prompt when `--theme=name` was passed, or when `--signal=#XXXXXX` (with optional `--signal-deep=#YYYYYY`) was passed; use those directly.

### Step 5: download fonts

If `<app>/(src/)app/og/_fonts/` is missing any of the four TTFs, download them in parallel:

```bash
mkdir -p <app>/<src?>/app/og/_fonts
curl -sL https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf -o <fonts>/Anton-Regular.ttf
curl -sL https://github.com/google/fonts/raw/main/ofl/barlow/Barlow-Regular.ttf -o <fonts>/Barlow-Regular.ttf
curl -sL https://github.com/google/fonts/raw/main/ofl/barlow/Barlow-SemiBold.ttf -o <fonts>/Barlow-SemiBold.ttf
curl -sL https://github.com/google/fonts/raw/main/ofl/barlow/Barlow-Bold.ttf -o <fonts>/Barlow-Bold.ttf
```

Check each with `file <path>`: it must report `TrueType Font data`. If one came back as HTML (the repo sometimes redirects), retry once. Still HTML: stop and say the font CDN is unreachable.

### Step 6: locate the brand logo (optional)

Look for a square PNG or SVG logo, in order: `<app>/public/images/<project-name>-logo.png`, `<app>/public/logo.png`, `<app>/public/icon.png`. If found, keep its absolute path for the template. If not, the template omits the logo `<img>` and stays a clean wordmark.

### Step 7: resolve brand and footer text

Derive `BRAND` by title-casing `package.json#name` (or `<app>/package.json#name`): strip the scope and any `-web`, `-marketing` or `-site` suffix (`@founders-align/web` becomes "Founders Align", `acme-marketing` becomes "Acme Marketing").

Neutral defaults that work anywhere:
- `EYEBROW`: `"Vol. 01 · On the Record"`
- `FOOTNOTE`: `"Build better together"` (Founders Align default), or a tagline that is obvious from the site copy. Ask the user to confirm or replace it.
- `DOMAIN`: from `NEXT_PUBLIC_SITE_URL`, or `package.json#homepage`, or left for the user to fill in.

### Step 8: read the template, substitute, write

Read `templates/route.tsx.tmpl`, replace the placeholders, write `<app>/(src/)app/og/route.tsx`.

| Placeholder | Meaning | Example |
|---|---|---|
| `{{SIGNAL}}` | Top wedge, eyebrow, rule, footer square | `#e63946` |
| `{{SIGNAL_DEEP}}` | Bottom wedge | `#b91c1c` |
| `{{INK}}` | Canvas background | `#0a0a0a` |
| `{{PAPER}}` | Primary text color | `#f5f1ea` |
| `{{MUTED}}` | Secondary text color (rgba) | `rgba(245, 241, 234, 0.55)` |
| `{{RULE}}` | Hairline divider | `rgba(245, 241, 234, 0.2)` |
| `{{BRAND}}` | Wordmark in header | `Founders Align` |
| `{{BRAND_BADGE}}` | Red eyebrow text under header | `Co-founder Alignment` |
| `{{EYEBROW_DEFAULT}}` | Top-right eyebrow fallback | `Vol. 01 · On the Record` |
| `{{FOOTNOTE_DEFAULT}}` | Bottom-right footnote fallback | `Build better together` |
| `{{DOMAIN}}` | Bottom-left domain | `founders-align.com` |
| `{{LOGO_LOAD_BLOCK}}` | The logo read and img tag, or empty | see template |

`INK`, `PAPER`, `MUTED` and `RULE` are the same in every theme; substitute them the same way anyway.

### Step 9: wire up the metadata helper (optional, ask first)

If `<app>/src/lib/seo/metadata.ts` exists, read it. If it has no `buildDynamicOgImage` returning `/og?title=...`, offer to add one; never overwrite an existing helper without consent. On yes, patch in:

```ts
function buildDynamicOgImage(title: string): string {
  return `${SITE_URL}/og?title=${encodeURIComponent(title)}`;
}
```

and make `generateSEOMetadata` (or the project's equivalent) fall back to `buildDynamicOgImage(title)` when no `ogImage` is passed.

If `metadata.ts` does not exist, do not create one; that is outside this skill. Tell the user how to call `/og?title=<page title>` wherever they assemble metadata.

### Step 10: verify

If a dev server listens on `localhost:3000` (`lsof -i :3000 -sTCP:LISTEN`), curl the route:

```bash
curl -s "http://localhost:3000/og?title=Hello%20World" -o /tmp/og-test.png -w "HTTP %{http_code} · %{size_download} bytes\n" --max-time 60
```

HTTP 200, image/png and over 10KB is a pass; show the test URL. HTTP 500: read the JSON body, report the error, stop. No server running: skip and give the URL to test after `pnpm dev`. Flat solid-color PNGs compress well; the card should land far below the roughly 300KB ceiling WhatsApp tolerates for previews.

### Step 11: print the usage summary

```
✓ OG route installed at <path>
✓ Theme: <theme-name> (#SIGNAL → #SIGNAL_DEEP)
✓ Fonts: Anton + Barlow downloaded to _fonts/

Test it:
  http://localhost:3000/og?title=Your%20Page%20Title

Wire it into metadata (width/height/alt let scrapers lay out the preview before fetching):
  openGraph: {
    images: [{ url: `${SITE_URL}/og?title=${encodeURIComponent(title)}`, width: 1200, height: 630, alt: title }]
  }

If robots.txt disallows paths, keep /og allowed: scrapers must be able to fetch it.
To re-theme later: /og --theme=<new-theme>
```

## Deriving SIGNAL_DEEP

Given only a SIGNAL hex: convert to HSL, lower lightness by about 18 percentage points (clamped at 10% or more), convert back to hex. Show the derived value and ask the user to confirm before writing.

## Idempotency

- Re-running `/og` on a project that has the route overwrites `route.tsx` with the latest design and keeps fonts already downloaded.
- Re-running with a new `--theme` only changes the two accent hexes in `route.tsx`.
- The skill never deletes `_fonts/`. To change fonts, the user removes the files and re-runs.

## Anti-patterns

- No vertical red side rail or accent bar on the left edge. The owner rejected it.
- No gradients. Solid colors only.
- No serif headline (Times New Roman, Libre Baskerville or any other). Anton is required.
- No white or cream canvas. The black canvas anchors the design; themes only change the two accents.
- No box shadows, blurs or `mix-blend-mode` inside the ImageResponse. `mix-blend-mode` is still unsupported by Satori, and shadows and filters (supported since about 2025) break the flat design.
- No `.webp` images inside the ImageResponse: Satori's image parser still crashes on webp (satori#273, #539). Use `.png` or inline SVG data URLs.
- No variable fonts or `.woff2` in the `fonts` array: Satori chokes on `fvar` tables and does not parse woff2. Static-weight `.ttf` or `.otf` only, which is why Barlow ships as three files.
- No `display: grid`, and no multi-child `<div>` without `display: flex`: Satori is flexbox-only and throws on implicit-display parents.
- Never return `err.stack` in the 500 body. The template logs server-side and returns `{ error: 'failed_to_render' }` so internal paths never leak.
- Keep the `clampInput` length cap on query params. Without it anyone can flood the CDN cache with junk variants or pass a multi-MB title that breaks Satori.
