# Responsive Design

## Mobile-First: Write It Right

Start with base styles for mobile, use `min-width` queries to layer complexity. Desktop-first (`max-width`) means mobile loads unnecessary styles first.

## Breakpoints: Content-Driven

Don't chase device sizes; let content tell you where to break. Start narrow, stretch until design breaks, add breakpoint there. Three breakpoints usually suffice (640, 768, 1024px). Use `clamp()` for fluid values without breakpoints.

## Detect Input Method, Not Just Screen Size

**Screen size doesn't tell you input method.** A laptop with touchscreen, a tablet with keyboard: use pointer and hover queries.

```css
/* Fine pointer (mouse, trackpad) */
@media (pointer: fine) {
  .button { padding: 8px 16px; }
}

/* Coarse pointer (touch, stylus) */
@media (pointer: coarse) {
  .button { padding: 12px 20px; }  /* Larger touch target */
}

/* Device supports hover */
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); }
}

/* Device doesn't support hover (touch) */
@media (hover: none) {
  .card { /* No hover state - use active instead */ }
}
```

**Critical**: Don't rely on hover for functionality. Touch users can't hover.

## Safe Areas: Handle the Notch

Modern phones have notches, rounded corners, and home indicators. Use `env()`:

```css
/* With fallback */
.footer {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

**Enable viewport-fit** in your meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

## Responsive Images: Get It Right

### srcset with Width Descriptors

```html
<img
  src="hero-800.jpg"
  srcset="
    hero-400.jpg 400w,
    hero-800.jpg 800w,
    hero-1200.jpg 1200w
  "
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Hero image"
>
```

**How it works**: `srcset` lists available images with their actual widths (`w` descriptors), `sizes` says how wide the image will display, and the browser picks the best file for viewport width AND device pixel ratio.

### Picture Element for Formats and Art Direction

Serve modern formats with `<picture>`: AVIF `<source type="image/avif">` first (~20% smaller than WebP, 95%+ support), WebP second, JPEG fallback.

When you need different crops/compositions (not just resolutions):

```html
<picture>
  <source media="(min-width: 768px)" srcset="wide.jpg">
  <source media="(max-width: 767px)" srcset="tall.jpg">
  <img src="fallback.jpg" alt="...">
</picture>
```

## Layout Adaptation Patterns

**Navigation**: in an app, the shell's own responsive behaviour decides; never rebuild it. On a marketing site, three stages: a menu button and drawer on mobile, compact horizontal on tablet, full labels on desktop. **Tables**: scroll inside their own wrapper (`overflow-x: auto` on a container) so the page never scrolls sideways. Turn rows into cards (`display: block` with `data-label` attributes) only when each row is read on its own, not when figures are compared down a column. **Progressive disclosure**: Use `<details>/<summary>` for content that can collapse on mobile.

## Checking by Reading the Code

The user checks the running app on real devices. Your check is a read of the code at 375, 768 and 1280 px:

- **Overflow**: every flex child that holds text has `min-w-0`; grid tracks use `minmax(0, 1fr)`, not bare `1fr`, when they hold text or tables. A missing `min-w-0` is the usual cause of a page that scrolls sideways at 375.
- **Fixed widths**: flag any `w-[NNNpx]`, `min-w-[NNNpx]` or `width: NNNpx` on content. Over 343 px (375 less a 16 px gutter each side) it overflows a phone.
- **Tables and code**: wide content scrolls inside its own wrapper.
- **One-line strings**: for each label, button, nav item, stat and meta row that must not wrap, add up the widths it shares a row with at each breakpoint. If the sum can exceed the container, fix the cause (a `max-width` cap, a narrow track, a greedy sibling) or plan the break.
- **Viewport height**: `min-h-[100dvh]`, never `h-screen`, so the mobile browser bar does not cut the content.
- **Every multi-column layout** declares what happens below 768 px in the same component.
- **Hover**: nothing works by hover alone; hover styles sit inside `@media (hover: hover)`.

List in the report any layout you could not prove fits, so the user knows where to look.

---

**Avoid**: Desktop-first design. Device detection instead of feature detection. Separate mobile/desktop codebases. Ignoring tablet and landscape. Assuming all mobile devices are powerful.
