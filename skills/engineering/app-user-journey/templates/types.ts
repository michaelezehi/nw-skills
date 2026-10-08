// Types for the /rnd/user-journeys microsite: the journey state machine the
// JourneyMachine component renders, plus the act/section content model the
// journey pages walk through.

export type JourneyNodeKind = "start" | "step" | "decision" | "surface" | "end";

export interface JourneyNode {
  id: string;
  label: string;
  /** Optional smaller second line under the label. */
  sub?: string;
  kind: JourneyNodeKind;
  /** Grid coordinates; JourneyMachine maps these to pixels. */
  col: number;
  row: number;
  /** Drawn dashed: the person can skip past this stop. */
  skippable?: boolean;
}

export interface JourneyEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface JourneyGraph {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  /** Ordered node ids the "you are here" dot walks. */
  walk: string[];
}

/** The before/after pair a single machine toggles between. */
export interface JourneyMachineData {
  current: JourneyGraph;
  proposed: JourneyGraph;
  /** Toggle labels, e.g. "Today · 22 stops" / "Proposed · 11 stops". */
  currentLabel: string;
  proposedLabel: string;
}

/** A table rendered as HTML in a section (module inventory, fellowships…). */
export interface JourneyTable {
  columns: string[];
  rows: JourneyTableRow[];
}

export interface JourneyTableRow {
  cells: string[];
  /** Renders an On/Off state chip in the last column. */
  on?: boolean;
}

/** One content block inside an act. Every field is optional except id/title. */
export interface JourneySection {
  id: string;
  title: string;
  lede?: string;
  /** Sketch figure markup (Sketches skill output) shown above the body. */
  svg?: string;
  caption?: string;
  /** Renders the journey machine here, defaulted to this mode. */
  machine?: "current" | "proposed";
  table?: JourneyTable;
  /** Pill list, e.g. Quick Access pins. */
  chips?: { label: string; hero?: boolean }[];
  /** A spoken line set apart, e.g. the Buddy welcome. */
  quote?: string;
  /** Titled bullet lists, e.g. week one / week two suggestions. */
  lists?: { title: string; items: string[] }[];
  /** Collapsed "From the PRD" bullets. */
  detail?: string[];
}

export interface JourneyAct {
  id: string;
  /** e.g. "Act 1 · Getting in" */
  eyebrow: string;
  title: string;
  lede: string;
  sections: JourneySection[];
}

/** Everything one journey page (an addiction, or the supporter) needs. */
export interface JourneyPageData {
  slug: string;
  name: string;
  /** Sketch icon markup for the page header. */
  icon: string;
  /** Source PRD path string, shown under detail panels. */
  prd: string;
  machine: JourneyMachineData;
  acts: JourneyAct[];
}
