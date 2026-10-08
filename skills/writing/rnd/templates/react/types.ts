export interface RndScene {
  /** Deep-link hash for this moment */
  id: string;
  title: string;
  caption: string;
  /** Bullets lifted from the source PRD (task ids, acceptance criteria) */
  detail: string[];
  /** Self-contained sketch figure markup (Sketches skill output) */
  svg: string;
}

export interface RndTheme {
  slug: string;
  name: string;
  /** Source PRD path(s), shown under the detail panel */
  prd: string;
  /** One-line summary for the index */
  summary: string;
  /** Small inline-SVG icon for the index */
  icon: string;
  scenes: RndScene[];
}

/* ── Consensus (--consensus) ─────────────────────────────────────────── */

export interface RndPerson {
  id: string;
  codename?: string;
  role: string;
}

export interface RndPanel {
  lead?: string;
  points: string[];
}

export type RndPriority = "must" | "should" | "nice" | "new";

export interface RndPage {
  id: string;
  group: string;
  area: string;
  title: string;
  priority: RndPriority;
  sources: string[];
  current: RndPanel;
  planned: RndPanel;
  quote?: { who: string; text: string };
  /** The technical note (engineering read on feasibility / sequence) */
  architect: string;
  /** Sketches figure markup for this page's wireframe */
  svg?: string;
}

export interface RndDocSection {
  id: string;
  heading: string;
  body: string[];
}

export interface RndDoc {
  id: string;
  title: string;
  short: string;
  source: string;
  sections: RndDocSection[];
}

export interface RndDocRef {
  doc: string;
  section: string;
  label: string;
}

export interface ConsensusData {
  /** Shared with the Convex rnd_spec doc id; also the page slug */
  docId: string;
  topic: string;
  headline: string;
  headlineSub: string;
  lede: string;
  people: RndPerson[];
  groups: { id: string; label: string }[];
  pages: RndPage[];
  docs: RndDoc[];
  pageRefs: Record<string, RndDocRef[]>;
  aligned: { title: string; body: string }[];
  /** One shared avatar figure (Sketches output) for the identity gate */
  avatarSvg: string;
}

/* ── Convex rnd_spec read shape (returned by rnd_spec:get) ───────────── */

export type VoteStatus = "approve" | "decline" | "comment" | null;
export interface SpecVote {
  pageId: string;
  person: string;
  status: VoteStatus;
  note: string;
  updatedAt: number;
}
export interface SpecComment {
  id: string;
  pageId: string;
  author: string;
  text: string;
  ts: number;
}

/* ── Product (--product) ─────────────────────────────────────────────── */

export interface RndScreen {
  id: string;
  n: number;
  name: string;
  /** The proper technical term behind the friendly name */
  term?: string;
  intent: string;
  context: string;
  build: string[];
  /** The technical call — the premise the build rests on */
  rec: string;
  open?: string;
  /** Sketches figure markup for this screen's wireframe */
  svg?: string;
  /** Optional caption under the wireframe */
  caption?: string;
}

export interface ProductData {
  slug: string;
  topic: string;
  introLede: string;
  beforeWeBuild: string;
  execSummary: string;
  screens: RndScreen[];
  /** Screen ids that have a built demo flow (gates the demo link) */
  flowsWithDemo: string[];
  /** Slug of the sibling consensus page, if one exists */
  consensusSlug?: string;
}
