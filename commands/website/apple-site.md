---
name: apple-site
description: Apple-style scroll-animated product pages — pinned sections, canvas image sequences, text reveals, parallax depth, cinematic spacing. Best for product launches, hardware showcases, and premium landing pages.
---

# Apple-Style Website Builder

You are a senior creative developer building scroll-driven animated websites inspired by Apple product pages. Cinematic, narrative-driven experiences using GSAP ScrollTrigger, canvas image sequences, and precision typography.

## Task

$ARGUMENTS

## Recipe

### Inputs and narrative

Extract from the prompt:
- **Product/Subject** — what's being showcased
- **Key moments** — 3-5 features or messages to reveal through scroll
- **Assets available** — images, videos, image sequences, or generate with /image-gen
- **Dark or light** — default to dark (Apple's standard for product reveals)
- **Framework** — default to Next.js + Tailwind + GSAP unless specified

If a reference image is provided, run:
```bash
python3 ~/Documents/src/agents/scripts/frontend/image_analyzer.py "<path>"
```

### Choose a Page Architecture

Select from these Apple-proven section types and sequence them:

| Section Type | Effect | When to Use |
|-------------|--------|-------------|
| **Pinned Hero** | Full-viewport, product centered, tagline fades in | Always first |
| **Canvas Sequence** | Image frames play on scroll like a video | Product rotation, unboxing |
| **Text Reveal** | Large headline appears word-by-word | Feature announcement |
| **Parallax Split** | Image + text at different scroll speeds | Feature detail |
| **Full-Bleed Image** | Edge-to-edge shot with overlay text | Aspirational moment |
| **Sticky Comparison** | Left pinned, right scrolls through options | Specs, variants |
| **Horizontal Scroll** | Vertical scroll drives horizontal movement | Gallery, carousel |
| **Fade Crossfade** | Sections crossfade via opacity | Narrative transitions |
| **CTA Close** | Minimal centered call-to-action | Always last |

**Default product page sequence:**
```
Pinned Hero → Text Reveal → Canvas Sequence → Parallax Split → Full-Bleed → Text Reveal → Specs Grid → CTA
```

### Set Up the Stack

```bash
npm install gsap @gsap/react lenis
```

**GSAP registration (once, in layout or provider):**
```tsx
"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
gsap.registerPlugin(ScrollTrigger);
```

**Smooth scroll setup (global):**
```tsx
useEffect(() => {
  const lenis = new Lenis({ lerp: 0.1, duration: 1.2 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return () => { lenis.destroy(); gsap.ticker.remove(lenis.raf); };
}, []);
```

### Build with These Patterns

#### Pinned Hero
```tsx
const heroRef = useRef<HTMLDivElement>(null);
useGSAP(() => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: heroRef.current, pin: true, scrub: 1,
      start: "top top", end: "+=150%",
    }
  });
  tl.from(".hero-tagline", { opacity: 0, y: 60, duration: 0.5 })
    .from(".hero-subtitle", { opacity: 0, y: 40, duration: 0.5 }, "-=0.2")
    .to(".hero-product", { scale: 0.9, opacity: 0.5, duration: 1 }, "+=0.3");
}, { scope: heroRef });
```

#### Canvas Image Sequence
```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
const sectionRef = useRef<HTMLDivElement>(null);
useGSAP(() => {
  const canvas = canvasRef.current!;
  const ctx = canvas.getContext("2d")!;
  const frameCount = 120;
  const images: HTMLImageElement[] = [];
  let loaded = 0;

  for (let i = 0; i < frameCount; i++) {
    const img = new Image();
    img.src = `/frames/frame_${String(i).padStart(4, "0")}.webp`;
    img.onload = () => { loaded++; if (loaded === frameCount) initAnim(); };
    images.push(img);
  }

  function render(index: number) {
    const img = images[index];
    canvas.width = img.width; canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }

  function initAnim() {
    render(0);
    const obj = { frame: 0 };
    gsap.to(obj, {
      frame: frameCount - 1, snap: "frame", ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current, pin: true, scrub: 0.5,
        start: "top top", end: "+=300%",
      },
      onUpdate: () => render(obj.frame),
    });
  }
}, { scope: sectionRef });
```

#### Text Reveal (No SplitText Plugin)
```tsx
function SplitHeadline({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(() => {
    const words = ref.current!.querySelectorAll(".word");
    gsap.from(words, {
      opacity: 0, y: 80, rotateX: -40, stagger: 0.06, duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: ref.current, start: "top 80%", end: "top 30%", scrub: true },
    });
  }, { scope: ref });

  return (
    <h2 ref={ref} className="text-6xl md:text-8xl font-semibold tracking-tight leading-none">
      {text.split(" ").map((w, i) => (
        <span key={i} className="word inline-block mr-[0.25em]">{w}</span>
      ))}
    </h2>
  );
}
```

#### Parallax Depth Layers
```tsx
useGSAP(() => {
  gsap.to(".parallax-bg", { yPercent: -20, ease: "none", scrollTrigger: { trigger: ".parallax-section", scrub: true } });
  gsap.to(".parallax-fg", { yPercent: -50, ease: "none", scrollTrigger: { trigger: ".parallax-section", scrub: true } });
});
```

#### Horizontal Scroll
```tsx
useGSAP(() => {
  const container = document.querySelector(".horizontal-track") as HTMLElement;
  const scrollWidth = container.scrollWidth - window.innerWidth;
  gsap.to(container, {
    x: -scrollWidth, ease: "none",
    scrollTrigger: { trigger: ".horizontal-section", pin: true, scrub: 1, end: () => `+=${scrollWidth}` },
  });
});
```

### Apple Typography & Spacing

```css
.headline { font-size: clamp(2.5rem, 6vw, 5.5rem); font-weight: 600; letter-spacing: -0.025em; line-height: 1.05; max-width: 900px; }
.subheadline { font-size: clamp(1.25rem, 2.5vw, 1.75rem); font-weight: 400; line-height: 1.4; color: #86868b; max-width: 700px; }
.body-text { font-size: 17px; line-height: 1.65; font-weight: 400; }
```

**Spacing:** Every section 100vh minimum. Hero centered vertically with 120px+ padding. Text blocks centered at `max-width: 900px`. Feature callouts `py-32` minimum.

**Colors (dark default):**
```css
:root { --bg: #000; --bg-2: #1d1d1f; --text: #f5f5f7; --text-2: #86868b; --text-3: #6e6e73; --accent: #0071e3; }
```

**Font stack:** `Geist`, `Satoshi`, or `General Sans`.

### Accessibility & Performance

- `prefers-reduced-motion` — kill ScrollTriggers, show all content
- Image sequences: 720p on mobile, full on desktop
- Only animate `transform` + `opacity` — no layout properties
- `will-change: transform` only while animating
- Mobile: replace canvas with static image, simplify pins

### Quality check

| Check | Requirement |
|-------|-------------|
| Scroll narrative | Each section advances the story |
| Pin behavior | Pins release cleanly — no scroll jumps |
| Typography | 48px+ headlines, tight tracking, clear hierarchy |
| Spacing | 100vh sections, centered content |
| Performance | Only transform + opacity. No layout thrash. |
| Dark mode | Default dark, Apple color palette |
| Mobile | Graceful degradation |
| Reduced motion | All content visible when motion disabled |
| Smooth scroll | Lenis integrated |

Fix failures before presenting.

## The Standard

Every page feels like a $50K agency landing page. Cinematic scroll. Breathing whitespace. Typography that commands. Animations serve the narrative.
