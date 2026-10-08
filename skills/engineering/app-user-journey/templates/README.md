# Templates

Copy these into the host app. They assume a Next.js App Router project with the
`@/*` path alias and the layout in `references/architecture.md`.

| File | Copy to | Edit after copying? |
|---|---|---|
| `machine-layout.ts` | `lib/rnd/user-journeys/machine-layout.ts` | Only the size constants, and only with a reason |
| `types.ts` | `lib/rnd/user-journeys/types.ts` | No |
| `node-shapes.ts` | re-export from `lib/rnd/user-journeys/sketches.ts` | No |
| `JourneyMachine.tsx` | `components/rnd/JourneyMachine.tsx` | Palette constants only |
| `JourneyViewer.tsx` | `components/rnd/JourneyViewer.tsx` | The default `back` target |
| `user-journeys.module.css` | `components/rnd/user-journeys.module.css` | The `:root` token block |

## Import contract

`JourneyMachine.tsx` expects three modules to resolve:

```ts
import { JOURNEY_NODE_D, JOURNEY_NODE_W, JOURNEY_NODE_H,
         JOURNEY_DECISION_D, JOURNEY_DECISION_W, JOURNEY_DECISION_H }
  from "@/lib/rnd/user-journeys/sketches";        // re-export node-shapes.ts here
import { layoutGraph, type LaidOutNode } from "@/lib/rnd/user-journeys/machine-layout";
import type { JourneyMachineData } from "@/lib/rnd/user-journeys/types";
```

Keep the paths and everything resolves with no edits. If the host uses a
different alias or directory, change these three lines and nothing else.

## Theming

Two places, both take their values from the project's Sketches theme:

1. `JourneyMachine.tsx` — `INK`, `SOFT`, `FAINT`, `HERO`, `HEROFILL`, `PAPER`.
   These colour the SVG, which cannot read CSS custom properties for fills.
2. `user-journeys.module.css` `.root` — `--ink`, `--body`, `--faint`, `--line`,
   `--line2`, `--paper`, `--panel`, `--hero`, `--heroSoft`, `--heroDeep`.

Keep the two in step: `HERO` should equal `--heroDeep`'s family and `HEROFILL`
should equal `--hero`.

## Do not

- Fork `JourneyMachine` or `machine-layout` per page. One renderer, always.
- Re-implement node sizing inline. The rule (fixed box, shrink-to-fit text) is
  in `machine-layout.ts` and is covered by the tripwires in
  `references/state-machine.md`.
- Add an animation dependency. `motion/react` is used if the host already has
  it; otherwise strip the `motion.*` wrappers for plain SVG elements.
