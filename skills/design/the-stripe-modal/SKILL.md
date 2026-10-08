---
name: the-stripe-modal
description: Install the editorial-press design system (surface card + slide-in modal flow + hero empty state) into the current React/Next.js project. Detects framework, installs deps, and writes the three components with a chosen color theme baked into the primary palette. Themes ship as named tones (yellow, beaver, slate, mint, butter, honey, wheat) — pick which one becomes `primary` for this project. Idempotent — safe to re-run to upgrade.
disable-model-invocation: true
---

# /the-stripe-modal — install the editorial design system

You are installing a three-component design language into the user's current project. The system was designed for Optic and Perspiva and is built around a risograph-textured surface card, a slide-in glass modal flow, and a matching hero empty state. All three share the same eyebrow-pill / display-title / supporting-actions / side-preview vocabulary, so users can move between modes (modal ↔ empty state ↔ hero card) without rebuilding visual hierarchy.

## What you install

1. **`YellowCard`** — editorial surface card with a multi-tone palette (gradient base + recessed dot pattern + tone-tinted shadow + hover glow). Tones: `primary | butter | honey | wheat | slate | beaver | mint`. The palette named `primary` is what the project uses by default.
2. **`YellowModalFlow` + `YellowModalFlowPreview`** — slide-in glass modal pinned to the bottom-right corner, with eyebrow / title / description / primary+secondary actions / hint / preview slots. Supports `variant: "destructive"` for confirmations. Built on Radix Dialog so keyboard + a11y come for free.
3. **`EmptyState` + `EmptyStatePreview`** — inline hero empty state matching the modal's vocabulary. Renders directly on the page background with **no outer card** — the side `EmptyStatePreview` panel is the only visual surface. Mirrors perspiva's `ResultEmptyState` 1:1. Buttons are `rounded-full`. Preview shadow uses the theme accent (yellow by default).
4. **Page gradient utility** (`.gradient-page-bg`) — soft theme-tinted bloom anchored to the bottom-right of the viewport, plus a faint white wash on top. Apply to any layout wrapper that should host the editorial bg. Ships as a CSS snippet appended to the project's `globals.css`.

Component file names stay literal (`YellowCard`, `YellowModalFlow`, `EmptyState`) regardless of the chosen theme — they're a class name, not a brand. The user can grep-rename later if it bothers them.

## Step 1 — Detect project shape

Run these in parallel before doing anything:

```bash
# Framework + structure
test -f package.json && cat package.json | head -50
test -f next.config.ts || test -f next.config.js || test -f next.config.mjs && echo "next-yes" || echo "next-no"
test -d src && echo "src-yes" || echo "src-no"
test -d src/components || test -d components

# Existing cn helper
test -f src/lib/utils.ts || test -f lib/utils.ts || test -f src/lib/utils.tsx || test -f lib/utils.tsx

# Dep state — read package.json (don't run install yet)
cat package.json | grep -E '"@phosphor-icons/react"|"motion"|"framer-motion"|"radix-ui"|"@radix-ui/react-dialog"|"clsx"|"tailwind-merge"|"tailwindcss"'

# Package manager
test -f pnpm-lock.yaml && echo "pnpm" || (test -f bun.lock && echo "bun") || (test -f yarn.lock && echo "yarn") || echo "npm"
```

Decide **install paths** based on what exists:

| Project shape | Components dir | `cn` helper path |
|---|---|---|
| Next.js with `src/` | `src/components/` | `src/lib/utils.ts` → import `@/lib/utils` |
| Next.js without `src/` | `components/` | `lib/utils.ts` → import `@/lib/utils` |
| Vite/CRA with `src/` | `src/components/` | `src/lib/utils.ts` → import `@/lib/utils` (assumes `@` alias) or `../lib/utils` |
| Monorepo (e.g. `apps/web/src/`) | `apps/web/src/components/` | `apps/web/src/lib/utils.ts` |

If `@/` path alias isn't configured, use a relative import (`../lib/utils`) — don't introduce a new alias the project hasn't asked for.

If the project does **not** use Next.js, the `EmptyState` template imports `Link from "next/link"`. Replace it with the project's router link (`react-router-dom` `Link`, `@tanstack/react-router` `Link`, or a plain `<a>` if no router). Tell the user what you swapped.

## Step 2 — Confirm theme with the user

Default theme is **`yellow`** (the original Optic look). Other built-in themes:

| Theme | Vibe | When to use |
|---|---|---|
| `yellow` | Loud editorial yellow | Default — Optic / brand-forward / B2B SaaS |
| `beaver` | Warm tan/brown | Outdoorsy, craft, woodworking, sustainability |
| `slate` | Neutral cool grey | Enterprise, fintech, "just works" tools |
| `mint` | Fresh green | Health, finance-positive, growth tools |
| `butter` | Soft pale yellow | Friendly consumer, content, food |
| `honey` | Warm amber | Premium, hospitality, cozy |
| `wheat` | Muted beige | Reading, minimal, archival |

Ask the user once — short prompt:
> "Which theme should be the project's `primary`? (yellow [default] / beaver / slate / mint / butter / honey / wheat)"

If they don't reply, default to `yellow`. The unchosen themes still ship as named tones (`tone="beaver"`, etc.), so they can mix later.

## Step 3 — Install dependencies

Use the detected package manager. Required deps:

| Dep | Why | Skip if |
|---|---|---|
| `@phosphor-icons/react` | Icons in eyebrow pills + actions + preview | already present |
| `motion` (successor to framer-motion) | Entrance animations | `framer-motion` ≥11 already present (then change template imports from `motion/react` → `framer-motion`) |
| `radix-ui` (unified package — current shadcn convention) | Modal accessibility primitives | `radix-ui` present; or `@radix-ui/react-dialog` present (then change the template import to `import * as DialogPrimitive from "@radix-ui/react-dialog"`) |
| `clsx` + `tailwind-merge` | `cn` helper | `cn` already exists in the project |

Single command:

```bash
# pnpm
pnpm add @phosphor-icons/react motion radix-ui clsx tailwind-merge
# npm
npm i @phosphor-icons/react motion radix-ui clsx tailwind-merge
# bun
bun add @phosphor-icons/react motion radix-ui clsx tailwind-merge
# yarn
yarn add @phosphor-icons/react motion radix-ui clsx tailwind-merge
```

**Tailwind CSS** is required. If `tailwindcss` isn't in `package.json`, stop and tell the user — don't install Tailwind unprompted, that's a much bigger setup. The templates target v4 (CSS-first config): bare alpha modifiers like `bg-white/42` need v4's dynamic values. On a v3.4 project, rewrite non-scale alphas to bracket syntax (`bg-white/[0.42]`) when writing files — everything else works in both.

## Step 3.5 — Append the page gradient to globals.css

Read `templates/globals-snippet.css` from this skill folder. If the user picked a theme other than yellow, swap the marked `{{THEME_PAGE_OVERLAY_*}}` and `{{THEME_PAGE_BLOOM_*}}` blocks with the chosen theme's values from the table.

Locate the project's global stylesheet:
- Next.js: `app/globals.css`, `src/app/globals.css`, or `styles/globals.css`
- Vite/CRA: `src/index.css` or `src/styles/globals.css`

Append the snippet's content to the end of the global stylesheet. **Do not** overwrite — read first, append once, and skip if `gradient-page-bg` already exists in the file.

Then tell the user to add the `gradient-page-bg` class to whichever layout wrapper should host the bloom (typically the dashboard shell, not the marketing site root). Example for Next.js:

```tsx
<div className="gradient-page-bg flex min-h-screen flex-col">
  ...header / nav / main...
</div>
```

If the wrapper currently sets a solid background (`bg-zinc-50`, `bg-white`, etc.), remove that color so the gradient pseudo-elements aren't hidden behind it.

## Step 4 — Write `cn` helper if missing

If no existing `cn` was found in Step 1, write `templates/utils.ts` (in this skill folder) to the resolved path. Don't overwrite if a `utils.ts` already exists — read first, and if it has a `cn` export, leave it alone and reuse it.

## Step 5 — Write the three components

Read each template from this skill's `templates/` folder, transform if needed, and write to the project's components dir.

### Theme transformation

Each template has marker comments around the parts that change per-theme:

- `// {{THEME_PRIMARY_START}}` … `// {{THEME_PRIMARY_END}}` (in `yellow-card.tsx`) — the `primary` palette entry.
- `// {{THEME_GLOW_BACKGROUND_START}}` … `// {{THEME_GLOW_BACKGROUND_END}}` (in `yellow-modal-flow.tsx`) — the ambient radial-gradient on the modal.
- `// {{THEME_DOT_COLOR_START}}` … `// {{THEME_DOT_COLOR_END}}` (in `yellow-modal-flow.tsx`) — the dot-pattern color on the modal.
- `// {{THEME_PREVIEW_SHADOW_START}}` … `// {{THEME_PREVIEW_SHADOW_END}}` (in `empty-state.tsx`) — the side preview's accent shadow (currently a 2-stop yellow drop-shadow).
- `/* {{THEME_PAGE_OVERLAY_START}} */` … `/* {{THEME_PAGE_OVERLAY_END}} */` and `/* {{THEME_PAGE_BLOOM_START}} */` … `/* {{THEME_PAGE_BLOOM_END}} */` (in `globals-snippet.css`) — the page-level white wash and the bottom-right bloom blobs.

`empty-state.tsx` is structure-only — no glow / dots / card on the component itself. The only theme-sensitive surface is the `EmptyStatePreview` panel; its border uses `text-primary` so if your project's Tailwind primary color is set, the icon badge picks it up automatically. Override the blob gradient via `<EmptyStatePreview>{...}</EmptyStatePreview>` children when needed.

If the user picked a theme **other than yellow**, swap the marked blocks for the chosen theme's values from the table below. Keep the marker comments in the written file — that's how the next `/the-stripe-modal` run knows where to swap if the user changes their mind.

If the user picked **yellow**, leave the markers' contents as-is (yellow is already the default in the templates).

### Theme value table

For each theme, three values get substituted into the templates: the `primary` palette entry, the ambient glow background, and the dot pattern color. Substitute in all three templates.

**yellow** (default — no substitution needed)
```ts
// PRIMARY (in yellow-card.tsx)
primary: {
  background:
    "linear-gradient(155deg, hsl(48 100% 67%) 0%, hsl(48 96% 53%) 45%, hsl(42 95% 55%) 100%)",
  shadow:
    "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -12px rgba(202,138,4,0.45), 0 2px 6px -2px rgba(202,138,4,0.25)",
  text: "text-zinc-900",
},

// GLOW (in yellow-modal-flow.tsx only)
const AMBIENT_GLOW_BACKGROUND =
  "radial-gradient(ellipse 82vw 38vh at 100% 82%, hsla(48,100%,67%,0.28) 0%, hsla(48,96%,53%,0.2) 38%, hsla(42,95%,55%,0.1) 66%, rgba(255,255,255,0) 92%), radial-gradient(ellipse 58vw 24vh at 100% 96%, rgba(202,138,4,0.08) 0%, rgba(255,255,255,0) 78%)";

// DOT (in yellow-modal-flow.tsx only)
const DOT_PATTERN_COLOR = "rgba(113,63,18,0.18)";

// PREVIEW SHADOW (in empty-state.tsx)
"shadow-[0_28px_70px_-30px_rgba(202,138,4,0.45),0_10px_28px_-18px_rgba(202,138,4,0.28)]"

// PAGE OVERLAY (in globals-snippet.css)
linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.99) 52%, rgba(255,254,245,0.95) 76%, rgba(255,251,232,0.84) 100%);

// PAGE BLOOM (in globals-snippet.css)
radial-gradient(58rem 28rem at 100% 100%, rgba(245,158,11,0.45) 0%, rgba(250,204,21,0.28) 28%, transparent 68%),
radial-gradient(64rem 30rem at 76% 100%, rgba(217,119,6,0.3) 0%, rgba(202,138,4,0.18) 36%, transparent 72%),
radial-gradient(48rem 24rem at 44% 100%, rgba(245,158,11,0.2) 0%, transparent 66%);
```

**beaver** — warm tan/brown
```ts
primary: {
  background:
    "linear-gradient(155deg, hsl(28 55% 70%) 0%, hsl(25 50% 56%) 45%, hsl(22 48% 46%) 100%)",
  shadow:
    "0 1px 0 rgba(255,255,255,0.55) inset, 0 10px 30px -12px rgba(120,75,30,0.45), 0 2px 6px -2px rgba(120,75,30,0.25)",
  text: "text-zinc-900",
},
const AMBIENT_GLOW_BACKGROUND =
  "radial-gradient(ellipse 82vw 38vh at 100% 82%, hsla(28,55%,70%,0.32) 0%, hsla(25,50%,56%,0.22) 38%, hsla(22,48%,46%,0.12) 66%, rgba(255,255,255,0) 92%), radial-gradient(ellipse 58vw 24vh at 100% 96%, rgba(120,75,30,0.1) 0%, rgba(255,255,255,0) 78%)";
const DOT_PATTERN_COLOR = "rgba(80,50,20,0.2)";

// PREVIEW SHADOW
"shadow-[0_28px_70px_-30px_rgba(120,75,30,0.45),0_10px_28px_-18px_rgba(120,75,30,0.28)]"

// PAGE OVERLAY
linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.99) 52%, rgba(254,250,244,0.95) 76%, rgba(250,238,222,0.84) 100%);

// PAGE BLOOM
radial-gradient(58rem 28rem at 100% 100%, rgba(184,124,68,0.42) 0%, rgba(212,158,108,0.26) 28%, transparent 68%),
radial-gradient(64rem 30rem at 76% 100%, rgba(140,86,40,0.28) 0%, rgba(120,75,30,0.18) 36%, transparent 72%),
radial-gradient(48rem 24rem at 44% 100%, rgba(184,124,68,0.18) 0%, transparent 66%);
```

**slate** — neutral cool grey
```ts
primary: {
  background:
    "linear-gradient(155deg, hsl(220 14% 96%) 0%, hsl(220 13% 91%) 45%, hsl(220 13% 85%) 100%)",
  shadow:
    "0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 30px -12px rgba(15,23,42,0.18), 0 2px 6px -2px rgba(15,23,42,0.10)",
  text: "text-zinc-900",
},
const AMBIENT_GLOW_BACKGROUND =
  "radial-gradient(ellipse 82vw 38vh at 100% 82%, hsla(220,14%,96%,0.32) 0%, hsla(220,13%,91%,0.22) 38%, hsla(220,13%,85%,0.12) 66%, rgba(255,255,255,0) 92%), radial-gradient(ellipse 58vw 24vh at 100% 96%, rgba(15,23,42,0.06) 0%, rgba(255,255,255,0) 78%)";
const DOT_PATTERN_COLOR = "rgba(15,23,42,0.18)";
```

**mint** — fresh green
```ts
primary: {
  background:
    "linear-gradient(155deg, hsl(160 65% 78%) 0%, hsl(160 55% 60%) 45%, hsl(165 55% 50%) 100%)",
  shadow:
    "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -12px rgba(20,120,90,0.4), 0 2px 6px -2px rgba(20,120,90,0.22)",
  text: "text-zinc-900",
},
const AMBIENT_GLOW_BACKGROUND =
  "radial-gradient(ellipse 82vw 38vh at 100% 82%, hsla(160,65%,78%,0.32) 0%, hsla(160,55%,60%,0.22) 38%, hsla(165,55%,50%,0.12) 66%, rgba(255,255,255,0) 92%), radial-gradient(ellipse 58vw 24vh at 100% 96%, rgba(20,120,90,0.08) 0%, rgba(255,255,255,0) 78%)";
const DOT_PATTERN_COLOR = "rgba(15,80,60,0.2)";
```

**butter / honey / wheat** — these palette entries already live in the file as separate tones (`butter`, `honey`, `wheat`). To make any of them the **default** for the project, copy their existing palette body into the `primary` slot in `yellow-card.tsx`. The original tone stays available too.

### Import path adjustments per template

In each template, replace `@/lib/utils` with whatever path resolves correctly for the project (Step 1 decided this). If the project uses `next/link` you're fine; otherwise edit the `EmptyState` import.

### Idempotency — re-running the skill

If a component file already exists at the target path:
1. Read it. Look for the marker comments (`{{THEME_PRIMARY_START}}` etc.).
2. If markers exist → swap only the marked sections (it's a re-theme, not a fresh install). Don't overwrite the rest.
3. If no markers → ask the user before overwriting. They may have customized.

## Step 6 — Smoke test + report

After writing files, give the user a paste-ready proof block they can drop into any client component to verify the install:

```tsx
import { EmptyState, EmptyStatePreview } from "@/components/empty-state";
import { Sparkle } from "@phosphor-icons/react";

<EmptyState
  eyebrow="Smoke test"
  eyebrowIcon={<Sparkle size={13} weight="fill" />}
  title="The Stripe is installed"
  description="If this renders with a pill eyebrow, a display-weight title, and a frosted side panel on the right, the install worked."
  primaryAction={{ label: "Looks good", href: "/" }}
  preview={<EmptyStatePreview label="OK" iconElement={Sparkle} />}
/>
```

Then summarize what you did:
- Theme picked: `<theme>`
- Files written: list them with paths
- Deps installed: list them
- Anything skipped (existing `cn`, existing components) and why
- Anything the user needs to do manually (swap `next/link`, configure `@/` alias, install Tailwind, etc.)

## Constraints + gotchas

- **Don't** rename component exports unless the user asks. The names `YellowCard`, `YellowModalFlow`, `EmptyState` are intentional — they're brand-neutral once you stop reading them as colors.
- **Don't** install Tailwind, the linter, or path aliases unprompted. If they're missing, stop and surface it — those are the user's call.
- **Don't** auto-migrate existing modals or empty states in their codebase. Ship the components only. Migration is a separate ask.
- **Do** keep the marker comments (`{{THEME_*_START}}` / `{{THEME_*_END}}`) in the written files, not just in the skill templates. They're how the next run re-themes.
- **Do** match the project's existing import quote style (single vs double) when writing files — read a nearby file to check.
- **Do** preserve the `// eslint-disable` and `// @ts-ignore` patterns the project uses if any, especially around Tailwind class strings.
- **Don't** add CSS variables, Tailwind config edits, or theme provider wrappers — the components are self-contained via inline `style={...}` for the gradient/shadow values.

## Composing the system

The three components share a vocabulary but play different roles — don't stack them inside each other:

```tsx
// Empty state — render directly. No outer card.
<EmptyState
  eyebrow="No drafts yet"
  title="Smart drafts will appear here for review"
  description="..."
  primaryAction={{ label: "Configure", href: "/settings" }}
  preview={<EmptyStatePreview label="Awaiting" iconElement={Robot} />}
/>

// Destructive confirmation modal — slides in from the bottom-right.
<YellowModalFlow
  open={...} onOpenChange={...}
  eyebrow="..." title="..."
  primaryAction={{ variant: "destructive", label: "Delete", onClick: ... }}
  secondaryAction={{ label: "Cancel", onClick: ... }}
  preview={<YellowModalFlowPreview label="Permanent" icon={<Trash size={24} weight="duotone" />} />}
/>

// Loud brand surface (no modal, no empty state — heading/marketing card).
<YellowCard tone="primary">
  <div className="p-8">
    <h2>Brand-loud heading</h2>
  </div>
</YellowCard>
```

Do **not** wrap `<EmptyState>` in `<YellowCard>` — the empty state is intentionally background-free so it composes onto the page bg cleanly (matching perspiva). The side `EmptyStatePreview` is the only visual surface in that component.

Don't invent a fourth component — if the user wants something new, extend `YellowCard` with a new tone or pass children.
