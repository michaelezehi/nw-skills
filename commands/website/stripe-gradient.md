---
name: stripe-gradient
description: Stripe-style marketing site — animated mesh gradients, tilted sections, layered text blending, clean grid layouts, vibrant yet professional. Best for fintech, payment platforms, developer APIs, and enterprise SaaS.
---

# Stripe-Style Website Builder

You build marketing sites with Stripe's signature aesthetic: animated mesh gradients, tilted background sections, layered text blending, clean content grids, and that distinctive mix of technical sophistication and visual warmth. Inspired by Stripe, Plaid, and modern fintech.

## Task

$ARGUMENTS

## The Stripe DNA

- **Animated mesh gradients** — WebGL canvas with flowing color blobs
- **Tilted sections** — `skewY(-12deg)` diagonal backgrounds
- **Layered text blending** — `mix-blend-mode: color-burn` over gradients
- **Clean content grids** — structured, well-spaced, information-dense
- **Vibrant-yet-professional** palette — blues, purples, pinks, teals
- **Developer-friendly** feel — code snippets, terminal windows, API examples
- **Light mode default** — white backgrounds with gradient accents
- **Smooth transitions** — not scroll-driven, just polished page animations

## Recipe

### Inputs to settle

Extract:
- **Product** — API, platform, payment tool, developer product?
- **Key value props** — 3-5 selling points
- **Tone** — developer-focused, enterprise, startup?
- **Framework** — default Next.js + Tailwind + Motion

### Page Architecture

| Section | Pattern |
|---------|---------|
| **Nav** | Clean white, logo left, links center, 2 CTAs right (Login + Sign Up) |
| **Hero** | Tilted gradient bg, large headline, subtitle, CTA, optional code preview |
| **Logo Bar** | Customer logos, grayscale, on white |
| **Feature Grid** | 2x2 or 3x3 cards with icons, on white or light gray |
| **Product Demo** | Code snippet + live preview side by side |
| **Tilted Section** | Gradient bg with skew, overlaid feature content |
| **Integrations** | Grid of partner/integration logos with subtle cards |
| **Testimonial** | Large quote or case study highlight |
| **Pricing** | 2-3 tiers, clean comparison |
| **CTA** | Gradient bg section, white text, prominent buttons |
| **Footer** | Multi-column links on dark bg |

### Build Patterns

#### Animated Mesh Gradient (CSS Fallback)
```tsx
function MeshGradient({ colors = ["#6ec3f4", "#3a3aff", "#ff61ab", "#E63946"] }: { colors?: string[] }) {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[--c0] via-[--c1] to-[--c2] animate-gradient-shift"
        style={{
          "--c0": colors[0], "--c1": colors[1], "--c2": colors[2],
          backgroundSize: "400% 400%",
        } as React.CSSProperties}
      />
      {colors.map((color, i) => (
        <div
          key={i}
          className="absolute rounded-full mix-blend-multiply blur-[80px] opacity-70 animate-blob"
          style={{
            backgroundColor: color,
            width: `${30 + i * 10}%`, height: `${30 + i * 10}%`,
            top: `${20 + i * 15}%`, left: `${10 + i * 20}%`,
            animationDelay: `${i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
```

```css
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}
.animate-gradient-shift { animation: gradient-shift 15s ease infinite; }
.animate-blob { animation: blob 12s ease-in-out infinite; }
```

#### Tilted Section
```tsx
function TiltedSection({ children, gradient = true }: { children: React.ReactNode; gradient?: boolean }) {
  return (
    <section className="relative py-32 overflow-hidden">
      <div
        className={clsx(
          "absolute inset-0 -z-10 origin-center",
          gradient ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" : "bg-slate-900"
        )}
        style={{ transform: "skewY(-6deg)", top: "-10%", bottom: "-10%" }}
      />
      <div className="relative max-w-6xl mx-auto px-6">
        {children}
      </div>
    </section>
  );
}
```

#### Code Preview Card
```tsx
function CodePreview({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-700/50 overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-slate-500 font-mono">{language}</span>
      </div>
      <pre className="p-5 text-sm font-mono text-slate-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
```

#### Feature Card
```tsx
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <FadeUp>
      <div className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-300">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
          {icon}
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
    </FadeUp>
  );
}
```

#### Stripe Hero
```tsx
function StripeHero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <MeshGradient />
      <div className="relative max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <FadeUp>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight">
              Financial infrastructure for the internet
            </h1>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-lg text-white/70 mt-6 max-w-lg leading-relaxed">
              Millions of companies use our platform to accept payments, grow revenue, and accelerate new business opportunities.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="flex gap-3 mt-8">
              <button className="px-6 py-3 rounded-full bg-white text-indigo-600 font-semibold hover:bg-white/90 transition-colors">
                Start now
              </button>
              <button className="px-6 py-3 rounded-full border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors">
                Contact sales
              </button>
            </div>
          </FadeUp>
        </div>
        <FadeUp delay={0.3}>
          <CodePreview code={`curl https://api.stripe.com/v1/charges \\\n  -u sk_test_your_key: \\\n  -d amount=2000 \\\n  -d currency=usd`} />
        </FadeUp>
      </div>
    </section>
  );
}
```

### Typography & Color

**Typography:**
```css
body { font-family: "Inter", "Helvetica Neue", sans-serif; }
.headline { font-size: clamp(2.5rem, 4.5vw, 3.75rem); font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; }
.body { font-size: 16px; line-height: 1.7; color: #425466; }
code { font-family: "Fira Code", "SF Mono", monospace; }
```

**Color palette:**
```css
:root {
  --bg: #ffffff;
  --bg-muted: #f6f9fc;
  --text: #0a2540;
  --text-muted: #425466;
  --accent-1: #635bff;  /* Stripe purple */
  --accent-2: #00d4ff;  /* Teal */
  --accent-3: #ff5e6c;  /* Coral */
  --gradient: linear-gradient(135deg, #667eea, #764ba2, #f093fb);
}
```

**Stripe buttons:** `rounded-full` with bold font, never squared.

### Animation

- Entrance: staggered fade-up on scroll (once)
- Gradient: slow continuous shift (15s cycle)
- Blobs: floating movement (12s cycle)
- Hover: cards lift with shadow, buttons brighten
- No scroll-driven scrub — this style uses viewport-enter triggers

### Quality check

| Check | Requirement |
|-------|-------------|
| Gradient | Animated mesh gradient on hero and/or CTA section |
| Tilted section | At least one `skewY` diagonal background |
| Code preview | Terminal-style card if dev-facing |
| Light mode | White bg default, gradient accents |
| Typography | Clean sans-serif, tight headlines |
| Cards | Bordered, subtle shadow on hover |
| Buttons | Rounded-full, clear primary/secondary hierarchy |
| Grid | Clean 2-3 column feature layouts |
| Mobile | Gradient scales down, single column |
| Professional | Vibrant but not chaotic — enterprise-ready |

## The Standard

It should feel like a billion-dollar fintech marketing site. Sophisticated gradients, clean information architecture, developer credibility, enterprise trust.
