# Design: the house walkthrough look

The concept is fixed; the palette is not. Components read `--wt-*` tokens
from `walkthrough.css`, so a host changes colours there and never edits a
component. Keep the layout, shapes, type scale and motion identical across
projects so every walkthrough feels like the same product family.

## Tokens (defaults: warm cream house palette)

| Token | Default | Used for |
|---|---|---|
| `--wt-surface` | `#fdfaf6` | reader and card background |
| `--wt-art-panel` | `#f4f2ee` | picture panels |
| `--wt-line` | `#23231f14` | hairlines, borders, toggle off |
| `--wt-hover` | `#23231f0a` | icon button hover |
| `--wt-ink` | `#3d3d39` | titles |
| `--wt-ink-strong` | `#383834` | buttons, current step |
| `--wt-body` | `#54524c` | reading text |
| `--wt-muted` | `#8d8e88` | done steps, close icons |
| `--wt-faint` | `#a0a19c` | eyebrows, steps to come |
| `--wt-dark` | `#23231f` | done dots, spotlight ring |
| `--wt-accent` | `#fde047` | primary pill, current step dot, toggle on |
| `--wt-accent-hover` | `#facc15` | pill hover |
| `--wt-accent-ink` | `#383834` | text on the accent |
| `--wt-accent-glow` | `rgba(253,224,71,.55)` | spotlight halo |
| `--wt-ring` | `#c89a3e` | countdown ring |

Shadows (two layers, soft, warm, never black):

- Reader: `0 32px 96px rgba(36,36,30,.16), 0 8px 24px rgba(36,36,30,.06)`
- Card: `0 24px 64px rgba(36,36,30,.14), 0 6px 18px rgba(36,36,30,.06)`
- Bar: `0 12px 40px rgba(24,24,27,.12)` on `white/90` with `backdrop-blur-xl`

Rules: no gradients, no purple dominance, no accent strips on card edges,
no black primary buttons. The accent is one solid colour.

## Type

| Role | Spec |
|---|---|
| Eyebrow | 10px, `font-extrabold`, uppercase, `tracking-[0.22em]`, faint, `whitespace-nowrap` |
| Reader title | 21px, medium, `leading-[1.18]`, `-tracking-[0.03em]` |
| Card title | 16px, medium, `leading-[1.25]`, `-tracking-[0.02em]` |
| Reading | 13.5px reader, 13px card, `leading-[1.5]` to `1.55` |
| Journey list | 12.5px; current semibold ink-strong, done muted, to come faint |
| Buttons | 12px semibold; pills `h-9` to `h-10`, labels never wrap |

## Pieces

**The reader** (`ExplainReader`): a column fixed on the far right.
`right-4`, `top: var(--wt-header-h)`, `bottom: 92px` (clears the bar),
`width: min(380px, 100vw - 32px)`, radius 28, surface, reader shadow,
`z-110`. Top to bottom:

1. Eyebrow with the story name, close cross on the right.
2. Picture panel: `h-150px`, radius 22, art panel colour, art at a FIXED
   128px, `overflow-hidden`.
3. "Step n of N" eyebrow, then the title.
4. "What happened" and "Why it matters", each an eyebrow over reading text.
5. "Show me how to get there": outline pill with a signpost icon, only when
   a menu link is found.
6. "The journey": a hairline, eyebrow, then every step with a dot (done:
   filled dark with a tick; now: accent; to come: hollow).
7. Footer on a hairline: countdown ring (40px, ring colour), pause or play,
   previous step (from step 2), and "Continue" as the accent pill on the right.

**The prompt card** (`PromptLayer`): the split. Picture panel left (118px
wide, art at 92px), message right (eyebrow "New for you", title, body,
accent pill with an arrow). Radius 24, card shadow, close cross absolute top
right. Stack top right, `width: min(400px, ...)`, max three; it slides left
by the reader's width plus 32px while the reader is open.

**The bar** (`WalkthroughBar`): a pill centred at the bottom (`bottom-5`,
`z-70`): Play (accent pill) or Pause (outline pill), previous, next, start
over, a hairline, "Founder story · Step 3 of 9", a hairline, Follow toggle,
Explain toggle, end cross.

**The spotlight** (`NavSpotlight`): a 2px dark ring, radius 18, padded 6px
round the menu item, with a 6px accent halo; a caption pill "Open Team"
under it. `z-120`, pointer-events none. Clicks the item after 1.6s.

**The loader** (`SwitchLoader`): surface at 90% with a light blur, the
default art bobbing 6px, eyebrow "Opening the next step". `z-100`, under the
reader so the explanation stays readable.

## Z ladder

bar 70 · prompts 70 · loader 100 · reader 110 · spotlight 120. Keep the
host's modals above 120 or close them when a tour starts.

## Motion

- Reader: in from `x: 24, opacity 0`, out to `x: 16`; 0.32s, ease `[0.2, 0.8, 0.2, 1]`.
- Card: spring `stiffness 380, damping 32, mass 0.8` from `x: 48, scale .96`.
- Spotlight ring: from `scale 1.25`, 0.35s; caption 0.25s, 0.15s delay.
- Countdown: `stroke-dashoffset` linear per 250ms tick.
- `useReducedMotion`: every slide becomes a fade; the loader stops bobbing
  only if the host asks (it is small).

## Theming a host

1. Copy the token block; set each value from the host theme (its surface,
   its ink scale, its primary).
2. A dark host: override the same names under its dark selector.
3. Change nothing in the components. If a component needs a colour that is
   not a token, add a token.
4. Art: wire the host's illustration set into `walkthrough-art.tsx`. Keep
   the sizes (128 reader, 92 card, 96 loader).
