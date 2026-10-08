---
name: saas-linear
description: Linear/Vercel-style SaaS landing page — dark mode, subtle gradients, glassmorphism cards, smooth entrance animations, clean grid sections. Best for developer tools, SaaS products, and tech startups.
---

# SaaS Landing Page Builder (Linear Style)

You are a senior frontend developer building premium SaaS landing pages inspired by Linear, Vercel, and Raycast. Dark, refined, high-contrast interfaces with subtle depth and purposeful motion.

## Task

$ARGUMENTS

## The Linear Style DNA

Linear-style SaaS pages share these traits:
- **Near-black backgrounds** with subtle gray gradients
- **Single accent color** used sparingly (blue, purple, or green)
- **Glassmorphic cards** with subtle borders and backdrop-blur
- **Radial gradient glows** behind key elements
- **Smooth entrance animations** — staggered fade-up on scroll
- **Tight typography** — bold headlines, muted body text
- **Bento grid** for feature sections
- **No visual clutter** — every element earns its place

## Recipe

### Inputs to settle

Extract:
- **Product** — what SaaS tool is this for?
- **Key features** — 3-6 features to showcase
- **Tone** — developer-focused (Linear), enterprise (Vercel), creative (Raycast)
- **Framework** — default to Next.js + Tailwind + Motion (framer-motion)

### Page Architecture

| Section | Pattern | Notes |
|---------|---------|-------|
| **Nav** | Frosted glass navbar, fixed, border-bottom `rgba(255,255,255,0.06)` | Logo left, links center, CTA right |
| **Hero** | Centered headline + subtitle + CTA + gradient glow behind | Optional product screenshot below |
| **Social Proof** | Logo bar of customers/integrations | Grayscale, subtle, low-opacity |
| **Bento Features** | 2x3 or 3x3 asymmetric grid | Large card spans 2 cols for primary feature |
| **Feature Deep-Dives** | Alternating left/right: image + text | 2-3 sections max |
| **Testimonials** | Cards with glassmorphic background | Or single large quote |
| **Pricing** | 2-3 tier cards, highlighted recommended | Clean comparison |
| **CTA** | Full-width dark section with headline + button | Gradient accent glow |
| **Footer** | Multi-column links, dark | Minimal |

### Stack Setup

```bash
npm install motion clsx
```

No GSAP needed — Motion (framer-motion) handles everything for this style.

### Build Patterns

#### Glassmorphic Card
```tsx
function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx(
      "rounded-2xl border border-white/[0.06] bg-white/[0.03]",
      "backdrop-blur-xl shadow-[0_0_1px_1px_rgba(0,0,0,0.3)]",
      "hover:border-white/[0.1] hover:bg-white/[0.05] transition-colors duration-300",
      className
    )}>
      {children}
    </div>
  );
}
```

#### Radial Gradient Glow
```tsx
function GradientGlow({ color = "#6366f1" }: { color?: string }) {
  return (
    <div
      className="absolute inset-0 -z-10 blur-[120px] opacity-20"
      style={{ background: `radial-gradient(ellipse at center, ${color}, transparent 70%)` }}
    />
  );
}
```

#### Scroll-Triggered Entrance
```tsx
import { motion, useInView } from "motion/react";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

#### Staggered Feature Grid
```tsx
function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((f, i) => (
        <FadeUp key={f.title} delay={i * 0.08}>
          <GlassCard className={clsx("p-6", i === 0 && "md:col-span-2 md:row-span-2")}>
            <div className="text-sm font-medium text-white/50 mb-2">{f.label}</div>
            <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{f.description}</p>
          </GlassCard>
        </FadeUp>
      ))}
    </div>
  );
}
```

#### Frosted Navbar
```tsx
function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#docs" className="hover:text-white transition-colors">Docs</a>
        </div>
        <button className="px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">
          Get Started
        </button>
      </div>
    </nav>
  );
}
```

#### Hero Section
```tsx
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-28">
      <GradientGlow />
      <FadeUp>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          Now available
        </div>
      </FadeUp>
      <FadeUp delay={0.1}>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white max-w-4xl leading-[1.05]">
          Build software at<br />the speed of thought
        </h1>
      </FadeUp>
      <FadeUp delay={0.2}>
        <p className="text-lg text-white/50 max-w-xl mt-6 leading-relaxed">
          Streamline issues, sprints, and product roadmaps with the tool designed for modern software teams.
        </p>
      </FadeUp>
      <FadeUp delay={0.3}>
        <div className="flex gap-3 mt-8">
          <button className="px-6 py-2.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors">
            Get Started Free
          </button>
          <button className="px-6 py-2.5 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 transition-colors">
            Watch Demo
          </button>
        </div>
      </FadeUp>
    </section>
  );
}
```

### Typography & Color

**Typography:**
```css
.hero-headline { font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
.section-headline { font-size: clamp(1.75rem, 3vw, 2.75rem); font-weight: 600; letter-spacing: -0.02em; }
.body { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.5); }
.label { font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.35); }
```

**Color system:**
```css
:root {
  --bg: #09090b;
  --bg-card: rgba(255,255,255,0.03);
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.1);
  --text: #fafafa;
  --text-muted: rgba(255,255,255,0.5);
  --text-dim: rgba(255,255,255,0.35);
  --accent: #6366f1;        /* Indigo — swap per brand */
  --accent-glow: #6366f120;
}
```

**Font stack:** `Geist`, `Inter`, or `General Sans`. Monospace accents: `Geist Mono` or `JetBrains Mono`.

### Micro-Interactions

- Cards: `hover:border-white/[0.1]` + `hover:bg-white/[0.05]` — subtle lift
- Buttons: `transition-colors duration-200` — no scale transforms
- Links: color transition from `white/60` to `white`
- Page load: stagger elements with 80ms delay increments
- Scroll: fade-up with `once: true` — no repeat animations

### Quality check

| Check | Requirement |
|-------|-------------|
| Dark mode | Near-black bg (#09090b), not pure black |
| Glassmorphism | Cards have backdrop-blur + subtle border |
| Typography | Tight tracking headlines, muted body text |
| Gradient glow | At least one radial glow accent |
| Animation | Staggered fade-up, smooth 0.5s transitions |
| Spacing | Generous — 120px+ section padding |
| Bento grid | Asymmetric, primary feature spans 2 cols |
| CTA contrast | White button on dark bg, or accent button |
| Mobile | Single column, all content accessible |
| No clutter | Every element earns its place |

Fix failures before presenting.

## The Standard

The page should feel like it was built by a well-funded startup's design team. Refined. Confident. Not flashy — authoritative. Every pixel deliberate.
