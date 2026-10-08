---
name: editorial
description: Editorial/magazine-style website — large serif typography, dramatic whitespace, full-bleed images, asymmetric grids, pull quotes. Best for luxury brands, fashion, architecture, photography portfolios, and storytelling.
---

# Editorial Website Builder

You build websites that feel like a high-end print magazine translated to screen. Large serif headlines, dramatic whitespace, full-bleed photography, asymmetric layouts, and a pace that lets each element breathe. Inspired by Vogue, Cereal Magazine, Kinfolk, and luxury brand sites.

## Task

$ARGUMENTS

## The Editorial DNA

- **Serif headlines** — large, elegant, with tight leading
- **Dramatic whitespace** — 200px+ margins, content floats in space
- **Full-bleed images** — edge-to-edge photography, no borders
- **Asymmetric layouts** — CSS Grid with intentional imbalance
- **Muted color palette** — cream, charcoal, warm grays, one accent
- **Pull quotes** — oversized italic text breaking the grid
- **Minimal navigation** — hamburger or minimal text links
- **Slow, intentional motion** — long fade-ins (800ms+), parallax on images

## Recipe

### Inputs to settle

Extract:
- **Subject** — brand, portfolio, publication, personal site?
- **Mood** — warm/organic, cool/architectural, dark/moody, light/airy?
- **Content** — articles, portfolio pieces, product showcase, about story?
- **Framework** — default Next.js + Tailwind + Motion

### Page Architecture

| Section | Pattern |
|---------|---------|
| **Nav** | Minimal — logo left, hamburger right, or single line of text links. Transparent over hero. |
| **Hero** | Full-bleed image with overlaid serif headline. Or split: image left (60%), text right (40%). |
| **Intro** | Large pull quote or statement, centered, max-width 700px |
| **Content Grid** | Asymmetric 2-column — large image left, text right (or reversed). Column ratio 7:5 or 8:4. |
| **Full-Width Image** | Edge-to-edge, 70-100vh, with optional caption in small caps |
| **Pull Quote** | Oversized italic serif, breaking the layout grid |
| **Gallery** | Masonry or staggered grid with varied aspect ratios |
| **Footer** | Minimal, centered, small text |

### Build Patterns

#### Serif Hero with Image
```tsx
function EditorialHero({ image, title, subtitle }: { image: string; title: string; subtitle?: string }) {
  return (
    <section className="relative h-screen overflow-hidden">
      <motion.img
        src={image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex flex-col justify-end h-full px-8 md:px-16 pb-20">
        <motion.h1
          className="font-serif text-5xl md:text-8xl text-white leading-[0.95] tracking-tight max-w-5xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            className="text-white/70 text-lg mt-4 max-w-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
}
```

#### Asymmetric Content Block
```tsx
function EditorialBlock({ image, children, reversed = false }: {
  image: string; children: React.ReactNode; reversed?: boolean;
}) {
  return (
    <section className={clsx(
      "grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-0 items-center min-h-[80vh]",
      "px-8 md:px-0"
    )}>
      <div className={clsx("md:col-span-7", reversed && "md:order-2")}>
        <ScrollImage src={image} />
      </div>
      <div className={clsx(
        "md:col-span-4 md:col-start-9 space-y-6",
        reversed && "md:col-start-1 md:order-1 md:pl-16"
      )}>
        {children}
      </div>
    </section>
  );
}
```

#### Parallax Image
```tsx
function ScrollImage({ src }: { src: string }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  return (
    <div ref={ref} className="overflow-hidden h-[70vh]">
      <motion.img src={src} alt="" className="w-full h-[110%] object-cover" style={{ y }} />
    </div>
  );
}
```

#### Pull Quote
```tsx
function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="max-w-3xl mx-auto px-8 py-32 text-center">
      <p className="font-serif italic text-3xl md:text-5xl leading-[1.2] text-stone-800">
        {children}
      </p>
    </blockquote>
  );
}
```

#### Staggered Gallery
```tsx
function EditorialGallery({ images }: { images: string[] }) {
  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 px-8 md:px-16">
      {images.map((src, i) => (
        <FadeUp key={i} delay={i * 0.05}>
          <div className="mb-4 break-inside-avoid">
            <img src={src} alt="" className="w-full" />
          </div>
        </FadeUp>
      ))}
    </div>
  );
}
```

### Typography & Color

**Typography — the soul of editorial:**
```css
body { font-family: "Instrument Serif", "Playfair Display", "EB Garamond", Georgia, serif; }
.headline { font-size: clamp(3rem, 8vw, 7rem); font-weight: 400; line-height: 0.95; letter-spacing: -0.02em; }
.body-text { font-family: "Libre Baskerville", "Source Serif Pro", Georgia, serif; font-size: 18px; line-height: 1.8; }
.caption { font-family: "Inter", "Helvetica Neue", sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #999; }
```

**Color palettes — pick one:**

| Mood | Background | Text | Accent |
|------|-----------|------|--------|
| **Warm** | `#F5F0EB` (cream) | `#2C2825` (warm black) | `#C4946A` (terracotta) |
| **Cool** | `#F7F7F5` (cool white) | `#1A1A1A` (charcoal) | `#5B7B6F` (sage) |
| **Dark** | `#1A1815` (near-black) | `#E8E4DF` (warm white) | `#B8956A` (gold) |
| **Minimal** | `#FFFFFF` (white) | `#333333` (gray) | `#000000` (black) |

### Animation

Editorial motion is **slow and deliberate** — nothing snappy:

- Page load: hero image scales from 1.1 to 1 over 1.5s
- Headlines: fade up over 800ms with ease-out
- Images: subtle parallax (5-10% movement)
- Scroll reveals: fade-in with 600-800ms duration
- Transitions between pages: crossfade (if applicable)
- No bouncy springs, no elastic easing — cubic-bezier only

```tsx
const editorialEase = [0.25, 0.1, 0.25, 1]; // Smooth, dignified
const editorialDuration = 0.8;
```

### Quality check

| Check | Requirement |
|-------|-------------|
| Serif typography | Headlines in elegant serif, properly paired |
| Whitespace | 200px+ section padding, content never crowded |
| Full-bleed images | At least one edge-to-edge image section |
| Asymmetry | No symmetrical 50/50 layouts — use 7:5 or 8:4 |
| Color | Muted, cohesive — no bright saturated colors |
| Motion | Slow fade-ins (600ms+), subtle parallax |
| Typography scale | Clear hierarchy: headline → subhead → body → caption |
| Mobile | Single column, maintain generous spacing |
| Pull quote | At least one oversized quote breaking the flow |
| Print feel | Looks like it could be a page from a magazine |

## The Standard

It should feel like opening a $30 coffee table magazine. Luxurious pace. Every image chosen with intention. Typography that whispers authority.
