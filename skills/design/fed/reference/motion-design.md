# Motion Design

Hardened with Emil Kowalski's design-engineering rules. For the full philosophy, load the `emil-design-eng` skill. For naming an effect, use `animation-vocabulary`.

## Decision gate (run before any animation code)

1. **Frequency** — 100+/day or keyboard-initiated → no animation. Tens/day → near-imperceptible or none. Occasional → standard. Rare → delight allowed.
2. **Purpose** — Must be one of: feedback, spatial consistency, state indication, preventing jarring change, explanation, or delight (rare only).
3. **Easing** — Enter/exit: ease-out. On-screen move: ease-in-out. Never ease-in on UI.
4. **Budget** — UI under 300ms unless marketing/explanatory.

## Duration budgets

| Element | Duration |
|---------|----------|
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers | 200–500ms |
| Page-load / hero orchestration | 500–800ms (stagger total capped) |
| Marketing / explanatory | Can be longer |

**Exit faster than enter** (~75% of enter duration). Asymmetric timing: deliberate press can be slow; release is always snappy.

## Custom easing (prefer these over built-ins)

```css
/* Strong ease-out — default for UI responding to the user */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);

/* Strong ease-in-out — elements already on screen moving A → B */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

/* iOS-like drawer */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

/* Expo out — snappy page reveals */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

Built-in `ease` / `ease-in` / `ease-in-out` are too weak for intentional UI. Never use `ease-in` on entering UI — it delays the first visible movement.

**Avoid bounce/elastic on product UI.** Subtle spring bounce (0.1–0.3) only for rare delight or drag-to-dismiss. Real objects decelerate smoothly.

## Properties

Animate **transform** and **opacity** only. Layout props (`width`, `height`, `padding`, `margin`, `top`, `left`) cause jank.

- Height/accordion: `grid-template-rows: 0fr → 1fr`, or clip-path reveals
- Never enter from `scale(0)` — use `scale(0.95)` + `opacity: 0`
- Popovers/menus: `transform-origin` at the trigger (Base UI: `var(--transform-origin)`). Modals stay centered
- Prefer CSS **transitions** over keyframes for interruptible UI (toasts, toggles)
- Framer/Motion under load: prefer `transform: "translateX()"` over `x`/`y` shorthands for GPU path
- Hover motion only inside `@media (hover: hover) and (pointer: fine)`

## Press feedback (default on every pressable)

```css
.pressable {
  transition: transform 160ms var(--ease-out);
}
.pressable:active {
  transform: scale(0.97);
}
```

## Stagger

30–80ms between items. Cap total cascade time. Never block interaction while stagger plays.

```css
.item {
  animation: fade-up 300ms var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 50ms);
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

## Orchestration over scatter

One well-timed page-load or scroll-reveal sequence beats dozens of unrelated micro-interactions. Match motion personality to the product (crisp dashboard ≠ playful consumer).

## Springs (gestures & alive decoration)

```js
// Apple-style (easier to reason about)
{ type: "spring", duration: 0.5, bounce: 0.2 }

// Velocity dismiss threshold (~0.11)
const velocity = Math.abs(distance) / elapsedMs;
```

Use springs for drag, interruptible gestures, and decorative mouse-tracking (`useSpring`). Not for every dropdown.

## View Transitions & modern CSS

- Same-document View Transitions are Baseline — prefer over hand-rolled FLIP
- `@starting-style` for enter animations without JS mount hacks
- `clip-path: inset(...)` for reveals, tab color wipes, hold-to-confirm fills

## Reduced motion

Gentler, not necessarily zero: keep opacity/color that aid comprehension; drop spatial movement.

```css
@media (prefers-reduced-motion: reduce) {
  .reveal {
    animation: fade 200ms ease-out; /* no translate */
  }
}
```

```jsx
const reduce = useReducedMotion();
const y = reduce ? 0 : 16;
```

## Anti-patterns (instant fails)

| Bad | Fix |
|---|---|
| `transition: all` | Name properties: `transform, opacity` |
| `scale(0)` entry | `scale(0.95)` + opacity |
| `ease-in` on UI | Custom ease-out |
| Center origin on popover | Origin at trigger |
| Animation on keyboard action | Remove entirely |
| Duration > 300ms on UI chrome | Cut to budget |
| Hover without fine-pointer gate | Add hover media query |
| Keyframes on rapid toggles | CSS transitions |
| Identical entrance on every section | One orchestrated moment |
| Motion with no purpose | Delete it |
