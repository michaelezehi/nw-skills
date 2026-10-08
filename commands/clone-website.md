---
name: clone-website
description: Clone any website pixel-perfectly — captures screenshots, extracts design tokens, generates React + Tailwind code, and QA-reviews until matched. Pass a URL to clone.
argument-hint: <url>
---
# Website Cloner — Pixel-Perfect Replication

You are an expert frontend engineer specializing in pixel-perfect website replication. You will clone the target website by extracting its actual design system (colors, typography, spacing, layout, assets, animations) and generating production-ready React + Tailwind CSS code.

## Target

$ARGUMENTS

## Protocol

Execute these 4 phases sequentially. Each phase builds on the previous.

---

### Phase 1: Capture — Visual Baseline

Use Playwright MCP to capture the target site at multiple viewports.

**Steps:**

1. Navigate to the URL and resize to desktop:
```
mcp__plugin_playwright_playwright__browser_navigate → url
mcp__plugin_playwright_playwright__browser_resize → width: 1440, height: 900
```

2. Dismiss cookie banners and popups before capturing — pass the contents of `~/.claude/scripts/clone-website/extract-dismiss-overlays.js` to:
```
mcp__plugin_playwright_playwright__browser_evaluate → <script>
```

3. Scroll to bottom to trigger lazy-loaded content, then back to top — pass `~/.claude/scripts/clone-website/extract-scroll-lazy.js` to `browser_evaluate` (async; 15s cap).

4. Take full-page screenshot at desktop (1440px):
```
mcp__plugin_playwright_playwright__browser_take_screenshot → fullPage: true
```

5. Take a DOM snapshot for structure:
```
mcp__plugin_playwright_playwright__browser_snapshot
```

6. Capture at tablet (768px) and mobile (375px):
```
mcp__plugin_playwright_playwright__browser_resize → width: 768, height: 1024
mcp__plugin_playwright_playwright__browser_take_screenshot → fullPage: true
mcp__plugin_playwright_playwright__browser_resize → width: 375, height: 812
mcp__plugin_playwright_playwright__browser_take_screenshot → fullPage: true
mcp__plugin_playwright_playwright__browser_resize → width: 1440, height: 900
```

7. Identify all major sections from the snapshot. For key interactive elements (buttons, links, cards), capture hover states:
```
mcp__plugin_playwright_playwright__browser_hover → element selector
mcp__plugin_playwright_playwright__browser_take_screenshot
```

8. Detect dark mode — check if site has a theme toggle or `prefers-color-scheme` media query — pass `~/.claude/scripts/clone-website/extract-dark-mode.js` to `browser_evaluate` (returns `{ hasDarkToggle, hasDarkMedia }`).
If dark mode exists, toggle it and capture a second set of screenshots.

**Output:** Screenshots at 3 viewports (+ dark mode if applicable), section list, DOM snapshot.

---

### Phase 2: Extract — Design Token Mining

Use Playwright's JavaScript evaluation to extract the site's design system. The three extraction scripts live in `~/.claude/scripts/clone-website/` — `Read` each one and pass its contents to `mcp__plugin_playwright_playwright__browser_evaluate` in this order:

1. **`extract-design-tokens.js`** — cssVars, colors, fonts (family|weight), font sizes, letter-spacing, line-height, spacing, border radius, shadows, gradients, assets (images, inline SVGs, Google Fonts links), keyframe animations, viewport, title, meta description.

2. **`extract-sections.js`** — section-level layout structure (`header/nav/main/section/footer` + hero/section/container classes): display/flex/grid/gap/padding/maxWidth, dimensions, and per-section content (headings, paragraphs, buttons, links, images). Returns up to 40 sections.

3. **`extract-raw-css.js`** — raw CSS rules, the source of truth for responsive behavior, hover states, and cascade logic: `mediaQueries` (per breakpoint), `hoverRules`, `transitionRules`, and `selectorRules` using responsive units (%, vw, vh, rem, em, clamp, min, max).

Use raw CSS over computed styles when they conflict, because raw CSS preserves the authored intent:
- `margin: 0 auto` instead of computed `margin: 0px 312px`
- `width: 100%` instead of computed `width: 1440px`
- `gap: 2rem` instead of computed `gap: 32px`
- `clamp(1rem, 2vw, 2rem)` instead of computed `24.5px`
- Hover state colors/transforms as authored
- Media query breakpoints with their exact rules
- Transition timing functions and delays

**Finally, get the full page text for copy replication:**
```
mcp__plugin_playwright_playwright__browser_evaluate →
document.body.innerText.substring(0, 10000)
```

**Output:** Complete design token map, raw CSS rules (media queries, hover states, transitions, responsive units), and text content.

---

### Phase 2.5: Asset Download

Download key assets locally for the clone.

**Steps:**

1. Create the assets directory:
```bash
mkdir -p public/cloned-assets/images public/cloned-assets/svg
```

2. For each image URL extracted in Phase 2, download via curl:
```bash
curl -sL "<image-url>" -o "public/cloned-assets/images/<filename>"
```

3. For Google Fonts, extract the font import URL and add to the component's CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=FontName:wght@400;500;600;700&display=swap');
```

4. For SVGs that were fully captured (< 2000 chars), save as `.svg` files. For larger ones, note their source URL.

5. If any downloads fail (CORS, 403), note the URL and use a placeholder. Add a comment in the code: `{/* Original: <url> */}`

**Output:** `public/cloned-assets/` directory with downloaded images and SVGs.

---

### Phase 3: Clone — Code Generation

Generate the cloned website as React + Tailwind CSS components.

**Rules:**

1. **Map extracted tokens to Tailwind:**
   - Colors → CSS variables in `:root` + Tailwind `extend.colors`
   - Font sizes → Tailwind type scale or custom `clamp()` values
   - Spacing → Tailwind spacing scale or custom values
   - Border radius → Tailwind `rounded-*` or custom
   - Shadows → Tailwind `shadow-*` or custom

2. **Structure:**
   - One page component importing section components
   - Each major section = separate component
   - Shared layout wrapper with max-width matching original
   - Google Fonts loaded via `<link>` in head or `next/font`

3. **Layout replication — use raw CSS units, NOT computed pixels:**
   - If raw CSS says `width: 100%` or `max-width: 80rem`, use that — never the computed `1440px`
   - Use `margin: 0 auto` for centering, not computed pixel margins
   - Preserve `clamp()`, `min()`, `max()` fluid values exactly as authored
   - Use `gap: 2rem` not `gap: 32px` — raw CSS is the source of truth
   - Apply media query breakpoints from raw CSS extraction to Tailwind responsive prefixes (`md:`, `lg:`, etc.)

4. **Visual fidelity:**
   - Match exact colors (convert RGB to hex/oklch for Tailwind)
   - Replicate gradients, shadows, border-radius exactly
   - Use actual font families (with fallbacks)
   - Reproduce animations via Tailwind or `motion` (framer-motion)
   - Apply hover/focus states from raw CSS `hoverRules` — these are the authored values, not inferred
   - Apply transitions from raw CSS `transitionRules` — preserve exact timing, easing, delay

5. **Assets:**
   - Use extracted image URLs directly (or download to `public/`)
   - Inline small SVGs, reference large ones
   - Note any assets that couldn't be accessed (CORS)

6. **Framework detection:**
   - If project uses Next.js → generate Next.js page components
   - If project uses plain React → generate standard components
   - Default: React + Tailwind + Motion (framer-motion)

7. **File organization:**
   - `components/cloned/<site-name>/` directory
   - `page.tsx` or `index.tsx` as entry
   - Section components: `Hero.tsx`, `Features.tsx`, `Pricing.tsx`, etc.
   - `styles.css` for any custom CSS (keyframes, complex gradients)

**Output:** Complete React + Tailwind codebase replicating the original site.

---

### Phase 4: QA — Visual Comparison

Compare the clone against the original.

**Steps:**

1. If a dev server is running, navigate to the cloned page and screenshot it
2. Compare side-by-side with the original screenshots from Phase 1
3. Classify any differences:

| Severity | Definition | Action |
|----------|-----------|--------|
| **Critical** | Wrong layout structure, missing sections, broken grid | Must fix — loop back to Phase 3 |
| **Major** | Wrong colors, fonts, spacing off by >8px, missing assets | Should fix — loop back to Phase 3 |
| **Minor** | Spacing off by 1-4px, slight color variation, animation timing | Note but accept |

4. If Critical or Major defects found:
   - Document specific defects with element references
   - Return to Phase 3 with targeted fixes
   - Maximum 3 QA iterations before accepting

5. Final output checklist:
   - [ ] All sections present and correctly ordered
   - [ ] Colors match within 5% tolerance
   - [ ] Typography matches (family, size, weight)
   - [ ] Layout matches at desktop, tablet, mobile
   - [ ] Images and assets present (or placeholders noted)
   - [ ] Animations replicated where feasible
   - [ ] Code is clean, componentized, production-ready

---

## Output Format

When complete, provide:

1. **Design Token Summary** — extracted color palette, type scale, spacing scale
2. **Component Tree** — file structure with component breakdown
3. **Generated Code** — all component files
4. **QA Report** — comparison notes, any accepted deviations
5. **Asset Notes** — fonts to install, images to download, any licensing concerns

## Important Notes

- Use Playwright MCP tools (`mcp__plugin_playwright_playwright__*`) for all browser interactions
- If Playwright is unavailable, fall back to `mcp__claude-in-chrome__*` tools
- Never hardcode pixel values when Tailwind utilities exist
- Prefer CSS variables for colors to enable easy theming
- Keep components under 200 lines — split if larger
- The goal is visual fidelity, not code-level replication of the original source
