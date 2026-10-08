# Verification gate

Nothing ships until every line passes.

## Build
- [ ] Typecheck clean (host's tsc).
- [ ] Lint: no new errors (pre-existing warnings may remain, say how many).
- [ ] Production build succeeds and lists every new route.
- [ ] No new npm dependency; no new CSS file beyond the copied module.

## Routes
- [ ] Every route returns 200 and contains a content marker unique to it.
- [ ] `robots: { index: false, follow: false }` on every page.
- [ ] `/rnd` allow-listed in auth middleware; new slugs excluded from any
      `/rnd/:theme` rewrite.

## Diagram (the tripwires from state-machine.md)
- [ ] Text fits inside its shape, every node, every graph.
- [ ] No label truncated — joined lines equal the original label.
- [ ] Shapes uniform; type within `[LABEL_MIN, LABEL_BASE]`.
- [ ] No node overlaps; walks and edges reference real nodes.
- [ ] Stop counts in the toggle labels are computed, not typed.

## Honesty
- [ ] Every inventory number traced to the code that produces it.
- [ ] Anything mirrored by hand has a drift test in the same commit.
- [ ] Host copy bans respected (check the project CLAUDE.md).
- [ ] Placeholder imagery is labelled as a placeholder on the page.

## Report
State the roles found and where, stop counts per role, routes created, the PRD
path, and every item still owed.
