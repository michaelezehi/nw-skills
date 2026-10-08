---
name: aira-saas
description: Aira-style premium SaaS landing page — warm off-white/near-black alternating sections, serif+sans typography pairing, GSAP scroll-reveal animations, split-text headings, auto-rotating tabs with progress bars, data-dim muted text, transparent-to-opaque navbar. Best for B2B SaaS, sales tools, fintech, and premium waitlist pages.
---

# Aira-Style SaaS Landing Page Builder

You build premium SaaS landing pages in the style of aira.app — a refined B2B product page that pairs elegant serif headlines with clean sans-serif body text, alternates between near-black and warm off-white sections, and uses GSAP-powered scroll animations with split-text reveals. The design feels like a luxury brand selling software.

## Task

$ARGUMENTS

## The Aira DNA

These traits define the style. Every page has all of them:

- **Dual-tone sections** — near-black (`#080808`) and warm off-white (`#f9f8f6`) alternating
- **Serif + sans pairing** — serif headlines (Georgia/Playfair Display), sans-serif body (Geist Sans)
- **Lightweight headings** — `font-weight: 400`, never bold. Confidence without shouting.
- **Negative letter-spacing** — headlines use `-0.02em`, creating tight, editorial feel
- **Line-height equals font-size** on headlines — ultra-tight leading (1:1 ratio)
- **Buttons** — soft rectangle `border-radius: 8px`, small padding, inverted on dark/light sections (no pills)
- **Data-dim text** — first sentence full opacity, rest dims to 50-70% opacity
- **GSAP scroll reveals** — staggered children fade up with `data-reveal-group`
- **Split-text heading animations** — lines slide up from below with mask clip
- **Transparent navbar** — transitions to opaque based on scroll section background
- **Auto-rotating tabs** — progress bar fills over 8s, cycles through feature panes
- **Numbered feature cards** — "01", "02", "03" prefix pattern with serif numbers
- **Stat callouts** — large serif numbers (300M, 24/7, 100%) with descriptions
- **Page grid lines** — fixed vertical left/right border lines (1px, `opacity: 0.1`, `mix-blend-mode: difference`) framing the content area, plus horizontal 1px separator lines between every section
- **Left-aligned hero**: headline, subtitle, and CTA are flush-left (not centered), positioned at the bottom of the hero viewport
- **Smooth scroll** — Lenis integration for butter-smooth scrolling
- **No visual clutter** — generous whitespace, no gradients, no glow effects, no glassmorphism

## Recipe

### Inputs to settle

Extract from prompt:
- **Product** — what's being sold
- **Key features** — 3-6 features to showcase
- **Stats** — impressive numbers to display (users, uptime, data points)
- **Tone** — premium B2B (default), startup energy, enterprise calm
- **Framework** — default Next.js + Tailwind + GSAP

### Page Architecture

Follow this exact section sequence (the Aira rhythm):

| # | Section | Background | Pattern |
|---|---------|-----------|---------|
| 1 | **Nav** | Transparent → adaptive | Logo left, links center, CTA right |
| 2 | **Hero** | `#080808` (dark) | Serif headline (muted second line), subtitle, CTA, hero image |
| 3 | **Product Video** | `#080808` (dark) | Section heading + embedded video/demo |
| 4 | **Feature Cards** | `#080808` (dark) | Numbered 01/02 cards with text + CTA, split layout |
| 5 | **Stats Bar** | `#080808` (dark) | Large numbers (serif) + descriptions in 4-column grid |
| 6 | **Deep Dive** | `#080808` (dark) | Numbered features with expandable/accordion capability cards |
| 7 | **Waitlist CTA** | `#f9f8f6` (light) | Centered heading + email form + consent |
| 8 | **Events/Social** | `#080808` (dark) | Event cards with dates, locations, photo gallery |
| 9 | **Process Steps** | `#f9f8f6` (light) | 01/02/03 steps with heading + description |
| 10 | **FAQ** | `#f9f8f6` (light) | Accordion with serif question headings |
| 11 | **Footer** | `#f9f8f6` (light) | 4-column links, company info, legal |

Not every page needs all 11 sections. Minimum: Nav + Hero + 2 feature sections + CTA + Footer.

### Stack Setup

```bash
npm install gsap @gsap/react lenis clsx
```

GSAP + Lenis are required. No framer-motion — this style uses GSAP exclusively.

### Build Patterns

#### Color System

```css
:root {
  /* Backgrounds */
  --bg-dark: #080808;
  --bg-light: #f9f8f6;
  --bg-card: #ffffff;

  /* Text */
  --text-dark: #1c1d1f;
  --text-light: #ffffff;
  --text-muted-dark: #737373;
  --text-muted-light: rgba(255, 255, 255, 0.7);

  /* Borders */
  --border-light: #edeff3;
  --border-dark: rgba(255, 255, 255, 0.1);
  --border-dark-solid: #444444;

  /* Accent */
  --accent-blue: #2d62ff;

  /* Spacing */
  --padding-global: 3%;
  --section-padding: clamp(4rem, 8vw, 8rem);

  /* Radius */
  --radius-btn: 8px;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}
```

#### Typography System

```css
/* Heading font — elegant serif, weight 400 always */
.font-heading {
  font-family: "Playfair Display", "Georgia", serif;
  font-weight: 400;
  text-wrap: balance;
}

/* Body font — clean sans-serif */
.font-body {
  font-family: "Geist", "Geist Sans", system-ui, sans-serif;
  font-weight: 400;
}

/* Scale */
.text-h1 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.02em;
}

.text-h2 {
  font-size: clamp(2rem, 4vw, 2.9rem);
  line-height: 1;
  letter-spacing: -0.02em;
}

.text-h3 {
  font-size: clamp(1.5rem, 2.5vw, 2.2rem);
  line-height: 1;
  letter-spacing: -0.02em;
}

.text-h3-small {
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.text-body {
  font-size: 0.97rem;
  line-height: 1.4;
}

.text-body-lg {
  font-size: 1.09rem;
  line-height: 1.4;
}

.text-button {
  font-size: 0.85rem;
  font-family: "Geist", "Geist Sans", system-ui, sans-serif;
}
```

#### Page Grid Lines (Vertical Borders + Section Separators)

```tsx
// PageLines — fixed vertical left/right content borders spanning the full page
export function PageLines() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[3] flex justify-center" aria-hidden="true">
      <div
        className="w-[calc(100vw-(var(--padding-global)*2))] max-w-[1200px] h-full border-l border-r"
        style={{ borderColor: "var(--border-light)", opacity: 0.1, mixBlendMode: "difference" }}
      />
    </div>
  );
}

// SectionLine — horizontal 1px separator between sections
export function SectionLine() {
  return (
    <div className="relative w-full overflow-hidden" aria-hidden="true">
      <div className="w-screen h-px mx-auto" style={{ backgroundColor: "#fafafb", opacity: 0.1, mixBlendMode: "difference" }} />
    </div>
  );
}
```

**Usage:** `<PageLines />` once at the top of the page (before `<main>`). `<SectionLine />` between every section.

#### GSAP + Lenis Setup (Provider Component)

```tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 0.9,
      gestureOrientation: "vertical",
      smoothTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return <>{children}</>;
}
```

#### Adaptive Navbar (Transparent → Opaque)

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import clsx from "clsx";

export function Navbar() {
  const [theme, setTheme] = useState<"transparent" | "dark" | "light">("transparent");

  useEffect(() => {
    const sections = document.querySelectorAll("[data-bg-section]");
    const navHeight = 74;

    sections.forEach((section) => {
      const sectionTheme = section.getAttribute("data-bg-section") as "transparent" | "dark" | "light";
      ScrollTrigger.create({
        trigger: section,
        start: `top ${navHeight}px`,
        end: `bottom ${navHeight}px`,
        onEnter: () => setTheme(sectionTheme),
        onEnterBack: () => setTheme(sectionTheme),
      });
    });
  }, []);

  const isDark = theme === "transparent" || theme === "dark";

  return (
    <nav className="fixed top-0 w-full z-50 transition-colors duration-300">
      {/* Background layer */}
      <div
        className={clsx(
          "absolute inset-0 transition-all duration-300",
          theme === "transparent" && "bg-transparent",
          theme === "dark" && "bg-[#080808] border-b border-white/10",
          theme === "light" && "bg-[#f9f8f6] border-b border-black/10"
        )}
      />
      <div className="relative max-w-[1200px] mx-auto px-[3%] h-[74px] flex items-center justify-between">
        {/* Logo */}
        <a href="/" className={clsx("text-xl font-heading", isDark ? "text-white" : "text-[#1c1d1f]")}>
          Logo
        </a>

        {/* Center links */}
        <div className={clsx("hidden md:flex items-center gap-8 text-sm", isDark ? "text-white/70" : "text-[#1c1d1f]/70")}>
          <a href="#" className="hover:opacity-50 transition-opacity">About</a>
          <a href="#" className="hover:opacity-50 transition-opacity">Blog</a>
          <a href="#" className="hover:opacity-50 transition-opacity">Events</a>
        </div>

        {/* CTA button */}
        <a
          href="#waitlist"
          className={clsx(
            "px-4 py-2 rounded-md text-sm font-body transition-transform hover:scale-[0.98]",
            isDark
              ? "bg-white/95 text-[#080808] border border-white"
              : "bg-[#080808]/90 text-white border border-[#080808]"
          )}
        >
          Join the waitlist
        </a>
      </div>
    </nav>
  );
}
```

#### Hero Section (Dark, Serif Headline, Muted Second Line)

```tsx
function Hero() {
  return (
    <header
      data-bg-section="transparent"
      className="relative min-h-screen bg-[#080808] flex flex-col justify-end px-[3%] pt-[74px] pb-16"
    >
      {/* Optional: hero background image */}
      <div className="absolute inset-0 z-0">
        <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/40 to-[#080808]" />
      </div>

      <div data-reveal-group="" className="relative z-10 max-w-[1200px] mx-auto w-full">
        <h1 className="font-heading text-h1 text-white">
          <span className="block">Just ask Aira,</span>
          <span className="block text-white/70">your AI sales agent</span>
        </h1>
        <p className="font-body text-body-lg text-white mt-6 max-w-xl">
          Aira researches every company you interact with, prepares every meeting,
          and identifies opportunities and risks before you do.
        </p>
        <div className="flex gap-3 mt-8">
          <a href="#waitlist" className="px-5 py-2 rounded-md bg-white/95 text-[#080808] text-sm font-body border border-white hover:scale-[0.98] transition-transform">
            Join the waitlist
          </a>
        </div>
      </div>
    </header>
  );
}
```

**Key pattern:** The H1 second line uses `text-white/70` (70% opacity) to create the signature muted-second-line effect. This is NOT a gradient or color — it's opacity on the second line of the headline.

#### Scroll-Reveal Group (GSAP)

```tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function RevealGroup({
  children,
  className,
  stagger = 0.2,
  distance = "2em",
  start = "top 85%",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  distance?: string;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = [...el.children];
    gsap.set(children, { y: distance, autoAlpha: 0 });

    ScrollTrigger.create({
      trigger: el,
      start,
      once: true,
      onEnter: () => {
        gsap.to(children, {
          y: 0,
          autoAlpha: 1,
          duration: 1.2,
          stagger,
          ease: "power4.out",
          onComplete: () => gsap.set(children, { clearProps: "all" }),
        });
      },
    });
  }, [stagger, distance, start]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

#### Split-Text Heading Animation

```tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SplitHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Split into lines using CSS
    const words = children.split(" ");
    el.innerHTML = words
      .map((w) => `<span class="inline-block overflow-hidden"><span class="split-word inline-block">${w}</span></span>`)
      .join(" ");

    const splitWords = el.querySelectorAll(".split-word");
    gsap.set(splitWords, { yPercent: 110 });

    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(splitWords, {
          yPercent: 0,
          duration: 1.2,
          stagger: 0.1,
          ease: "expo.out",
        });
      },
    });
  }, [children]);

  return <Tag ref={ref as any} className={className} />;
}
```

#### Data-Dim Text (First Sentence Bright, Rest Muted)

```tsx
export function DimText({
  children,
  className,
  opacity = 0.5,
}: {
  children: string;
  className?: string;
  opacity?: number;
}) {
  // Split at first period
  const firstPeriod = children.indexOf(".");
  if (firstPeriod === -1) return <p className={className}>{children}</p>;

  const bright = children.slice(0, firstPeriod + 1);
  const dim = children.slice(firstPeriod + 1);

  return (
    <p className={className}>
      {bright}
      <span style={{ opacity }}>{dim}</span>
    </p>
  );
}
```

#### Numbered Feature Card

```tsx
function FeatureCard({
  number,
  title,
  description,
  dark = true,
}: {
  number: string;
  title: string;
  description: string;
  dark?: boolean;
}) {
  return (
    <div className={clsx("py-8", dark ? "border-t border-white/10" : "border-t border-black/10")}>
      <span className={clsx("font-heading text-sm", dark ? "text-white/50" : "text-[#737373]")}>
        {number}
      </span>
      <h3 className={clsx("font-heading text-h3 mt-4", dark ? "text-white" : "text-[#1c1d1f]")}>
        {title}
      </h3>
      <DimText
        className={clsx("font-body text-body mt-4 max-w-lg", dark ? "text-white" : "text-[#1c1d1f]")}
        opacity={0.5}
      >
        {description}
      </DimText>
    </div>
  );
}
```

#### Stats Bar (Large Serif Numbers)

```tsx
function StatsBar({ stats }: { stats: { value: string; suffix: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-16 border-t border-b border-white/10">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className="flex items-baseline gap-0.5">
            <span className="font-heading text-5xl md:text-6xl text-white">{stat.value}</span>
            <span className="font-heading text-2xl text-white/50">{stat.suffix}</span>
          </div>
          <p className="font-body text-sm text-white/50 mt-2 max-w-[200px]">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
```

#### Auto-Rotating Tabs with Progress Bar

```tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";

const DURATION = 8000;

function TabSection({ tabs }: { tabs: { number: string; title: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [key, setKey] = useState(0); // for restarting CSS animation

  const activate = useCallback((index: number) => {
    setActive(index);
    setKey((k) => k + 1);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % tabs.length;
        setKey((k) => k + 1);
        return next;
      });
    }, DURATION);
  }, [tabs.length]);

  useEffect(() => {
    activate(0);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activate]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      {/* Tab list */}
      <div className="space-y-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.number}
            onClick={() => activate(i)}
            className={clsx(
              "w-full text-left py-6 border-t border-white/10 transition-opacity",
              i === active ? "opacity-100" : "opacity-50 hover:opacity-70"
            )}
          >
            <span className="font-heading text-sm text-white/50">{tab.number}</span>
            <h3 className="font-heading text-h3-small text-white mt-2">{tab.title}</h3>
            {/* Progress bar */}
            {i === active && (
              <div className="mt-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div
                  key={key}
                  className="h-full bg-white rounded-full"
                  style={{ animation: `progressFill ${DURATION}ms linear forwards` }}
                />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Content panes */}
      <div className="relative min-h-[400px]">
        {tabs.map((tab, i) => (
          <div
            key={tab.number}
            className={clsx(
              "absolute inset-0 transition-opacity duration-500",
              i === active ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Required CSS keyframe:**
```css
@keyframes progressFill {
  from { width: 0%; }
  to { width: 100%; }
}
```

#### Section Wrapper (Dark/Light)

```tsx
function Section({
  children,
  dark = true,
  className,
  id,
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      data-bg-section={dark ? "black" : "white"}
      className={clsx(
        "py-[var(--section-padding)] px-[3%]",
        dark ? "bg-[#080808] text-white" : "bg-[#f9f8f6] text-[#1c1d1f]",
        className
      )}
    >
      <div className="max-w-[1200px] mx-auto">{children}</div>
    </section>
  );
}
```

#### Button

```tsx
function Button({
  children,
  href,
  variant = "primary",
  dark = true,
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
  dark?: boolean;
}) {
  const styles = {
    primary: dark
      ? "bg-white/95 text-[#080808] border-white"
      : "bg-[#080808]/90 text-white border-[#080808]",
    secondary: dark
      ? "bg-transparent text-white border-[#444]"
      : "bg-transparent text-[#1c1d1f] border-black/20",
  };

  return (
    <a
      href={href}
      className={clsx(
        "inline-flex items-center px-4 py-2 rounded-md text-sm font-body border",
        "hover:scale-[0.98] transition-transform",
        styles[variant]
      )}
    >
      {children}
    </a>
  );
}
```

#### FAQ Accordion

```tsx
"use client";
import { useState } from "react";
import clsx from "clsx";

function FAQ({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-black/10">
      {items.map((item, i) => (
        <div key={i} className="py-6">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="font-heading text-h3-small text-[#1c1d1f]">{item.question}</h3>
            <svg
              className={clsx("w-5 h-5 transition-transform duration-300", openIndex === i && "rotate-45")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <div className={clsx(
            "overflow-hidden transition-all duration-500",
            openIndex === i ? "max-h-96 opacity-100 mt-4" : "max-h-0 opacity-0"
          )}>
            <p className="font-body text-body text-[#737373] max-w-2xl">{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### Footer (4-Column, Light)

```tsx
function Footer() {
  return (
    <footer className="bg-[#f9f8f6] px-[3%] py-16 border-t border-black/5">
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <p className="font-body text-sm font-medium text-[#1c1d1f] mb-4">Product</p>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">Join the waitlist</a>
        </div>
        <div>
          <p className="font-body text-sm font-medium text-[#1c1d1f] mb-4">Company</p>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">About us</a>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">Blog</a>
        </div>
        <div>
          <p className="font-body text-sm font-medium text-[#1c1d1f] mb-4">Connect</p>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">Events</a>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">LinkedIn</a>
        </div>
        <div>
          <p className="font-body text-sm font-medium text-[#1c1d1f] mb-4">Legal</p>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">Terms</a>
          <a href="#" className="block font-body text-sm text-[#737373] py-1 hover:opacity-60 transition-opacity">Privacy</a>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto mt-12 pt-8 border-t border-black/5">
        <p className="font-body text-xs text-[#737373]">
          &copy; {new Date().getFullYear()} Company Name. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

### Animation Rules

| Animation | Trigger | Duration | Ease | Notes |
|-----------|---------|----------|------|-------|
| Scroll reveal (children) | `top 85%` viewport | 1.2s | `power4.out` | Stagger 0.2s between children |
| Split-text headings | `top 85%` viewport | 1.2s | `expo.out` | `yPercent: 110` → 0, stagger 0.1s |
| Navbar theme | Section enters nav height | 0.3s | default | Updates bg, text, button colors |
| Tab progress bar | Auto, 8s cycle | 8s | linear | CSS `@keyframes progressFill` |
| Button hover | Hover | instant | — | `scale(0.98)` — subtle press, no lift |
| Link hover | Hover | 0.2s | — | Opacity 0.7 → 0.5 |
| FAQ expand | Click | 0.5s | ease | `max-height` + opacity transition |

**Anti-patterns:**
- No bounce/elastic/spring easing
- No scale-up hover effects (only scale DOWN to 0.98)
- No gradient glows or radial gradients
- No glassmorphism or backdrop-blur (except navbar if needed)
- No bold headings — always weight 400
- No colorful accents — this is a monochrome + warm-white palette
- No framer-motion — use GSAP exclusively

### Responsive Behavior

| Breakpoint | Changes |
|-----------|---------|
| Desktop (992px+) | Full layout, transparent navbar, all animations |
| Tablet (768-991px) | 2-column → single column, navbar stays adaptive |
| Mobile (<768px) | Single column, simplified navbar (hamburger), reduced animations |

Mobile: replace transparent navbar with solid dark. Reduce section padding. Stack columns.

### Quality check

| Check | Requirement |
|-------|-------------|
| Dual-tone | Alternating `#080808` / `#f9f8f6` sections |
| Serif headings | All h1/h2/h3 in serif, weight 400, tight leading |
| Sans body | All body/buttons in Geist Sans (never Inter/Roboto/Arial defaults) |
| Buttons | `border-radius: 8px` soft rectangle, proper dark/light inversion |
| Scroll reveal | GSAP-powered, staggered children fade-up |
| Split-text | At least one heading with split-text animation |
| Data-dim | Feature descriptions dim after first sentence |
| Navbar adapt | Transparent → opaque based on section |
| Stats section | Large serif numbers with descriptions |
| Numbered features | "01", "02", "03" prefix pattern |
| No bold headings | Every heading weight 400 |
| Lenis scroll | Smooth scroll provider wrapping the page |
| Mobile | Single column, solid navbar, content accessible |
| No clutter | Generous whitespace, no unnecessary decoration |

Fix failures before presenting.

## Tailwind Config (Font Setup)

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Playfair Display"', "Georgia", "serif"],
        body: ["Geist", "Geist Sans", "system-ui", "sans-serif"],
      },
    },
  },
};
export default config;
```

**Google Fonts import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Geist:wght@400;500&display=swap" rel="stylesheet">
```

## The Standard

The page should feel like a luxury brand's digital presence — confident, restrained, editorial. Serif typography commands attention without shouting. The dark/light rhythm creates visual breathing room. Every animation serves the narrative. No decoration for decoration's sake.
