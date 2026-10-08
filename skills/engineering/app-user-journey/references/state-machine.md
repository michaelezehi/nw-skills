# The state machine renderer

Two files, copied as a pair from `templates/`, never forked per page:

- `machine-layout.ts` — pure layout maths. Imports nothing but its own types, so
  it drops into any project unchanged and is unit-testable without rendering.
- `JourneyMachine.tsx` — the client renderer. Reads the layout, draws sketch
  outlines, animates the walking dot, owns the before/after toggle.

`JourneyViewer.tsx` (hash-routed act viewer) and `user-journeys.module.css` come
along for a full microsite; the machine works standalone without them.

## The one rule

**The box is fixed, the text fits itself.**

Every node of a kind is the same size — the grid stays regular, rows have a set
height, and the text block is middle-aligned inside the shape. Labels then step
down in size to stay on **one line**, wrapping only when even the floor cannot
fit. One line at a smaller size always beats two lines at a larger one.

The inverse (growing shapes to fit text) was tried and reverted: it makes the
canvas wider than its container, and since the SVG scales to fill, the labels
then render *larger* than the surrounding page while the grid goes ragged.

Knobs, all in `machine-layout.ts`:

| Constant | Default | What it does |
|---|---|---|
| `LABEL_BASE` / `LABEL_MIN` | 11.5 / 9 | Type range. Base should match the host's small UI text. |
| `SUB_BASE` / `SUB_MIN` | 9 / 7.5 | Sub-line range. |
| `NODE_W` / `NODE_H` | 180 / 66 | Rect box. |
| `DECISION_W` / `DECISION_H` | 196 / 92 | Diamond box. Diamonds need more room for the same text. |
| `PAD` / `GUTTER_X` / `GUTTER_Y` | 26 / 46 / 48 | Canvas padding and grid gutters. |

Two geometry facts the code encodes, worth not rediscovering:

- A rhombus contains a centred rectangle only where `tw/a + th/b <= 1`. Width
  must therefore be measured **at the true block height** — a sub-line placed
  naively sits where the shape has already tapered to nothing. That was the
  original overflow bug.
- The SVG is capped at its own viewBox width (`style={{ maxWidth: w }}`) so it
  never scales past 1:1. Without this, wide screens inflate every label.

## Focus

The default browser focus ring draws a hard blue rectangle around the whole node
group on **mouse clicks too**. The CSS drops it for pointers and gives keyboard
users a branded ring:

```css
.machineSvg g[role="button"]:focus { outline: none; }
.machineSvg g[role="button"]:focus-visible {
  outline: 2px solid var(--heroDeep);
  outline-offset: 4px;
  border-radius: 16px;
}
```

## Full-width panel

Diagrams need room, so the machine breaks out of the prose column:

```css
.machine {
  position: relative; left: 50%; transform: translateX(-50%);
  width: 100vw; max-width: 1760px; box-sizing: border-box;
  padding: 20px clamp(16px, 3vw, 44px) 24px;
  background: var(--panel); border-block: 1px solid var(--line);
}
```

Pair it with `overflow-x: clip` on the page root — **clip, not hidden**. `hidden`
turns the root into a scroll container and unsticks a sticky header.

## Theming

Recolour via the palette constants at the top of `JourneyMachine.tsx` (`INK`,
`HERO`, `HEROFILL`, `PAPER`, `FAINT`, `SOFT`) and the CSS custom properties on
`.root`. Take the values from the project's Sketches theme so the machine matches
its sketches.

## Required tripwires

Copy these into the host's test suite — they are what keep the rule enforced:

1. **Text fits its shape** — `textFitsInShape(node)` for every node of every graph.
2. **Labels never truncate** — `node.lines.join(" ") === node.label`.
3. **Shapes stay uniform** — at most two distinct boxes per graph (rect + diamond).
4. **Type stays in range** — `LABEL_MIN <= labelSize <= LABEL_BASE`.
5. **No overlaps** — no two nodes' boxes intersect.
6. **Graphs are valid** — unique ids, no two nodes in one grid cell, every walk id
   and edge endpoint exists, the walk starts on a `start` node.
