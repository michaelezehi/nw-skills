/**
 * Pure geometry for the memory hogs: which columns the panel rows can hold, where each
 * button sits, what the panel's top rule says, and which strip items fit one row. The
 * panel draws from this plan and the mouse hit test reads the same plan, so a click
 * lands on exactly the cells the button was drawn in. Nothing is cut: a column that
 * cannot fit is left out, and a strip item that cannot fit is dropped from the end.
 */
import type { Hog } from '../types.ts';
import { cellWidth, formatMb } from './format.ts';
import { confirmLines, hogHints, hogLabel, hogTotal } from './hogCopy.ts';

export const STOP_LABEL = '[ Stop ]';
export const STOP_ARMED_LABEL = '[ Stop? ]';
export const RESTART_LABEL = '[ Restart ]';
const STOP_W = cellWidth(STOP_ARMED_LABEL);
const RESTART_W = cellWidth(RESTART_LABEL);
export const ORPHAN_BADGE = ' orphan ';
const BADGE_W = cellWidth(ORPHAN_BADGE);
export const BAR_W = 10;
const MEM_W = 7;
const CPU_W = 6;
const AGE_W = 8;
/** `╰`/`│` and one cell of padding before a row's first cell. */
export const PANEL_INSET = 2;

/** A pending two-step stop: one hog, or every orphan. */
export type Armed = { target: number } | { target: 'orphans' };

export interface HogColumns {
  nameW: number;
  /** Names carry the `×50` process count. */
  counts: boolean;
  badge: boolean;
  bar: boolean;
  cpu: boolean;
  age: boolean;
  restart: boolean;
  /** Cells left for the hint. */
  hintW: number;
}

export interface HogRowPlan {
  hog: Hog;
  label: string;
  /** The hint, or the stop confirmation while armed; empty when neither fits. */
  hint: string;
  confirming: boolean;
  /** Stop button's first cell inside the row; undefined for devdeck itself. */
  stopX?: number;
  stopLabel: string;
  restartX?: number;
}

export interface HogRulePlan {
  title: string;
  /** Stop-all-orphans button text, or empty. */
  right: string;
  /** Screen column of the button's first cell. */
  rightX: number;
  fill: number;
}

export interface HogPanelPlan {
  cols: HogColumns;
  rows: HogRowPlan[];
  /** Hogs that did not fit the panel's rows. */
  hidden: number;
  rule: HogRulePlan;
  /** A thin rule sits between hog rows, so each hog after the first takes two rows. */
  ruled: boolean;
}

/** `2d 9h`, `3h 05m`, `12m`, `40s`. */
export function formatAge(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export const formatCpu = (cpu: number): string => `${Math.round(cpu)}%`;

function fixedWidth(c: Omit<HogColumns, 'hintW'>): number {
  return 2 + c.nameW + 1 + (c.badge ? BADGE_W + 1 : 0) + (c.bar ? BAR_W + 3 : 0) + MEM_W + (c.cpu ? CPU_W : 0) + (c.age ? AGE_W : 0) + 2 + 1 + (c.restart ? RESTART_W + 1 : 0) + STOP_W;
}

/**
 * The columns every row shares, for rows `inner` cells wide. While the full hints do not
 * fit, age then cpu go; while the shorter hints do not, the process counts and then
 * the bar go. The restart column goes only when name, memory and Stop cannot fit
 * otherwise. Undefined when even that cannot fit.
 */
export function hogColumns(hogs: readonly Hog[], inner: number): HogColumns | undefined {
  const nameOf = (counts: boolean) => Math.max(0, ...hogs.map((h) => cellWidth(hogLabel(h, counts))));
  const longest = Math.max(0, ...hogs.map((h) => cellWidth(hogHints(h)[0]!)));
  // The second wording is the one worth giving up the counts and the bar for; the third is a last resort.
  const shortest = Math.max(0, ...hogs.map((h) => cellWidth(hogHints(h)[1] ?? hogHints(h)[0]!)));
  const cols = { nameW: nameOf(true), counts: true, badge: hogs.some((h) => h.orphan), bar: true, cpu: true, age: true, restart: hogs.some((h) => h.serviceId !== undefined && !h.self) };
  const room = () => inner - fixedWidth(cols);
  if (room() < longest) cols.age = false;
  if (room() < longest) cols.cpu = false;
  if (room() < shortest) Object.assign(cols, { counts: false, nameW: nameOf(false) });
  if (room() < shortest) cols.bar = false;
  if (room() < 0) cols.restart = false;
  if (room() < 0) return undefined;
  return { ...cols, hintW: room() };
}

/** The first hog row shown when `visible` rows hold the list and `selected` must be on screen. */
export function windowStart(total: number, visible: number, selected: number): number {
  if (visible <= 0 || total <= visible) return 0;
  return Math.max(0, Math.min(selected - visible + 1, total - visible));
}

function rulePlan(hogs: readonly Hog[], width: number, hidden: number, armed: Armed | undefined): HogRulePlan {
  const orphans = hogs.filter((h) => h.orphan).length;
  const armedOrphans = armed?.target === 'orphans' && orphans > 0;
  const noun = orphans === 1 ? 'orphan' : 'orphans';
  const right = orphans === 0 ? '' : armedOrphans ? `[ Stop ${orphans} ${noun}? ]` : '[ Stop all orphans ]';
  const parts = ['MEMORY HOGS', armedOrphans ? `press S or click again to stop ${orphans} ${noun}` : hogTotal(hogs)];
  if (hidden > 0) parts.push(`m shows ${hidden} more`);
  const fits = (title: string, r: string) => width - (2 + cellWidth(title) + 1 + 1) - (r ? cellWidth(r) + 2 : 0) >= 1;
  let rightText = right;
  while (parts.length > 1 && !fits(parts.join(' · '), rightText)) parts.pop();
  if (!fits(parts.join(' · '), rightText)) rightText = '';
  const title = parts.join(' · ');
  const fill = width - (2 + cellWidth(title) + 1 + 1) - (rightText ? cellWidth(rightText) + 2 : 0);
  return { title, right: rightText, rightX: width - 2 - cellWidth(rightText), fill: Math.max(0, fill) };
}

/** Everything the panel of `width` by `rows` (rules included) draws, with the button positions. */
export function planHogPanel(hogs: readonly Hog[], width: number, rows: number, selected: number, armed?: Armed): HogPanelPlan | undefined {
  const inner = Math.max(0, width - 4);
  const content = Math.max(0, rows - 2);
  const ruled = content >= 3;
  const visible = ruled ? Math.ceil(content / 2) : content;
  const start = windowStart(hogs.length, visible, selected);
  const shown = hogs.slice(start, start + visible);
  const cols = hogColumns(shown, inner);
  const hidden = hogs.length - shown.length;
  const rule = rulePlan(hogs, width, hidden, armed);
  if (!cols) return { cols: { nameW: 0, counts: false, badge: false, bar: false, cpu: false, age: false, restart: false, hintW: 0 }, rows: [], hidden: hogs.length, rule, ruled };
  const stopX = inner - STOP_W;
  const restartX = stopX - 1 - RESTART_W;
  const planned = shown.map((hog): HogRowPlan => {
    const confirming = armed !== undefined && armed.target === hog.pid;
    const lines = confirming ? confirmLines(hog) : hogHints(hog);
    return {
      hog,
      label: hogLabel(hog, cols.counts),
      hint: lines.find((t) => cellWidth(t) <= cols.hintW) ?? '',
      confirming,
      stopX: hog.self ? undefined : stopX,
      stopLabel: confirming ? STOP_ARMED_LABEL : STOP_LABEL,
      restartX: cols.restart && hog.serviceId !== undefined && !hog.self ? restartX : undefined,
    };
  });
  return { cols, rows: planned, hidden, rule, ruled: ruled && planned.length > 1 };
}

/** One strip item: `vitest orphan 1.7 GB`. */
export interface StripItem {
  hog: Hog;
  name: string;
  mem: string;
}

export const STRIP_LEAD = 'hogs  ';
export const STRIP_KEY = 'm';
export const STRIP_WORD = ' list';
const SEP = ' · ';

const itemWidth = (item: StripItem): number => cellWidth(item.name) + (item.hog.orphan ? cellWidth(' orphan') : 0) + 1 + cellWidth(item.mem);

/** The strip's items, largest first, as many as fit `width` whole, with the lead and the key hint. */
export function planHogStrip(hogs: readonly Hog[], width: number): { lead: boolean; items: StripItem[]; key: boolean } {
  const items: StripItem[] = [];
  const tail = cellWidth(STRIP_KEY + STRIP_WORD);
  let used = cellWidth(STRIP_LEAD) + 2 + tail;
  for (const hog of hogs) {
    const item = { hog, name: hog.name, mem: formatMb(hog.memMb) };
    const w = itemWidth(item) + (items.length > 0 ? SEP.length : 0);
    if (used + w > width) break;
    items.push(item);
    used += w;
  }
  const key = cellWidth(STRIP_LEAD) + tail <= width;
  return { lead: cellWidth(STRIP_LEAD) <= width, items, key };
}

export const STRIP_SEP = SEP;

/** What a click on a cell does. */
export type HogHit = { kind: 'stop'; pid: number } | { kind: 'restart'; pid: number } | { kind: 'select'; pid: number } | { kind: 'orphans' } | { kind: 'open' };

export interface HitRegion {
  y: number;
  x0: number;
  /** One past the last cell. */
  x1: number;
  hit: HogHit;
}

/** Clickable cells of a panel whose top rule is screen row `top`. Buttons come before the row they sit on. */
export function panelRegions(plan: HogPanelPlan, top: number, width: number): HitRegion[] {
  const out: HitRegion[] = [];
  if (plan.rule.right) out.push({ y: top, x0: plan.rule.rightX, x1: plan.rule.rightX + cellWidth(plan.rule.right), hit: { kind: 'orphans' } });
  plan.rows.forEach((row, i) => {
    const y = top + 1 + i * (plan.ruled ? 2 : 1);
    if (row.stopX !== undefined) out.push({ y, x0: PANEL_INSET + row.stopX, x1: PANEL_INSET + row.stopX + cellWidth(row.stopLabel), hit: { kind: 'stop', pid: row.hog.pid } });
    if (row.restartX !== undefined) out.push({ y, x0: PANEL_INSET + row.restartX, x1: PANEL_INSET + row.restartX + cellWidth(RESTART_LABEL), hit: { kind: 'restart', pid: row.hog.pid } });
    out.push({ y, x0: 0, x1: width, hit: { kind: 'select', pid: row.hog.pid } });
  });
  return out;
}

/** The strip opens the hog view from any cell. */
export function stripRegions(top: number, width: number): HitRegion[] {
  return [{ y: top, x0: 0, x1: width, hit: { kind: 'open' } }];
}
