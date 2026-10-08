---
name: og
description: Install a dynamic Open Graph / Twitter social card route into a Next.js project. Drops `app/og/route.tsx` rendering 1200×630 PNGs via `next/og` (Satori) with the "broadside-on-black" design — bold black canvas, two-toned diagonal red/accent wedges in the top-right, oversized Anton condensed display headline in cream, Barlow eyebrow/footer rows, all themed to a chosen named accent. Downloads Anton + Barlow TTFs into the route's `_fonts/` folder at install time. Themes ship as named accents (crimson, cobalt, mustard, ember, lime, coral, sage, slate) — pick which one becomes the project's signal color. Detects App Router location, prefers monorepo `apps/web/` when present, skips touching existing `og/route.tsx` without confirmation. Idempotent — safe to re-run to upgrade or swap theme. Invoke with `--list` to print the theme catalog without installing.
disable-model-invocation: true
---

# og — social card route

Installs the "broadside-on-black" Open Graph card design into a Next.js project. One file, one fetch of fonts, one route — done. Every page that wires its title through the metadata helper gets a 1200×630 PNG with the project's accent color baked in.

## When to use

User wants to:
- Add (or replace) a dynamic OG image route in a Next.js project
- Re-theme an existing card to match a project's signal color
- Set up a social card for a new site before shipping

Not for: static OG PNGs (use a design tool), non-Next frameworks (Satori has Next-specific bindings here), or sites without React 18+/Next 14+. Per-page `opengraph-image.tsx` file conventions are a different pattern — this skill deliberately ships one shared `/og?title=` route reused by every page.

## The design (what gets rendered)

```
┌────────────────────────────────────────────────┐
│ ⌖ FOUNDERS ALIGN           VOL. 01 · ON THE RECORD ▓│  ← header row (Barlow 600, tracked)
│                                             ▓▓▓▓▓▓▓│
│   ── CO-FOUNDER ALIGNMENT  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← red eyebrow with dash
│                            ▓▓▓▓ red slash ▓▓│
│   FIND A COFOUNDER         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Anton display headline,
│   COACH OR MENTOR          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     cream, uppercase,
│                            ░░░░ deep red ░░░│     punches into the wedge
│ ─────────────────────────────────────────────│
│ FOUNDERS-ALIGN.COM      BUILD BETTER TOGETHER ▪│  ← Barlow footer rule
└────────────────────────────────────────────────┘
   ▓ = SIGNAL (theme accent)   ░ = SIGNAL_DEEP (theme accent, deeper)
```

Two stacked wedges (`rotate(22deg)`) anchor the right side: bright accent on top, deeper accent below. Cream text on near-black background. **No left side accent rail** — the design ships without it deliberately; do not add one back.

## What gets installed

```
<app>/src/app/og/
├── route.tsx              — the GET handler that renders the PNG
└── _fonts/
    ├── Anton-Regular.ttf      — display headline (downloaded at install)
    ├── Barlow-Regular.ttf     — body / footer (downloaded at install)
    ├── Barlow-SemiBold.ttf    — eyebrow / header (downloaded at install)
    └── Barlow-Bold.ttf        — accent badge (downloaded at install)
```

Optionally also patches `<app>/src/lib/seo/metadata.ts` (if it exists) so all pages share a `buildDynamicOgImage(title)` helper that points at `/og?title=...`.

## Theme catalog

The skill takes a `--theme` (or asks the user) and bakes accent values into `route.tsx`.

| Theme | SIGNAL (top wedge) | SIGNAL_DEEP (bottom wedge) | Vibe |
|---|---|---|---|
| `crimson` | `#e63946` | `#b91c1c` | Bold editorial red — Founders Align default |
| `cobalt` | `#2952ff` | `#1e40af` | Confident deep blue |
| `mustard` | `#d4a33a` | `#92710a` | Warm gold, editorial luxe |
| `ember` | `#ff6a2b` | `#c2410c` | Energetic orange |
| `lime` | `#a3e635` | `#4d7c0f` | Electric green |
| `coral` | `#f26b5e` | `#c0392b` | Warm humanistic |
| `sage` | `#84a98c` | `#52796f` | Calm considered green |
| `slate` | `#94a3b8` | `#475569` | Neutral, restrained |

All themes keep the same near-black canvas (`#0a0a0a`) and cream text (`#f5f1ea`). Only the two accent values flip. Custom hex pairs are accepted — pass `--signal=#XXXXXX --signal-deep=#YYYYYY` or answer "Other" to the prompt.

## `--list` flag

When invoked as `/og --list`, print the theme catalog table above and **stop** — do not run any installation workflow. Useful for catalog recall.

## Workflow

### Step 1 — Confirm framework

Read `package.json`. Require `next` >= 14 (`ImageResponse` lives at `next/og` since v14; verified compatible through Next 16). If `next` is missing or older, stop and tell the user the skill needs Next.js 14+ App Router. The template pins `export const runtime = 'nodejs'` with `fs.readFileSync` font loading — keep it that way (Vercel deprecated Edge Functions in 2025; `fetch(new URL(...))` font loading fails on the Node runtime).

If a monorepo (root `package.json` has `workspaces` or there's a `pnpm-workspace.yaml`):
- Default install target is `apps/web/`. Check that exists. If not, scan `apps/*/package.json` for one with `next` and use that.
- If multiple Next apps exist, ask the user which to target.

If a single-app repo: install target is `./`.

### Step 2 — Locate the App Router

Look for, in order:
- `<app>/src/app/` (most common, monorepo-friendly)
- `<app>/app/` (flat repo)

If neither exists, stop and tell the user this skill needs the App Router.

### Step 3 — Check for existing OG route

Check if `<app>/(src/)app/og/route.tsx` exists.
- If yes: read it, confirm with the user whether to overwrite ("Replace existing OG route with broadside-on-black design?"). Default: yes. If declined, stop.
- If no: proceed.

### Step 4 — Pick theme

Use `AskUserQuestion` to offer the 8 named themes. Each option's description shows the two hex values (e.g. "crimson · #e63946 → #b91c1c"). Allow custom — if the user picks "Other", ask for a SIGNAL hex and a SIGNAL_DEEP hex (or accept a single SIGNAL and derive SIGNAL_DEEP by darkening — see "Deriving SIGNAL_DEEP" below).

If the user already passed `--theme=name` on the command line, skip the prompt.

If the user passed `--signal=#XXXXXX` (and optionally `--signal-deep=#YYYYYY`), skip the prompt and use those directly.

### Step 5 — Download fonts

If `<app>/(src/)app/og/_fonts/` is missing any of the four required TTFs (Anton-Regular, Barlow-Regular, Barlow-SemiBold, Barlow-Bold), download them in parallel with `curl`:

```bash
mkdir -p <app>/<src?>/app/og/_fonts
curl -sL https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf -o <fonts>/Anton-Regular.ttf
curl -sL https://github.com/google/fonts/raw/main/ofl/barlow/Barlow-Regular.ttf -o <fonts>/Barlow-Regular.ttf
curl -sL https://github.com/google/fonts/raw/main/ofl/barlow/Barlow-SemiBold.ttf -o <fonts>/Barlow-SemiBold.ttf
curl -sL https://github.com/google/fonts/raw/main/ofl/barlow/Barlow-Bold.ttf -o <fonts>/Barlow-Bold.ttf
```

After download, verify each file is a real TTF: `file <path>` should report `TrueType Font data`. If any returned HTML (Google Fonts repo occasionally redirects), retry once. If still HTML, stop and tell the user the font CDN is unreachable.

### Step 6 — Locate the brand logo (optional)

Look for a square PNG/SVG logo to put in the header row, in this order:
- `<app>/public/images/<project-name>-logo.png`
- `<app>/public/logo.png`
- `<app>/public/icon.png`

If found, capture its absolute path for the template. If none found, the template will fall back to omitting the logo `<img>` (it stays a clean wordmark).

### Step 7 — Resolve brand & footer text

From `package.json#name` or `<app>/package.json#name`, derive a default `BRAND` wordmark by title-casing the package name (e.g. `@founders-align/web` → "Founders Align"; `acme-marketing` → "Acme Marketing"). Strip scope prefix and the `-web`/`-marketing`/`-site` suffix.

Defaults for the eyebrow + footnote — keep neutral so they work everywhere:
- `EYEBROW` → `"Vol. 01 · On the Record"`
- `FOOTNOTE` → `"Build better together"` (Founders Align default) OR a project-relevant tagline if obvious from the site copy. Ask the user to confirm/replace.
- `DOMAIN` → from `NEXT_PUBLIC_SITE_URL` env, or `package.json#homepage`, or omit and let the user fill in later.

### Step 8 — Read template, substitute, write

Read `templates/route.tsx.tmpl` and replace placeholders, then write to `<app>/(src/)app/og/route.tsx`.

| Placeholder | Meaning | Example |
|---|---|---|
| `{{SIGNAL}}` | Top wedge / eyebrow / dash / footer square | `#e63946` |
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
| `{{LOGO_LOAD_BLOCK}}` | Either the logo read + img tag, or empty | see template |

`INK`, `PAPER`, `MUTED`, `RULE` are constant across themes — only `SIGNAL` and `SIGNAL_DEEP` flip. Substitute them all the same way for clarity.

### Step 9 — Wire up the metadata helper (optional, ask first)

Check if `<app>/src/lib/seo/metadata.ts` exists. If yes, read it. If it doesn't already contain a `buildDynamicOgImage` function that returns `/og?title=...`, offer to add one. Do not overwrite an existing helper without consent.

If the user accepts, patch in:

```ts
function buildDynamicOgImage(title: string): string {
  return `${SITE_URL}/og?title=${encodeURIComponent(title)}`;
}
```

…and make `generateSEOMetadata` (or the project's equivalent) fall back to `buildDynamicOgImage(title)` when no explicit `ogImage` is passed.

If `metadata.ts` doesn't exist, **don't create one** — that's outside this skill's scope. Just tell the user how to call `/og?title=<page title>` from wherever they assemble metadata.

### Step 10 — Verify

If the dev server is running on `localhost:3000` (check with `lsof -i :3000 -sTCP:LISTEN`), curl the route to confirm it renders:

```bash
curl -s "http://localhost:3000/og?title=Hello%20World" -o /tmp/og-test.png -w "HTTP %{http_code} · %{size_download} bytes\n" --max-time 60
```

HTTP 200 + image/png + > 10KB → success; show the user the test URL. HTTP 500 → read the JSON body, surface the error, stop. Server not running → skip verify and tell the user what URL to test once they `pnpm dev`. Flat solid-color PNGs compress well; the card should land far below the ~300KB ceiling WhatsApp tolerates for previews.

### Step 11 — Print usage summary

Output a short cheat-sheet:

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

If robots.txt disallows paths, keep /og allowed — scrapers must be able to fetch it.
To re-theme later: /og --theme=<new-theme>
```

## Deriving SIGNAL_DEEP

If the user provides only a SIGNAL hex (no SIGNAL_DEEP), derive the deeper shade by:
1. Convert hex → HSL
2. Reduce lightness by ~18 percentage points (clamped to >= 10%)
3. Convert back to hex

This produces a believable "shadow" of the top wedge for the bottom. Always show the derived value and ask the user to confirm before writing.

## Idempotency notes

- Re-running `/og` on a project that already has the route is safe — it overwrites `route.tsx` with the latest design but leaves fonts in place if already downloaded.
- Re-running with a new `--theme` only flips the two accent hex values inside `route.tsx`.
- The `_fonts/` folder is never deleted by the skill. If the user wants different fonts, they remove the files and re-run.

## Anti-patterns

- Do not add a vertical red side rail / accent bar on the left edge of the card. The owner explicitly rejected this; it's not in the design and shouldn't come back.
- Do not use gradients. Solid colors only.
- Do not use Times New Roman / Libre Baskerville / any serif for the headline. Anton (condensed display sans) is mandatory.
- Do not swap the canvas to white/cream. The black canvas is the design's anchor — themes only flip the two accent hexes.
- Do not add box shadows, blurs, or `mix-blend-mode` styles inside the ImageResponse. The design is flat solid color; `mix-blend-mode` is still unsupported by Satori, and shadows/filters (supported since ~2025) break the design language anyway.
- Do not reference `.webp` images inside the ImageResponse — Satori's image parser still crashes on webp data (satori#273/#539). Use `.png` or inline SVG data URLs only.
- Do not use variable fonts (or `.woff2`) in the `fonts` array — Satori chokes on `fvar` tables and doesn't parse woff2. Static-weight `.ttf`/`.otf` only (which is why we ship Barlow-Regular/SemiBold/Bold as three separate files).
- Do not use `display: grid` or leave a multi-child `<div>` without `display: flex` — Satori is flexbox-only and throws on implicit-display parents.
- Do not return `err.stack` in the 500 response body. The template logs server-side and returns `{ error: 'failed_to_render' }` — never leak internal paths to the public.
- Do not skip the `clampInput` length cap on query params. Without it, any user can flood the CDN cache with junk variants or pass a multi-MB title that blows up Satori.
