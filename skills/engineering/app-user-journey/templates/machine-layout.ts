// Layout maths for the journey state machine, kept pure so it can be tested
// without rendering.
//
// The rule is: THE BOX IS FIXED, THE TEXT FITS ITSELF. Every node is the same
// size, so the grid stays regular and rows have a set height; the label then
// shrinks (and only wraps as a last resort) until it sits inside. One line at
// a smaller size always beats two lines at a larger one.
//
// This file is portable: it imports nothing but its own types, so it can be
// lifted into another project alongside JourneyMachine.tsx unchanged.
import type { JourneyGraph, JourneyNode } from "./types";

/** Deliberately generous width-per-character ratios: over-estimating shrinks
 *  text a touch, under-estimating lets it spill. */
const LABEL_CHAR_RATIO = 0.6;
const SUB_CHAR_RATIO = 0.55;

/** Type sizes. Base matches the small UI text elsewhere on the page; nothing
 *  ever renders larger than base, it only steps down to fit. */
export const LABEL_BASE = 11.5;
export const LABEL_MIN = 9;
export const SUB_BASE = 9;
export const SUB_MIN = 7.5;
const SIZE_STEP = 0.25;
/** Line box as a multiple of font size. */
const LINE_RATIO = 1.22;
const MAX_LINES = 3;

/** Fixed shape boxes — every node of a kind is identical. */
export const NODE_W = 180;
export const NODE_H = 66;
export const DECISION_W = 196;
export const DECISION_H = 92;

const PAD_X = 15;
const PAD_Y = 9;
const PAD_X_DECISION = 10;
const PAD_Y_DECISION = 6;

const GUTTER_X = 46;
const GUTTER_Y = 48;
export const PAD = 26;

export function textWidth(text: string, fontSize: number, ratio: number): number {
  return text.length * fontSize * ratio;
}

/** Greedy wrap by rendered width. Overflow past maxLines merges into the last
 *  line rather than dropping words — a truncated label is a lie on a diagram. */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  ratio: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (cur && textWidth(candidate, fontSize, ratio) > maxWidth) {
      lines.push(cur);
      cur = word;
    } else cur = candidate;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines[maxLines - 1] = lines.slice(maxLines - 1).join(" ");
    lines.length = maxLines;
  }
  return lines;
}

export function shapeBox(kind: JourneyNode["kind"]): { w: number; h: number } {
  return kind === "decision"
    ? { w: DECISION_W, h: DECISION_H }
    : { w: NODE_W, h: NODE_H };
}

/** Width available to a centred text block whose half-height is `halfBlock`.
 *  A rhombus narrows as you move off its centre line; a rectangle does not. */
export function innerWidth(kind: JourneyNode["kind"], halfBlock: number): number {
  if (kind !== "decision") return NODE_W - PAD_X * 2;
  const a = DECISION_W / 2;
  const b = DECISION_H / 2;
  const usable = Math.max(0, 1 - halfBlock / b);
  return Math.max(0, a * usable * 2 - PAD_X_DECISION * 2);
}

function innerHeight(kind: JourneyNode["kind"]): number {
  return kind === "decision" ? DECISION_H - PAD_Y_DECISION * 2 : NODE_H - PAD_Y * 2;
}

export interface FittedText {
  lines: string[];
  labelSize: number;
  subLines: string[];
  subSize: number;
  blockH: number;
}

/** Step the type down until the label sits inside the shape, preferring the
 *  fewest lines first and the largest size that works at that line count. */
export function fitText(node: JourneyNode): FittedText {
  const kind = node.kind;
  const maxH = innerHeight(kind);

  const attempt = (targetLines: number, size: number): FittedText | null => {
    const subSize = Math.max(SUB_MIN, Math.min(SUB_BASE, size * 0.82));
    // Provisional block height drives how wide the shape is at that height.
    const provisional =
      targetLines * size * LINE_RATIO + (node.sub ? subSize * LINE_RATIO : 0);
    const avail = innerWidth(kind, provisional / 2);
    if (avail <= 0) return null;

    const lines = wrapToWidth(node.label, avail, size, LABEL_CHAR_RATIO, targetLines);
    if (lines.length > targetLines) return null;
    if (lines.some((l) => textWidth(l, size, LABEL_CHAR_RATIO) > avail)) return null;

    const subLines = node.sub
      ? wrapToWidth(node.sub, avail, subSize, SUB_CHAR_RATIO, 2)
      : [];
    if (subLines.some((l) => textWidth(l, subSize, SUB_CHAR_RATIO) > avail)) return null;

    const blockH =
      lines.length * size * LINE_RATIO + subLines.length * subSize * LINE_RATIO;
    if (blockH > maxH) return null;
    // Re-check width at the true block height: a taller block sits where a
    // rhombus is narrower.
    const trueAvail = innerWidth(kind, blockH / 2);
    if (lines.some((l) => textWidth(l, size, LABEL_CHAR_RATIO) > trueAvail)) return null;
    if (subLines.some((l) => textWidth(l, subSize, SUB_CHAR_RATIO) > trueAvail)) return null;

    return { lines, labelSize: size, subLines, subSize, blockH };
  };

  for (let targetLines = 1; targetLines <= MAX_LINES; targetLines++) {
    for (let size = LABEL_BASE; size >= LABEL_MIN - 1e-9; size -= SIZE_STEP) {
      const fitted = attempt(targetLines, size);
      if (fitted) return fitted;
    }
  }
  // Nothing fit even at the floor: take the floor and let the wrap cap hold.
  return (
    attempt(MAX_LINES, LABEL_MIN) ?? {
      lines: [node.label],
      labelSize: LABEL_MIN,
      subLines: node.sub ? [node.sub] : [],
      subSize: SUB_MIN,
      blockH: LABEL_MIN * LINE_RATIO,
    }
  );
}

export interface LaidOutNode extends JourneyNode {
  cx: number;
  cy: number;
  w: number;
  h: number;
  halfW: number;
  halfH: number;
  lines: string[];
  subLines: string[];
  labelSize: number;
  subSize: number;
  /** Baseline of the first label line, relative to the shape centre. */
  firstY: number;
  lineH: number;
  subLineH: number;
}

export interface MachineLayout {
  nodes: Map<string, LaidOutNode>;
  width: number;
  height: number;
  colW: number;
  rowH: number;
}

export function layoutGraph(graph: JourneyGraph): MachineLayout {
  const colW = Math.max(NODE_W, DECISION_W) + GUTTER_X;
  const rowH = Math.max(NODE_H, DECISION_H) + GUTTER_Y;

  const nodes = new Map<string, LaidOutNode>();
  for (const node of graph.nodes) {
    const { w, h } = shapeBox(node.kind);
    const fitted = fitText(node);
    const lineH = fitted.labelSize * LINE_RATIO;
    const subLineH = fitted.subSize * LINE_RATIO;
    nodes.set(node.id, {
      ...node,
      cx: PAD + node.col * colW + colW / 2,
      cy: PAD + node.row * rowH + rowH / 2,
      w,
      h,
      halfW: w / 2,
      halfH: h / 2,
      lines: fitted.lines,
      subLines: fitted.subLines,
      labelSize: fitted.labelSize,
      subSize: fitted.subSize,
      // Middle-align the whole block, then drop to the first baseline.
      firstY: -fitted.blockH / 2 + fitted.labelSize,
      lineH,
      subLineH,
    });
  }

  const maxCol = Math.max(...graph.nodes.map((n) => n.col));
  const maxRow = Math.max(...graph.nodes.map((n) => n.row));
  return {
    nodes,
    width: PAD * 2 + (maxCol + 1) * colW,
    height: PAD * 2 + (maxRow + 1) * rowH,
    colW,
    rowH,
  };
}

/** True when the node's text block sits entirely inside its outline. */
export function textFitsInShape(n: LaidOutNode): boolean {
  const blockH = n.lines.length * n.lineH + n.subLines.length * n.subLineH;
  const widest = Math.max(
    ...n.lines.map((l) => textWidth(l, n.labelSize, LABEL_CHAR_RATIO)),
    ...n.subLines.map((l) => textWidth(l, n.subSize, SUB_CHAR_RATIO)),
    0,
  );
  return widest <= innerWidth(n.kind, blockH / 2) && blockH <= innerHeight(n.kind);
}
