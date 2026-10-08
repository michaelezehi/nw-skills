# Brand — the two visual languages

ATS and HR are **different films**. They share a typeface, a voice and a
pacing philosophy; they share nothing else. A film that mixes violet night
with warm paper reads as a mistake, not a range.

The one place they meet is the **bridge**: the ATS film's dark candidate card
sliding into the warm HR day-one world. That is the hire-to-payday thread, and
it is the only sanctioned crossover.

## HR — warm paper

Source of truth: `apps/hr/.../globals.css`. Mirrored in `src/theme.ts` as `HR`.

| | |
|---|---|
| Background | `#faf9f5` warm paper |
| Surface | `#ffffff` |
| Ink | `#1c1b18` |
| Secondary | `#6f6b63` |
| Accent | `#e5301b` signal red |
| Accent deep | `#a82217` |
| Tint | `rgba(229,48,27,0.10)` |
| Radius | `28px` — soft, generous, never sharp |

Feeling: daylight, dignity, human warmth. Real people footage carries the
emotion; product panels float in on soft shadows. The signature scene is the
trilingual companion chat — Arabic, Bengali, English, one red answer.

## ATS — violet night

Source of truth: the design-system `colors.ts`. Mirrored as `ATS`.

| | |
|---|---|
| Background | `#09090b` zinc-950 |
| Surface | `#18181b` |
| Ink | `#fafafa` |
| Secondary | `#a1a1aa` |
| Accent | `#a855f7` |
| Gradient | `linear-gradient(135deg,#7c3aed 0%,#a855f7 55%,#6366f1 100%)` |
| Border | `rgba(255,255,255,0.14)` |
| Radius | `0` — **angular, no curves anywhere** |

Feeling: precision, focus, quiet confidence. Product appears as brand-true
motion graphics rather than screenshots — a living pipeline, a wall of a
hundred candidate cards, a match-signal card. People shots are letterboxed.

## Type

`Geist`, loaded from the npm `geist` package's woff2 via `@remotion/fonts`.
**Geist is not in `@remotion/google-fonts`** — do not try to load it from
there. Arabic falls back to IBM Plex Sans Arabic, Bengali to Noto Sans Bengali,
both from `@remotion/google-fonts`.

Headlines are tight and large. Never centre a paragraph. Never let a line of
body copy run wider than about 60 characters.

## Motion

House primitives live in `packages/promo-video/src/shared.tsx`. Reach for these
before writing new ones:

| | |
|---|---|
| `EASE` | `Easing.bezier(0.22, 1, 0.36, 1)` — the house ease-out, on nearly everything |
| `BlurIn` | 12-frame fade + sharpen entrance |
| `Drift` | slow Ken-Burns — **every shot breathes**, nothing is ever perfectly still |
| `FilmLayer` | jittering grain + vignette; the thing that stops it looking like a web page |
| `Letterbox` | cinematic bars, for the ATS people shots |
| `Shot`, `Glide`, `ProductPanel`, `Sweep`, `Words`, `EndCard`, `Fade` | scene scaffolding |

Rules that hold across both languages:

- **Nothing is static.** A locked-off frame reads as a screenshot. Drift it.
- **Grain and vignette on everything.** This is most of the "expensive" look.
- **Motivate the camera.** Move because the story moves, not to fill time.
- **Vary shot size.** Wide, medium, close, extreme close. A film cut entirely
  in mediums is a demo.
- **Land clean.** The last chord resolves, the logo holds still, nothing fades
  out under it.

## Footage banks

Committed to the repo, safe to reference directly:

- People footage — `apps/web/public/videos/` and `apps/web/public/videos/landing/`
- Company/talent footage — `apps/app/public/videos/company-talent/`
- Candidate portraits — `apps/app/public/demo-portraits/`

Screen recordings and the promo footage cut live outside git in the asset
library — see `packages/promo-video/ASSETS.md`.
