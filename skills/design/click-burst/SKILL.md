---
name: click-burst
description: >-
  Adds a performant click-triggered full-viewport color burst transition (scale +
  opacity only, no animated blur). Use when the user asks for click-burst, burst
  on click, color burst transition, burst overlay, or wants the Perspiva-style
  navigation burst in React/Next.js with motion/react.
user-invokable: true
---

# Click Burst

A GPU-composited color burst that expands from a click origin and fills the viewport before navigation or state change. **Click only — never on hover.**

## When to use

- Page or panel transitions after a deliberate click
- Card pickers, CTAs, back buttons, mode toggles
- Any moment where the burst masks a route change or heavy UI swap

## Defaults

Use these unless the user or project specifies otherwise:

| Option | Default | Notes |
|--------|---------|-------|
| `color` | `rgba(178, 128, 255, 0.70)` | Semi-transparent rgba recommended |
| `durationMs` | `2000` | Full burst animation length |
| `navigateDelayMs` | `760` | When to run `onNavigate` after click (0 = immediate action) |
| `initialScale` | `0` | Burst start size |
| `finalScale` | `6` | Fills viewport from typical click origins |
| `initialOpacity` | `0.62` | Peak visibility |
| `finalOpacity` | `0` | Fade out at end |
| `ease` | `[0.22, 1, 0.36, 1]` | Cubic-bezier |
| `discSize` | `50vmax` | Base gradient disc diameter |
| `zIndex` | `99998` | Above app chrome, below modals if needed |

## Hard rules

1. **Click only.** Never attach the burst to `mouseenter`, `mouseover`, or hover timers.
2. **Animate only `transform` and `opacity`.** Never animate `clip-path`, `filter: blur()`, or `background` on the burst layer.
3. **Portal to `document.body`.** Keeps stacking context predictable.
4. **Key each burst instance** (`id` counter) inside `AnimatePresence` so sequential clicks re-animate.
5. **Respect `prefers-reduced-motion`.** Skip burst and call `onNavigate` immediately when reduced motion is preferred.
6. **Guard double-clicks** with a ref (`clickingRef`) when navigation follows the burst.

## Implementation workflow

1. **Detect stack** — React + `motion/react` (Framer Motion v12). If the project uses `framer-motion`, swap the import only.
2. **Add component** — Copy from [reference.md](reference.md) into `components/shared/BurstOverlay.tsx` (or project-equivalent path). Extend props from `BurstConfig` when the user wants custom pace/color.
3. **Wire the hook** — Prefer `useBurstController({ ...config })` at the page or feature root; render `{burstNode}` once near the root of the client tree.
4. **Fire on click** — Use `fireBurstFromElement(event.currentTarget, color, onNavigate)` or manual `(x, y, color, onNavigate)`.
5. **Tune per surface** — Override `color` and `navigateDelayMs` per button/card; keep animation physics on defaults unless asked.

## Quick integration

```tsx
const { burstNode, fireBurstFromElement } = useBurstController();

const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  fireBurstFromElement(
    event.currentTarget,
    "rgba(232, 74, 12, 0.65)", // brand override
    () => router.push("/next"),
  );
};

return (
  <>
    <button type="button" onClick={handleClick}>Continue</button>
    {burstNode}
  </>
);
```

## Customization guide

| User asks for… | Change |
|----------------|--------|
| Faster/slower burst | `durationMs` |
| Navigate sooner/later | `navigateDelayMs` (760 ≈ burst mostly filled) |
| Stronger/weaker flash | `initialOpacity`, `finalScale` |
| Brand color | `color` only — keep rgba alpha ~0.5–0.7 |
| Instant action, burst cosmetic | `navigateDelayMs: 0` |
| Softer edge | Widen gradient stops in `background` string — do not add blur |

## Anti-patterns (do not reintroduce)

```tsx
// BAD — hover burst
onMouseEnter={() => fireBurst(x, y, color)}

// BAD — choppy full-viewport blur
animate={{ filter: "blur(40px)" → "blur(108px)", clipPath: "circle(...)" }}

// BAD — animating flex/blur on sibling content during burst
transition: "filter 220ms ease"
```

## File map (reference implementation)

| Export | Role |
|--------|------|
| `BurstOverlay` | Presentational burst; accepts `BurstOverlayProps & Partial<BurstConfig>` |
| `useBurstController` | State + `fireBurst` + `fireBurstFromElement` + `burstNode` |
| `BurstTrigger` | Render-prop wrapper when hook wiring is awkward |

Full source and preset colors: [reference.md](reference.md). Integration recipes: [examples.md](examples.md).

## Verification checklist

- [ ] Burst fires only on `click` / `onClick`
- [ ] No animated `filter` or `clip-path` on burst layer
- [ ] `AnimatePresence` + keyed `BurstOverlay`
- [ ] `onNavigate` timing matches user expectation
- [ ] Reduced-motion path skips animation
- [ ] Double-click does not double-navigate
