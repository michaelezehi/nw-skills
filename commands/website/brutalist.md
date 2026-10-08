---
name: brutalist
description: Neo-brutalist website — bold borders, hard shadows, raw typography, high contrast colors, deliberately unpolished. Best for creative agencies, portfolios, fashion brands, and anything that wants to stand out.
---

# Neo-Brutalist Website Builder

You build websites that reject polish in favor of raw energy. Thick borders, hard offset shadows, monospace type, bright clashing colors, and layouts that feel deliberately handmade. Inspired by Balenciaga, Craigslist-core, and anti-design movements.

## Task

$ARGUMENTS

## The Brutalist DNA

- **Thick black borders** (2-4px solid) on everything
- **Hard offset shadows** — solid color, no blur (4-8px offset)
- **High contrast** — bright yellow, electric blue, hot pink on white or black
- **Raw typography** — monospace or bold grotesque, oversized headlines
- **Visible structure** — grid lines shown, no hidden complexity
- **No rounded corners** — sharp edges only
- **Minimal imagery** — text and shape-driven
- **Deliberate "unfinished" feel** — like a prototype that ships

## Recipe

### Inputs to settle

Extract:
- **Purpose** — agency site, portfolio, product, editorial?
- **Tone** — playful-raw, aggressive-punk, intellectual-minimal, ironic?
- **Content** — what sections needed?
- **Framework** — default Next.js + Tailwind, pure CSS also fine

### Page Architecture

| Section | Pattern |
|---------|---------|
| **Nav** | Plain text links, monospace, thick bottom border. No frosted glass. |
| **Hero** | Massive headline (120px+), hard shadow, single accent color block |
| **Feature Grid** | Visible grid with thick borders between cells |
| **About/Bio** | Single column, left-aligned, no centering. Raw paragraph text. |
| **Gallery** | Flat grid, no hover effects or shadows — just images in bordered boxes |
| **Contact/CTA** | Plain form with thick-bordered inputs, oversized submit button |
| **Footer** | Minimal, monospace, same border treatment |

### Build Patterns

#### Hard Shadow Card
```tsx
function BrutCard({ children, color = "#FFE500" }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="border-[3px] border-black bg-white p-6 relative"
      style={{ boxShadow: `6px 6px 0px 0px ${color}` }}
    >
      {children}
    </div>
  );
}
```

#### Oversized Headline
```tsx
function BrutHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[clamp(3rem,10vw,8rem)] font-black uppercase leading-[0.9] tracking-tight">
      {children}
    </h1>
  );
}
```

#### Bordered Grid
```tsx
function BrutGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-[3px] border-black">
      {React.Children.map(children, (child) => (
        <div className="border-[1.5px] border-black p-6">{child}</div>
      ))}
    </div>
  );
}
```

#### Brutalist Button
```tsx
function BrutButton({ children, color = "#FF3366" }: { children: React.ReactNode; color?: string }) {
  return (
    <button
      className="border-[3px] border-black px-8 py-3 font-mono font-bold uppercase text-sm tracking-wider
        hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-0 active:translate-y-0
        transition-transform duration-100"
      style={{ backgroundColor: color, boxShadow: "4px 4px 0px 0px #000" }}
    >
      {children}
    </button>
  );
}
```

#### Marquee Ticker
```tsx
function Marquee({ text, speed = 20 }: { text: string; speed?: number }) {
  return (
    <div className="overflow-hidden border-y-[3px] border-black py-3">
      <div
        className="whitespace-nowrap font-mono text-2xl font-bold uppercase animate-marquee"
        style={{ animationDuration: `${speed}s` }}
      >
        {Array(4).fill(text).map((t, i) => (
          <span key={i} className="mx-8">{t} ★</span>
        ))}
      </div>
    </div>
  );
}
```

```css
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-marquee { animation: marquee linear infinite; }
```

### Typography & Color

**Typography — non-negotiable:**
```css
body { font-family: "Space Mono", "IBM Plex Mono", "Courier New", monospace; }
.headline { font-family: "Space Grotesk", "DM Sans", "Arial Black", sans-serif; font-weight: 900; text-transform: uppercase; }
```

**Core palette — pick 2-3 per project:**

| Role | Options |
|------|---------|
| Background | `#FFFFFF` (white), `#F5F0EB` (cream), `#000000` (black) |
| Primary accent | `#FFE500` (yellow), `#FF3366` (hot pink), `#3300FF` (electric blue) |
| Secondary | `#00FF88` (green), `#FF6600` (orange), `#CC00FF` (purple) |
| Text | `#000000` on light, `#FFFFFF` on dark |

**Rules:**
- No gradients. Flat colors only.
- No blur effects, no glassmorphism.
- No rounded corners anywhere — `rounded-none` on everything.
- Borders visible everywhere — structure is the aesthetic.

### Animation (Minimal)

Brutalist sites use **little or no animation**. What exists is mechanical:

- Hover: translate shadow offset (`-2px, -2px`) to feel like a physical button press
- Page load: instant. No fade-ins. Content appears immediately.
- Scroll: no parallax, no scrub. Content just exists.
- Cursor: consider custom cursor (crosshair or oversized dot)

```css
* { cursor: crosshair; }
a, button { cursor: pointer; }
```

### Quality check

| Check | Requirement |
|-------|-------------|
| Borders | 2-4px solid black on cards, sections, inputs |
| Shadows | Hard offset, no blur, solid color |
| Typography | Monospace body, bold grotesque headlines |
| Colors | 2-3 max, high contrast, no gradients |
| Corners | Zero border-radius anywhere |
| Structure | Grid lines visible, layout is the design |
| Imagery | Minimal, bordered, no decorative filters |
| Mobile | Stack to single column, maintain borders |
| Speed | Instant load — no heavy assets or animations |

## The Standard

It should look like it was designed by someone who hates design trends — and that's the point. Raw. Bold. Memorable. The kind of site people screenshot and share.
