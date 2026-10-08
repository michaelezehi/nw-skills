// Generated product/flow data → lib/rnd/<slug>.ts. One per build deck.
// Reuse the sibling consensus page's screen ids so the deck inherits its
// wireframes + "today" baseline. Wireframe `svg` from the Sketches CLI.
import type { ProductData } from "./types";

export const SLUG_FLOW: ProductData = {
  slug: "example-build",
  topic: "Example build",
  introLede:
    "The agreed outcome of the design session, turned into the production flow.",
  beforeWeBuild:
    "This is the technical read, with the call already made on each open item — the premise we build on. We still validate together before the sprint.",
  execSummary: "The whole build in one paragraph.",
  screens: [
    {
      id: "home",
      n: 1,
      name: "Home dashboard",
      term: "Two-phase dashboard (pre- vs post-blueprint)",
      intent: "One surface that changes job as the team progresses.",
      context: "What it is today, and what changes — in plain language.",
      build: ["The agreed scope, point one.", "Point two.", "Point three."],
      rec: "The technical call — the decision the build rests on, written plainly.",
      open: "The question this call resolves.",
      // svg: '<figure class="sk">…</figure>',
      // caption: 'Screen 1 — where every team starts.',
    },
  ],
  flowsWithDemo: [], // screen ids with a built demo flow
  consensusSlug: undefined, // e.g. "example-spec" when a sibling consensus page exists
};
