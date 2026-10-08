---
name: kinetic-type
description: Kinetic typography website — animated text as the primary visual element, scroll-driven letter transforms, cursor-reactive type, variable font animations. Best for creative agencies, portfolios, artist sites, and bold brand statements.
---

# Kinetic Typography Website Builder

You build websites where text IS the design. Massive headlines that animate, distort, and respond to scroll and cursor. Variable fonts morphing weight in real-time. Letters that scatter, reform, and reveal. The typography is not decoration — it is the entire visual experience.

## Task

$ARGUMENTS

## The Kinetic Type DNA

- **Text as hero** — no images needed, type IS the visual
- **Massive scale** — headlines fill the viewport (15-25vw)
- **Scroll-driven transforms** — text morphs as you scroll (skew, scale, weight, tracking)
- **Variable font animation** — weight and width shift fluidly
- **Cursor reactivity** — letters respond to mouse position
- **High contrast** — black/white or single bold accent
- **Minimal everything else** — the type does all the work

## Recipe

### Inputs to settle

Extract:
- **Content** — what text/messages to animate?
- **Tone** — aggressive/punk, elegant/refined, playful/bouncy, technical/precise?
- **Framework** — default Next.js + Tailwind + GSAP (best for kinetic type)

### Page Architecture

| Section | Pattern |
|---------|---------|
| **Hero** | Full-viewport animated headline — scroll triggers transform |
| **Manifesto** | Large text block, each line reveals on scroll |
| **Work/Features** | Text-dominant list with hover-triggered animation |
| **Marquee** | Infinite horizontal scrolling text strip |
| **About** | Smaller body text, still typographically distinctive |
| **Contact/CTA** | Oversized single word ("Hello." / "Let's talk.") |

### Build Patterns

#### Viewport-Filling Headline
```tsx
function KineticHero({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const chars = ref.current!.querySelectorAll(".char");
    gsap.from(chars, {
      opacity: 0, y: 120, rotateX: -90, stagger: 0.03,
      duration: 1, ease: "power4.out",
    });

    gsap.to(chars, {
      scrollTrigger: { trigger: ref.current, start: "top top", end: "+=100%", scrub: true },
      y: (i) => -50 - i * 10,
      opacity: 0.3,
      letterSpacing: "0.1em",
      stagger: 0.01,
    });
  }, { scope: ref });

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-4">
      <h1 className="text-[15vw] md:text-[12vw] font-black uppercase leading-[0.85] tracking-tighter text-center">
        {text.split("").map((char, i) => (
          <span key={i} className="char inline-block">
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </h1>
    </section>
  );
}
```

#### Variable Font Weight on Scroll
```tsx
function VariableWeightText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const words = ref.current!.querySelectorAll(".vf-word");
    words.forEach((word, i) => {
      gsap.fromTo(word, {
        fontVariationSettings: '"wght" 100',
        opacity: 0.2,
      }, {
        fontVariationSettings: '"wght" 900',
        opacity: 1,
        scrollTrigger: {
          trigger: word,
          start: "top 85%",
          end: "top 40%",
          scrub: true,
        },
      });
    });
  }, { scope: ref });

  return (
    <div ref={ref} className="max-w-5xl mx-auto px-8 py-40">
      <p className="text-4xl md:text-6xl leading-[1.3]" style={{ fontFamily: "'Inter Variable', sans-serif" }}>
        {text.split(" ").map((word, i) => (
          <span key={i} className="vf-word inline-block mr-[0.3em]">{word}</span>
        ))}
      </p>
    </div>
  );
}
```

#### Cursor-Reactive Text
```tsx
function CursorText({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const chars = container.querySelectorAll<HTMLSpanElement>(".reactive-char");

    function onMove(e: MouseEvent) {
      const { clientX, clientY } = e;
      chars.forEach((char) => {
        const rect = char.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(clientX - cx, clientY - cy);
        const maxDist = 200;
        const intensity = Math.max(0, 1 - dist / maxDist);
        char.style.fontVariationSettings = `"wght" ${400 + intensity * 500}`;
        char.style.transform = `scale(${1 + intensity * 0.3})`;
      });
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-wrap justify-center gap-0 text-[10vw] font-medium leading-none">
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="reactive-char inline-block transition-[font-variation-settings,transform] duration-150"
          style={{ fontFamily: "'Inter Variable', sans-serif" }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </div>
  );
}
```

#### Line-by-Line Scroll Reveal
```tsx
function ScrollManifesto({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const lineEls = ref.current!.querySelectorAll(".manifesto-line");
    lineEls.forEach((line) => {
      gsap.fromTo(line,
        { opacity: 0.15, x: -30 },
        {
          opacity: 1, x: 0,
          scrollTrigger: { trigger: line, start: "top 75%", end: "top 45%", scrub: true },
        }
      );
    });
  }, { scope: ref });

  return (
    <div ref={ref} className="max-w-5xl mx-auto px-8 py-40 space-y-4">
      {lines.map((line, i) => (
        <p key={i} className="manifesto-line text-3xl md:text-5xl font-bold leading-tight">
          {line}
        </p>
      ))}
    </div>
  );
}
```

#### Infinite Marquee
```tsx
function TextMarquee({ text, speed = 25 }: { text: string; speed?: number }) {
  return (
    <div className="overflow-hidden py-8 border-y border-current/10">
      <div
        className="whitespace-nowrap text-[8vw] font-black uppercase tracking-tight animate-marquee"
        style={{ animationDuration: `${speed}s` }}
      >
        {Array(6).fill(null).map((_, i) => (
          <span key={i} className="mx-[2vw]">{text} ·</span>
        ))}
      </div>
    </div>
  );
}
```

### Typography

**Variable fonts (required for best effects):**
- `Inter Variable` — weight 100-900, free, widely available
- `Instrument Sans` — weight 400-700, elegant variable
- `Satoshi Variable` — weight 300-900, modern geometric
- `Space Grotesk Variable` — weight 300-700, technical feel

**Fallback (non-variable):**
- `DM Sans` — clean, bold
- `Unbounded` — heavy display
- `Syne` — geometric, expressive

**Typography rules:**
```css
.kinetic-hero { font-size: clamp(4rem, 15vw, 12rem); font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; line-height: 0.85; }
.manifesto { font-size: clamp(1.5rem, 4vw, 3rem); font-weight: 700; line-height: 1.3; }
.body { font-size: 16px; font-weight: 400; line-height: 1.7; }
```

**Color — keep it stark:**
```css
/* Option A: Black on white */
:root { --bg: #fafafa; --text: #0a0a0a; }
/* Option B: White on black */
:root { --bg: #0a0a0a; --text: #fafafa; }
/* Option C: One accent */
:root { --bg: #0a0a0a; --text: #fafafa; --accent: #ff3300; }
```

### Quality check

| Check | Requirement |
|-------|-------------|
| Scale | At least one headline fills the viewport width |
| Motion | Text animates on scroll, entrance, or cursor |
| Variable font | At least one element uses font-variation-settings |
| Contrast | Stark black/white or single accent — no gradients |
| Hierarchy | Clear: massive hero → manifesto → body |
| Marquee | At least one infinite scrolling text element |
| Performance | Font loaded early (`font-display: swap` + preload) |
| Mobile | Text scales down but stays dramatic |
| Cursor | Desktop has mouse-reactive text (if applicable) |

## The Standard

It should feel like a motion design studio's portfolio. Type that moves, breathes, and demands attention. No images needed — the letterforms ARE the design.
