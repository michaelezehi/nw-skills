// Generated consensus data → lib/rnd/<slug>.ts. One per artifact.
// `docId` is the Convex rnd_spec doc key AND the route slug — keep them equal.
// Wireframe `svg` strings come from the Sketches CLI (figure markup, JSX-style
// comments stripped). Fill from the brief; confirm with the user before build.
import type { ConsensusData } from "./types";

export const SLUG_DATA: ConsensusData = {
  docId: "example-spec",
  topic: "Example spec",
  headline: "What we agreed",
  headlineSub: "page by page.",
  lede: "The design-call outcome as a living, votable spec.",
  people: [
    { id: "Ana", codename: "UX lead", role: "UX & user advocacy" },
    { id: "Ben", codename: "Engineering", role: "Engineering · signs last" },
  ],
  groups: [{ id: "core", label: "Core surfaces" }],
  pages: [
    {
      id: "home",
      group: "core",
      area: "Core page · Home",
      title: "Home dashboard",
      priority: "must",
      sources: ["Ana", "Ben"],
      current: { lead: "What it is today.", points: ["Point one.", "Point two."] },
      planned: { lead: "What we agreed to change.", points: ["Change one.", "Change two."] },
      quote: { who: "Ana", text: "A verbatim quote from the brief." },
      architect: "The engineering read on feasibility and sequence.",
      // svg: '<figure class="sk">…</figure>',  // from the Sketches CLI
    },
  ],
  docs: [
    {
      id: "brief",
      title: "Design call notes",
      short: "Brief",
      source: "Source: design call, June 2026",
      sections: [
        { id: "home", heading: "Home dashboard", body: ["What the brief said about Home."] },
      ],
    },
  ],
  pageRefs: {
    home: [{ doc: "brief", section: "home", label: "Home dashboard" }],
  },
  aligned: [{ title: "Pre-agreed point.", body: "Context for the point." }],
  avatarSvg: '<figure class="sk"><svg viewBox="0 0 120 116"></svg></figure>',
};
