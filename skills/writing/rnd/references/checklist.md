# Verify before handing off

## React host (default)
- [ ] Host `typecheck` + `lint` pass for the new `app/rnd/…`, `components/rnd/…`,
      `lib/rnd/…` files; the route builds.
- [ ] `/rnd` is allow-listed in the host's auth middleware (loads logged-out);
      the `/rnd/:theme → /rnd/:theme/demo` redirect is wired (demo).
- [ ] `robots: { index: false, follow: false }` on every route's metadata.
- [ ] No new npm dep added; no `doodle-icons`. `grep -rn "doodle-icons" app/rnd lib/rnd components/rnd` → no hits.
- [ ] Sketch strings render via `dangerouslySetInnerHTML`; `{/* … */}` comments
      stripped; each is one `<figure class="sk">` with one hero element.
- [ ] CSS-module `--hero`/`--heroSoft`/`--heroDeep` match the Sketches theme.
- [ ] `lib/rnd/index.ts` (RND_THEMES / entries) lists the new artifact; existing
      entries untouched.

## No-framework fallback (static HTML)
- [ ] Self-contained: opens by double-click; no CDN/external requests except
      the Convex deployment (consensus). `grep -i "cdn\|googleapis\|unpkg\|jsdelivr\|doodle-icons"` → no hits.
- [ ] `<meta name="robots" content="noindex, nofollow">`, real `<title>`, viewport, `lang`.
- [ ] Token block present; `rnd/index.html` lists the new entry.

## Every page (both)
- [ ] No gradients, no accent bars, no card/border around sketches.
- [ ] Copy obeys the host CLAUDE.md + universal bans (no "AI"; check
      terminology mandates). No marketing register.
- [ ] New sketches were `add`ed back to the Sketches repertoire.

## Consensus
- [ ] Convex module pushed (`npx convex dev --once` in the host's Convex root —
      never `npx convex deploy` on founder-x); `rnd_spec:get` returns for the
      new `DOC_ID` via the HTTP API (`curl` it once).
- [ ] `ALLOWED_PEOPLE` exactly matches PEOPLE ids; length caps in place.
- [ ] Identity gate: fresh visit shows the gate; pick → `?as=` appears; reload
      and the shared `?as=` link both restore identity; header switch works.
- [ ] Vote → refetch shows it; a second browser (different identity) sees it.
- [ ] Source chips open the right DOC section; every page has ≥1 ref or a
      deliberate none.
- [ ] The extraction checkpoint happened (user confirmed PEOPLE/PAGES) before
      the page was built.

## Product
- [ ] `#<screenId>` deep links round-trip (load with hash → correct slide).
- [ ] Contents rail ↔ slides in sync; prev/next disabled at the ends;
      mobile `<select>` works.
- [ ] Demo links only on screens in `FLOWS_WITH_DEMO`; consensus link only if
      the page exists.
- [ ] Every screen has a wireframe; technical-call panel reads as a decision.

## Demo
- [ ] ←/→ step across flow boundaries; Escape returns to the deck;
      `#<sceneId>` and `#<flowId>` deep links round-trip.
- [ ] One hero focal point per scene; shared shell drawn once and reused.
- [ ] Back-link lands on the matching deck slide.

## Report to the user
Paths/URLs created · index entry added · (consensus) DOC_ID + deployment +
functions reused/created · sketches reused vs added · what was deliberately
left for a later run (e.g. remaining demo flows).
