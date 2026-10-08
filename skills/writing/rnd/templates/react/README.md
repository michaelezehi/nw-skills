# React templates (Next.js App Router) — the default for React hosts

When the host project is a Next/React app, R&D pages are REAL ROUTES inside
the app, not static HTML in `public/`. Proven on Renovyn (`apps/web/app/rnd`).

Files map into the host like this:

```
# shared
app/rnd/page.tsx                  ← index-page.tsx       (the R&D index)
components/rnd/rnd.module.css     ← rnd.module.css       (fixed design language; swap
                                                          --hero to the Sketches theme)
lib/rnd/types.ts                  ← types.ts             (all three modes' shapes)
lib/rnd/index.ts                  ← generated: RND_THEMES aggregator (index entries)

# demo (default for a PRD)
app/rnd/[theme]/demo/page.tsx     ← theme-demo-page.tsx  (one route, all themes)
components/rnd/DemoViewer.tsx     ← DemoViewer.tsx       (side menu, keyboard, hash
                                                          deep links, "From the PRD")
lib/rnd/themes/<slug>.ts          ← generated: one RndTheme data module per theme

# consensus (--consensus) — votable spec, votes shared via Convex
app/rnd/<slug>/page.tsx           ← consensus-page.tsx
components/rnd/ConsensusSpec.tsx  ← ConsensusSpec.tsx    (gate, tracker, pages, votes)
components/rnd/IdentityGate.tsx   ← IdentityGate.tsx
components/rnd/consensus.module.css ← consensus.module.css
lib/rnd/identity.ts               ← identity.ts          (?as= + localStorage)
lib/rnd/useSpec.ts                ← useSpec.ts           (convex/react hooks; set `api` import)
lib/rnd/<slug>.ts                 ← consensus-data.example.ts (ConsensusData)
convex/rnd_spec.ts                ← ../convex/rnd_spec.ts (set ALLOWED_PEOPLE; push)

# product (--product) — screen-by-screen build deck
app/rnd/<slug>/page.tsx           ← product-page.tsx
components/rnd/ProductionFlow.tsx ← ProductionFlow.tsx   (hash-routed slides, rail)
components/rnd/product.module.css ← product.module.css
lib/rnd/<slug>.ts                 ← flow-data.example.ts (ProductData)

# wiring (once)
middleware / next.config          ← middleware-snippet.ts (allow-list + theme redirect)
```

Consensus uses **live Convex subscriptions** (`convex/react` `useQuery`/
`useMutation`), not the HTML vanilla-fetch shim — every participant sees votes
the instant they land. Point `useSpec.ts`'s `api` import at the host's generated
api (founder-x: `@/lib/convex`).

**The index across modes.** `index-page.tsx` is demo-centric (it maps
`RND_THEMES` → `/rnd/<slug>/demo`). When a surface mixes modes, give the index a
unified entry list where each row carries an explicit `href` (`/rnd/<slug>` for
consensus/product, `/rnd/<slug>/demo` for a demo) and a `status`, and link
`Link href={entry.href}`. Demo themes still default their href to `/demo`.

Rules carried over from the HTML archetype:

- Theme data modules hold the Sketches figure markup as strings; the viewer
  injects them. Every drawing still comes from the Sketches skill.
- Scene `detail` bullets come from the source PRD; `prd` names the file(s).
- The URL hash is the single source of truth for the visible scene
  (`useSyncExternalStore` on `hashchange`); `#last` lands on the final scene
  so ← from a page's first scene crosses into the previous theme's end.
- `robots: { index: false, follow: false }` on every route.
- Auth: the `/rnd` prefix must be public — add it to the host's middleware
  allow-list (e.g. `unauthenticatedPaths: ["/rnd", "/rnd/(.*)"]`).
- Shorthand redirect in next.config:
  `{ source: "/rnd/:theme([^/.]+)", destination: "/rnd/:theme/demo" }`.
- Project name, hero tokens, and "Main site" link are the only things to
  rebrand; the layout and register are fixed.
