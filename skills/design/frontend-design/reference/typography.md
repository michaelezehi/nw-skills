# Typography

## Classic Typography Principles

### Vertical Rhythm

Your line-height should be the base unit for ALL vertical spacing. If body text has `line-height: 1.5` on `16px` type (= 24px), spacing values should be multiples of 24px. This creates subconscious harmony: text and space share a mathematical foundation.

### Modular Scale & Hierarchy

The common mistake: too many font sizes that are too close together (14px, 15px, 16px, 18px...). This creates muddy hierarchy.

**Use fewer sizes with more contrast.** A 5-size system covers most needs:

| Role | Typical Ratio | Use Case |
|------|---------------|----------|
| xs | 0.75rem | Captions, legal |
| sm | 0.875rem | Secondary UI, metadata |
| base | 1rem | Body text |
| lg | 1.25-1.5rem | Subheadings, lead text |
| xl+ | 2-4rem | Headlines, hero text |

Popular ratios for marketing pages: 1.25 (major third), 1.333 (perfect fourth), 1.5 (perfect fifth). Pick one and commit.

**Product UI takes a tighter, fixed scale**: steps of 1.125 to 1.2 in rem, no fluid sizes. Product screens hold more type elements than a landing page, so wide contrast between steps becomes noise. In a design-system app the type tokens already set this.

### Readability & Measure

Use `ch` units for character-based measure (`max-width: 65ch`). Line-height scales inversely with line length: narrow columns need tighter leading, wide columns need more.

**Use modern wrapping by default** (both Baseline): `text-wrap: balance` on headings evens out ragged lines; `text-wrap: pretty` on body text prevents orphans.

**Non-obvious**: Increase line-height for light text on dark backgrounds. The perceived weight is lighter, so text needs more breathing room. Add 0.05-0.1 to your normal line-height.

## Font Selection & Pairing

### Choosing Fonts

**On the Extend track the brand's faces are right by definition.** Use the families the design system or the app's tokens set, whatever they are.

**On the Direct track, choose from the subject, not from a list.** A swap list ("instead of X, use Y") only moves everyone to the same second choice. Pick the face for a reason the subject supplies (its era, its material, its trade) and write that reason down. The method is in [direction.md](direction.md).

**System fonts are underrated**: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui` looks native, loads instantly, and is highly readable. Consider this for apps where performance > personality.

### Pairing Principles

**The non-obvious truth**: You often don't need a second font. One well-chosen font family in multiple weights creates cleaner hierarchy than two competing typefaces. Only add a second font when you need genuine contrast (e.g., display headlines + body serif).

When pairing, contrast on multiple axes:
- Serif + Sans (structure contrast)
- Geometric + Humanist (personality contrast)
- Condensed display + Wide body (proportion contrast)

**Never pair fonts that are similar but not identical** (e.g., two geometric sans-serifs). They create visual tension without clear hierarchy.

### Web Font Loading

The layout shift problem: fonts load late, text reflows, and users see content jump. Here's the fix:

```css
/* 1. Use font-display: swap for visibility */
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: swap;
}

/* 2. Match fallback metrics to minimize shift */
@font-face {
  font-family: 'CustomFont-Fallback';
  src: local('Arial');
  size-adjust: 105%;        /* Scale to match x-height */
  ascent-override: 90%;     /* Match ascender height */
  descent-override: 20%;    /* Match descender depth */
  line-gap-override: 10%;   /* Match line spacing */
}

body {
  font-family: 'CustomFont', 'CustomFont-Fallback', sans-serif;
}
```

Tools like [Fontaine](https://github.com/unjs/fontaine) calculate these overrides automatically.

## Modern Web Typography

### Fluid Type

Use `clamp(min, preferred, max)` for fluid typography. The middle value (e.g., `5vw + 1rem`) controls scaling rate: higher vw means faster scaling. Add a rem offset so it doesn't collapse to 0 on small screens.

**When not to use fluid type**: product UI as a whole, button text, labels, UI elements (they should be consistent), very short text, or when you need precise breakpoint control. Fluid type is for marketing headlines.

### OpenType Features

Most developers don't know these exist. Use them for polish:

```css
/* Tabular numbers for data alignment; figures also never wrap */
.data-table td.num { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }

/* Proper fractions */
.recipe-amount { font-variant-numeric: diagonal-fractions; }

/* Small caps for abbreviations */
abbr { font-variant-caps: all-small-caps; }

/* Disable ligatures in code */
code { font-variant-ligatures: none; }
```

## Typography System Architecture

Name tokens semantically (`--text-body`, `--text-heading`), not by value (`--font-size-16`). Include font stacks, size scale, weights, line-heights, and letter-spacing in your token system.

## Accessibility Considerations

Beyond contrast ratios (which are well-documented), consider:

- **Never disable zoom**: `user-scalable=no` breaks accessibility. If your layout breaks at 200% zoom, fix the layout.
- **Use rem/em for font sizes**: This respects user browser settings. Never `px` for body text.
- **Minimum 16px for reading text**: paragraphs, articles, form help on mobile. Smaller strains eyes. Dense UI (table cells, labels, meta rows) can sit below it when the design system's density sets the size.
- **Adequate touch targets**: Text links need padding or line-height that creates 44px+ tap targets.

---

**Avoid**: More than 2-3 font families per project. Skipping fallback font definitions. Ignoring font loading performance (FOUT/FOIT). Using decorative fonts for body text.
