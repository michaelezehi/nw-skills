# File layout

Mirrors the shipped Renovyn structure. Pages stay thin; all content is data.

```
apps/<web>/lib/rnd/user-journeys/
  types.ts          # JourneyNode/Edge/Graph/MachineData/Section/Act/PageData  (template)
  machine-layout.ts # pure layout maths                                        (template)
  roles.ts          # per-role inventory DERIVED from shipped code
  journey.ts        # builds the four graphs (role current/proposed)
  proposal.ts       # Act 3 content per role
  mockups.ts        # phone-shell scenes via a shared phoneScene() builder
  sketches.ts       # Sketches-skill output, one map + the node path constants
  page-data.ts      # buildRolePage(slug) / buildXPage() -> JourneyPageData

apps/<web>/components/rnd/
  JourneyMachine.tsx        # the renderer          (template, do not fork)
  JourneyViewer.tsx         # hash-routed act viewer (template)
  user-journeys.module.css  # tokens + layout        (template)

apps/<web>/app/rnd/user-journeys/
  page.tsx            # hub: role tiles + a "what mapping already fixed" group
  [role]/page.tsx     # generateStaticParams over the role list
```

## Wiring checklist

- Allow-list `/rnd` and `/rnd/(.*)` in the host's auth middleware.
- If the host rewrites `/rnd/:theme` to a demo page, add the new slugs to its
  negative lookahead or they will be swallowed.
- Add a card to the `/rnd` index if one exists.
- `robots: { index: false, follow: false }` on every route.

## The data contract

`JourneyPageData` = `{ slug, name, icon, prd, machine, acts }`.

`JourneyMachineData` = `{ current, proposed, currentLabel, proposedLabel }`. The
labels **must** be computed — `` `Today · ${graph.walk.length} stops` `` — so the
headline number can never drift from the diagram.

`JourneyGraph` = `{ nodes, edges, walk }`:
- `nodes[].col/row` are grid coordinates, not pixels. Serpentine layouts (4 per
  row, alternating direction) read best for long onboarding chains.
- `kind`: `start | step | decision | surface | end`. `decision` draws a diamond;
  `start`/`surface`/`end` get the hero fill.
- `skippable: true` draws a dashed outline plus a SKIPPABLE caption.
- `walk` is the ordered path the dot follows and drives the stop counter.

`JourneySection` fields are all optional except `id`/`title`: `lede`, `svg`,
`caption`, `machine`, `table`, `chips`, `quote`, `lists`, `detail`. `detail`
renders as a collapsed "From the PRD" list — put the evidence there, with file
paths, so a reviewer can check any claim.
