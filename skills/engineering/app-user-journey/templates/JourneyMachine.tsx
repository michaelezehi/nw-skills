"use client";

// Hand-drawn-feel state machine renderer for the user-journeys pages.
// Node and diamond outlines come from the Sketches repertoire ("journey-node",
// "journey-decision"); edges are computed between grid cells from the layout.
// A single hero dot walks the path; a before/after toggle collapses the graph
// from the full journey to the proposed lean one, animated with motion.
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  JOURNEY_DECISION_D,
  JOURNEY_DECISION_H,
  JOURNEY_DECISION_W,
  JOURNEY_NODE_D,
  JOURNEY_NODE_H,
  JOURNEY_NODE_W,
} from "@/lib/rnd/user-journeys/sketches";
import { layoutGraph, type LaidOutNode } from "@/lib/rnd/user-journeys/machine-layout";
import type { JourneyMachineData } from "@/lib/rnd/user-journeys/types";
import styles from "./user-journeys.module.css";

// Renovyn sketch palette (matches app-map-figures.ts).
const INK = "#2b3a30";
const SOFT = "#8a8273";
const FAINT = "#d9d2c4";
const HERO = "#6B8F71";
const HEROFILL = "#a9c7ad";
const PAPER = "#faf8f3";
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export interface JourneyMachineHandle {
  /** Advance the dot; returns false when the machine is already at that end. */
  step(direction: number): boolean;
}

type Placed = LaidOutNode;

function edgePath(a: Placed, b: Placed): {
  d: string;
  mx: number;
  my: number;
  anchor: "start" | "middle";
} {
  const gap = 8;
  if (a.row === b.row) {
    const dir = b.cx > a.cx ? 1 : -1;
    const x1 = a.cx + dir * (a.halfW + gap);
    const x2 = b.cx - dir * (b.halfW + gap);
    return {
      d: `M ${x1} ${a.cy} Q ${(x1 + x2) / 2} ${a.cy + 7} ${x2} ${b.cy}`,
      mx: (x1 + x2) / 2,
      // Clear the tops of both shapes so the label never sits on a node.
      my: a.cy - Math.max(a.halfH, b.halfH) - 8,
      anchor: "middle",
    };
  }
  if (a.col === b.col) {
    const dir = b.cy > a.cy ? 1 : -1;
    const y1 = a.cy + dir * (a.halfH + gap);
    const y2 = b.cy - dir * (b.halfH + gap);
    return {
      d: `M ${a.cx} ${y1} Q ${a.cx + 7} ${(y1 + y2) / 2} ${a.cx} ${y2}`,
      // Left-anchored beside the line so the walking dot never covers it.
      mx: a.cx + 16,
      my: (y1 + y2) / 2,
      anchor: "start",
    };
  }
  const y1 = a.cy + a.halfH + gap;
  const y2 = b.cy - b.halfH - gap;
  return {
    d: `M ${a.cx} ${y1} C ${a.cx} ${y1 + 26}, ${b.cx} ${y2 - 26}, ${b.cx} ${y2}`,
    mx: (a.cx + b.cx) / 2 + 10,
    my: (y1 + y2) / 2,
    anchor: "start",
  };
}

export const JourneyMachine = forwardRef<
  JourneyMachineHandle,
  { data: JourneyMachineData; defaultMode?: "current" | "proposed" }
>(function JourneyMachine({ data, defaultMode = "current" }, ref) {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<"current" | "proposed">(defaultMode);
  const [step, setStep] = useState(0);

  const graph = mode === "current" ? data.current : data.proposed;
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const placed = layout.nodes;
  const { width: w, height: h } = layout;
  const walkIndex = useMemo(() => {
    const m = new Map<string, number>();
    graph.walk.forEach((id, i) => m.set(id, i));
    return m;
  }, [graph]);

  // Walk timer: clicking a node steps the dot through every stop in between,
  // so intermediate nodes animate into being one after another.
  const walkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopWalking = useCallback(() => {
    if (walkTimer.current) {
      clearInterval(walkTimer.current);
      walkTimer.current = null;
    }
  }, []);
  useEffect(() => stopWalking, [stopWalking]);

  const goTo = (target: number) => {
    stopWalking();
    if (target < 0 || target >= graph.walk.length || target === step) return;
    if (reducedMotion) {
      setStep(target);
      return;
    }
    const dir = target > step ? 1 : -1;
    let cursor = step;
    const tick = () => {
      cursor += dir;
      setStep(cursor);
      if (cursor === target) stopWalking();
    };
    tick();
    if (cursor !== target) walkTimer.current = setInterval(tick, 150);
  };

  const doStep = (d: number): boolean => {
    stopWalking();
    const next = step + d;
    if (next < 0 || next >= graph.walk.length) return false;
    setStep(next);
    return true;
  };
  useImperativeHandle(ref, () => ({ step: doStep }));

  const switchMode = (next: "current" | "proposed") => {
    if (next === mode) return;
    stopWalking();
    const currentNodeId = graph.walk[step];
    const nextGraph = next === "current" ? data.current : data.proposed;
    const carried = nextGraph.walk.indexOf(currentNodeId);
    setMode(next);
    setStep(carried >= 0 ? carried : 0);
  };

  const hereId = graph.walk[Math.min(step, graph.walk.length - 1)];
  const here = placed.get(hereId);
  const hereNode = graph.nodes.find((n) => n.id === hereId);
  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 170, damping: 22 };

  return (
    <div className={styles.machine}>
      <div className={styles.machineBar}>
        <div className={styles.machineToggle} role="group" aria-label="Before or after">
          <button
            className={mode === "current" ? styles.machineToggleOn : styles.machineToggleBtn}
            onClick={() => switchMode("current")}
          >
            {data.currentLabel}
          </button>
          <button
            className={mode === "proposed" ? styles.machineToggleOn : styles.machineToggleBtn}
            onClick={() => switchMode("proposed")}
          >
            {data.proposedLabel}
          </button>
        </div>
        <div className={styles.machineSteps}>
          <button
            className={styles.machineStepBtn}
            onClick={() => doStep(-1)}
            disabled={step === 0}
            aria-label="Previous stop"
          >
            ←
          </button>
          <span className={styles.machineWhere}>
            Stop {step + 1} of {graph.walk.length} · {hereNode?.label}
          </span>
          <button
            className={styles.machineStepBtn}
            onClick={() => doStep(1)}
            disabled={step === graph.walk.length - 1}
            aria-label="Next stop"
          >
            →
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={styles.machineSvg}
        // Never scale past 1:1 — upscaling is what made the labels balloon on
        // wide screens. Below this width the diagram shrinks to fit as usual.
        style={{ maxWidth: w }}
        role="img"
        aria-label={`Journey diagram, ${mode === "current" ? "today" : "proposed"} version, ${graph.walk.length} stops`}
      >
        {/* edges under nodes */}
        {graph.edges.map((e) => {
          const a = placed.get(e.from);
          const b = placed.get(e.to);
          if (!a || !b) return null;
          const ai = walkIndex.get(e.from);
          const bi = walkIndex.get(e.to);
          const traversed =
            ai !== undefined && bi !== undefined && bi === ai + 1 && step >= bi;
          const { d, mx, my, anchor } = edgePath(a, b);
          return (
            <motion.g
              key={`${mode}-${e.from}-${e.to}`}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={spring}
            >
              <path
                d={d}
                fill="none"
                stroke={traversed ? HERO : FAINT}
                strokeWidth={traversed ? 2.6 : 2}
                strokeLinecap="round"
                strokeDasharray={e.dashed ? "3 7" : undefined}
              />
              {e.label && (
                <text
                  x={mx}
                  y={my}
                  fontFamily={FONT}
                  fontSize="10.5"
                  fontWeight={600}
                  fill={SOFT}
                  textAnchor={anchor}
                >
                  {e.label}
                </text>
              )}
            </motion.g>
          );
        })}

        <AnimatePresence initial={false} mode="popLayout">
          {graph.nodes.map((n) => {
            const p = placed.get(n.id)!;
            const wi = walkIndex.get(n.id);
            const reached = wi !== undefined && wi <= step;
            const decision = n.kind === "decision";
            const shapeD = decision ? JOURNEY_DECISION_D : JOURNEY_NODE_D;
            const baseW = decision ? JOURNEY_DECISION_W : JOURNEY_NODE_W;
            const baseH = decision ? JOURNEY_DECISION_H : JOURNEY_NODE_H;
            // The sketch outlines are authored at a fixed size; stretch each one
            // to the box its own text needs, then correct the stroke so the
            // hand-drawn weight stays even across differently sized shapes.
            const sx = p.w / baseW;
            const sy = p.h / baseH;
            const strokeScale = Math.sqrt(sx * sy);
            const heroFill = n.kind === "start" || n.kind === "surface" || n.kind === "end";
            const { lines, subLines, firstY, labelSize, subSize, lineH, subLineH } = p;
            const onWalk = wi !== undefined;
            return (
              <motion.g
                key={n.id}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.6, x: p.cx, y: p.cy }}
                animate={{
                  opacity: reached ? 1 : 0.5,
                  scale: 1,
                  x: p.cx,
                  y: p.cy,
                }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.55 }}
                transition={spring}
                style={onWalk ? { cursor: "pointer" } : undefined}
                onClick={onWalk ? () => goTo(wi) : undefined}
                role={onWalk ? "button" : undefined}
                tabIndex={onWalk ? 0 : undefined}
                aria-label={onWalk ? `Go to stop ${wi + 1}: ${n.label}` : undefined}
                onKeyDown={
                  onWalk
                    ? (ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          goTo(wi);
                        }
                      }
                    : undefined
                }
              >
                <path
                  d={shapeD}
                  transform={`translate(${-p.w / 2} ${-p.h / 2}) scale(${sx} ${sy})`}
                  fill={heroFill ? HEROFILL : PAPER}
                  stroke={reached ? INK : FAINT}
                  strokeWidth={2.4 / strokeScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={n.skippable ? `${5 / strokeScale} ${6 / strokeScale}` : undefined}
                />
                {lines.map((line, i) => (
                  <text
                    key={`${line}-${i}`}
                    x={0}
                    y={firstY + i * lineH}
                    fontFamily={FONT}
                    fontSize={labelSize}
                    fontWeight={600}
                    fill={reached ? INK : SOFT}
                    textAnchor="middle"
                  >
                    {line}
                  </text>
                ))}
                {subLines.map((line, i) => (
                  <text
                    key={`sub-${line}-${i}`}
                    x={0}
                    y={firstY + lines.length * lineH + i * subLineH}
                    fontFamily={FONT}
                    fontSize={subSize}
                    fill={SOFT}
                    textAnchor="middle"
                  >
                    {line}
                  </text>
                ))}
                {n.skippable && (
                  <text
                    x={0}
                    y={-p.halfH - 6}
                    fontFamily={FONT}
                    fontSize="9"
                    fontWeight={650}
                    fill={SOFT}
                    textAnchor="middle"
                    letterSpacing="0.08em"
                  >
                    SKIPPABLE
                  </text>
                )}
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* the "you are here" dot */}
        {here && (
          <motion.g
            initial={false}
            animate={{ x: here.cx, y: here.cy - here.halfH - 16 }}
            transition={spring}
          >
            <circle r="7" fill={HERO} stroke={INK} strokeWidth="2" />
            <circle r="2.4" fill={PAPER} />
          </motion.g>
        )}
      </svg>
    </div>
  );
});
