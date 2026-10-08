---
name: bento
description: Bento grid dashboard/feature page — asymmetric card grids, interactive hover states, dark or light, icon-driven features. Best for product showcases, feature pages, portfolios, and dashboards inspired by Apple keynotes.
---

# Bento Grid Website Builder

You build websites centered on the bento grid layout — asymmetric, modular card grids inspired by Japanese lunch boxes and Apple keynote presentations. Each card is a self-contained feature showcase with its own visual treatment, animation, and interaction.

## Task

$ARGUMENTS

## The Bento DNA

- **Asymmetric grid** — cards span 1, 2, or 3 columns; rows vary in height
- **Self-contained cards** — each card has its own mini-demo, illustration, or animation
- **Interactive hover states** — cards come alive on hover (subtle scale, glow, or content reveal)
- **Dark mode preferred** — dark cards with subtle borders, but light mode works too
- **Icon-driven** — each feature has a distinctive icon or mini-illustration
- **Generous internal padding** — cards feel spacious, not cramped
- **Subtle motion** — staggered entrance, hover interactions, no scroll hijacking

## Recipe

### Inputs to settle

Extract:
- **Product** — what are we showcasing features of?
- **Features** — 4-8 features, ranked by importance
- **Style** — dark Apple keynote, light minimal, or colorful
- **Framework** — default Next.js + Tailwind + Motion

### Grid Architecture

**Standard bento layouts:**

```
Layout A (6 features):          Layout B (8 features):
┌──────────┬─────┐              ┌──────────┬─────┐
│  2x2     │ 1x1 │              │  2x1     │ 1x1 │
│          ├─────┤              ├─────┬────┤     │
│          │ 1x1 │              │ 1x1 │1x1 ├─────┤
├─────┬────┴─────┤              ├─────┴────┤ 1x2 │
│ 1x1 │   2x1    │              │  2x1     │     │
└─────┴──────────┘              ├─────┬────┴─────┤
                                │ 1x1 │   2x1    │
                                └─────┴──────────┘
```

**Grid hierarchy:**
- **Primary feature** → spans 2 columns, 2 rows (largest card)
- **Secondary features** → span 2 columns, 1 row
- **Tertiary features** → 1 column, 1 row

### Build Patterns

#### Bento Grid Container
```tsx
function BentoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[minmax(200px,auto)]">
      {children}
    </div>
  );
}
```

#### Bento Card (Dark)
```tsx
function BentoCard({
  children, className, span = "1x1",
}: { children: React.ReactNode; className?: string; span?: "1x1" | "2x1" | "1x2" | "2x2" }) {
  const spanClasses = {
    "1x1": "",
    "2x1": "md:col-span-2",
    "1x2": "md:row-span-2",
    "2x2": "md:col-span-2 md:row-span-2",
  };

  return (
    <motion.div
      className={clsx(
        "group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden",
        "hover:border-white/[0.15] transition-colors duration-300",
        spanClasses[span],
        className
      )}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

#### Bento Card (Light)
```tsx
function BentoCardLight({
  children, className, span = "1x1",
}: { children: React.ReactNode; className?: string; span?: "1x1" | "2x1" | "1x2" | "2x2" }) {
  const spanClasses = {
    "1x1": "",
    "2x1": "md:col-span-2",
    "1x2": "md:row-span-2",
    "2x2": "md:col-span-2 md:row-span-2",
  };

  return (
    <motion.div
      className={clsx(
        "group relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden",
        "hover:shadow-lg hover:border-gray-300 transition-all duration-300",
        spanClasses[span],
        className
      )}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

#### Feature Card with Icon + Demo
```tsx
function FeatureBento({ icon, label, title, description, demo, span = "1x1" }: {
  icon: React.ReactNode; label: string; title: string; description: string;
  demo?: React.ReactNode; span?: "1x1" | "2x1" | "1x2" | "2x2";
}) {
  return (
    <BentoCard span={span}>
      <div className="p-6 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/60">
            {icon}
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed mb-6">{description}</p>
        {demo && <div className="mt-auto">{demo}</div>}
      </div>
    </BentoCard>
  );
}
```

#### Staggered Grid Entrance
```tsx
function AnimatedBentoGrid({ features }: { features: Feature[] }) {
  return (
    <BentoGrid>
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <FeatureBento {...f} />
        </motion.div>
      ))}
    </BentoGrid>
  );
}
```

#### Hover Glow Effect
```tsx
function GlowCard({ children, glowColor = "#6366f1" }: { children: React.ReactNode; glowColor?: string }) {
  return (
    <div className="group relative">
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: `radial-gradient(circle, ${glowColor}30, transparent 70%)` }}
      />
      <div className="relative rounded-2xl border border-white/[0.08] bg-zinc-900 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
```

### Card Content Ideas

Each bento card should show, not just tell. Embed mini-demos:

| Feature Type | Card Content |
|-------------|-------------|
| Speed/Performance | Animated progress bar or counter |
| Integrations | Mini logo grid with subtle float animation |
| Code/API | Syntax-highlighted snippet |
| Analytics | Tiny chart (bar, line, or sparkline) |
| Collaboration | Animated avatars stacking |
| Security | Lock icon with pulse animation |
| Search | Mini search input with typewriter text |
| Customization | Color palette dots or theme switcher |

### Typography & Color

**Dark mode (default):**
```css
:root {
  --bg: #09090b;
  --card: rgba(255,255,255,0.03);
  --card-border: rgba(255,255,255,0.08);
  --card-hover: rgba(255,255,255,0.15);
  --text: #fafafa;
  --text-muted: rgba(255,255,255,0.5);
  --text-dim: rgba(255,255,255,0.35);
}
```

**Light mode:**
```css
:root {
  --bg: #ffffff;
  --card: #f9fafb;
  --card-border: #e5e7eb;
  --card-hover: #d1d5db;
  --text: #111827;
  --text-muted: #6b7280;
}
```

**Typography:**
```css
.section-title { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700; letter-spacing: -0.02em; }
.card-title { font-size: 1.25rem; font-weight: 600; }
.card-body { font-size: 0.875rem; line-height: 1.6; }
.label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
```

### Quality check

| Check | Requirement |
|-------|-------------|
| Grid asymmetry | Primary feature spans 2+ cols, not all cards same size |
| Card interactivity | Hover states on every card (border, scale, or glow) |
| Internal demos | At least 2 cards have embedded mini-demos or illustrations |
| Staggered entrance | Cards animate in with 60ms stagger |
| Spacing | 16px gap between cards, generous internal padding (24px+) |
| Hierarchy | Clear primary/secondary/tertiary card ranking |
| Responsive | Mobile stacks to single column, maintains card quality |
| No dead cards | Every card has icon + label + title + description minimum |

## The Standard

It should look like an Apple keynote slide brought to life on the web. Each card is a miniature product demo. The grid feels deliberate, not random.
