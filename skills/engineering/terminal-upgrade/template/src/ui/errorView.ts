/**
 * Pure geometry for the full-screen error view: the headline, the boxed copy button and
 * the body, every line wrapped to the width instead of cut, and each piece given a colour
 * role. The view draws from this plan and the mouse hit test reads the same plan, so a
 * click lands on exactly the cells the button was drawn in.
 */
import type { DevError } from '../types.ts';
import { cellWidth } from './format.ts';
import { FILE_REF } from './links.ts';
import { foldFrames, type CardLine } from './ErrorTray.tsx';
import type { HitRegion } from './hogPlan.ts';

export type Role = 'text' | 'muted' | 'ref' | 'string' | 'error';

export interface Span {
  role: Role;
  text: string;
  bold?: boolean;
}

export interface PaintedLine {
  kind: CardLine['kind'];
  spans: Span[];
}

export const COPY_LABEL = '  Copy error  ';
export const COPIED_LABEL = '  Copied  ';
/** The button keeps one width, so it never jumps when the label flips. */
export const BUTTON_W = cellWidth(COPY_LABEL) + 2;
/** Cells between the Copy error and the Copy all buttons. */
export const BUTTON_GAP = 2;
export const copyAllLabel = (total: number): string => `  Copy all ${total}  `;
/** Headline rows kept above the body; longer titles read whole in the body. */
const MAX_TITLE_ROWS = 4;
/** `│` and one cell of padding before a row's first cell. */
const INSET = 2;

export interface ErrorViewPlan {
  meta: string;
  title: string[];
  /** 3 for the boxed button, 1 for the one-line form on short screens. */
  buttonRows: number;
  /** Body rows on screen from `offset`. */
  body: PaintedLine[];
  /** Furthest the body can scroll. */
  maxOffset: number;
  /** Body lines below the window. */
  more: number;
  /** Content row (0 under the top rule) of the button's first row. */
  buttonTop: number;
  /** The Copy all button beside Copy error when 2+ errors are open and it fits: its label and screen columns. */
  copyAll?: { label: string; x0: number; x1: number };
}

/** Break `text` into lines of at most `width` cells, at a space when one is near; `indent` leads each continuation. */
export function wrapLine(text: string, width: number, indent = ''): string[] {
  const clean = text.replace(/\t/g, '  ');
  if (width <= 0 || cellWidth(clean) <= width) return [clean];
  const lead = cellWidth(indent) < width / 2 ? indent : '';
  const out: string[] = [];
  let rest = clean;
  let first = true;
  while (rest.length > 0) {
    const room = first ? width : width - cellWidth(lead);
    if (cellWidth(rest) <= room) {
      out.push(first ? rest : lead + rest);
      break;
    }
    let cut = 0;
    let used = 0;
    for (const ch of rest) {
      const w = cellWidth(ch);
      if (used + w > room) break;
      used += w;
      cut += ch.length;
    }
    cut = Math.max(cut, 1);
    const space = rest.lastIndexOf(' ', cut);
    const at = space > cut / 2 ? space : cut;
    out.push((first ? '' : lead) + rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
    first = false;
  }
  return out;
}

const QUOTED = /"[^"\n]*"|`[^`\n]*`/g;
const HEADING = /^(\s*(?:[⨯×✖]\s*)?(?:[A-Z]\w*Error|Error|error|ERROR)\b:?)/;
const CARETS = /^[\s\d|]*\^+[\s^~]*$/;
const CODE_FRAME = /^(\s*>?\s*\d+\s*\|)(.*)$/;

/** File references and quoted strings picked out of plain text. */
function inline(text: string, plain: Role): Span[] {
  const marks: Array<{ at: number; end: number; role: Role }> = [];
  for (const m of text.matchAll(FILE_REF)) marks.push({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length, role: 'ref' });
  for (const m of text.matchAll(QUOTED)) {
    const at = m.index ?? 0;
    const end = at + m[0].length;
    if (!marks.some((r) => at < r.end && end > r.at)) marks.push({ at, end, role: 'string' });
  }
  marks.sort((a, b) => a.at - b.at);
  const spans: Span[] = [];
  let last = 0;
  for (const mark of marks) {
    if (mark.at < last) continue;
    if (mark.at > last) spans.push({ role: plain, text: text.slice(last, mark.at) });
    spans.push({ role: mark.role, text: text.slice(mark.at, mark.end), bold: mark.role === 'ref' });
    last = mark.end;
  }
  if (last < text.length) spans.push({ role: plain, text: text.slice(last) });
  return spans;
}

/** Colour roles for one wrapped line: error headings and carets red, code-frame gutters dim, paths and strings lit. */
export function paintLine(text: string, kind: CardLine['kind']): Span[] {
  if (kind === 'fold') return [{ role: 'muted', text }];
  if (kind === 'frame') return inline(text, 'muted');
  if (CARETS.test(text)) return [{ role: 'error', text, bold: true }];
  const frame = CODE_FRAME.exec(text);
  if (frame) return [{ role: frame[1]!.includes('>') ? 'error' : 'muted', text: frame[1]!, bold: frame[1]!.includes('>') }, ...inline(frame[2]!, 'text')];
  const heading = HEADING.exec(text);
  if (heading) return [{ role: 'error', text: heading[1]!, bold: true }, ...inline(text.slice(heading[1]!.length), 'text')];
  return inline(text, 'text');
}

/** The body without the headline it repeats, folded and wrapped to `width`. */
export function bodyLines(error: DevError, width: number): PaintedLine[] {
  const body = error.body[0]?.trim() === error.title.trim() ? error.body.slice(1) : error.body;
  const out: PaintedLine[] = [];
  for (const line of foldFrames(body)) {
    const text = line.kind === 'fold' ? `      … ${line.text}` : line.text;
    const indent = line.kind === 'frame' ? '        ' : (/^\s*/.exec(text)?.[0] ?? '') + '  ';
    for (const piece of wrapLine(text, width, indent)) out.push({ kind: line.kind, spans: paintLine(piece, line.kind) });
  }
  return out;
}

/** The Copy all button's cells, right of Copy error, when `total` errors are open and it fits in `inner`. */
function copyAllButton(total: number, inner: number): ErrorViewPlan['copyAll'] {
  if (total < 2) return undefined;
  const label = copyAllLabel(total);
  const x0 = INSET + BUTTON_W + BUTTON_GAP;
  const x1 = x0 + cellWidth(label) + 2;
  return x1 - INSET <= inner ? { label, x0, x1 } : undefined;
}

/** Lay the view out for a panel `width` wide and `rows` tall, rules included, with `total` errors open. */
export function planErrorView(error: DevError, meta: string, width: number, rows: number, offset: number, total = 1): ErrorViewPlan {
  const inner = Math.max(1, width - 4);
  const content = Math.max(0, rows - 2);
  const title = wrapLine(error.title, inner, '').slice(0, MAX_TITLE_ROWS);
  const lines = bodyLines(error, inner);
  // The boxed button and a gap under it while the body keeps at least a few rows; one line below that.
  const boxed = content - 1 - title.length - 4 >= 4;
  const buttonRows = boxed ? 3 : 1;
  const head = 1 + title.length + buttonRows + 1;
  const visible = Math.max(0, content - head);
  const maxOffset = Math.max(0, lines.length - visible);
  const from = Math.min(offset, maxOffset);
  const body = lines.slice(from, from + visible);
  return { meta, title, buttonRows, body, maxOffset, more: lines.length - from - body.length, buttonTop: 1 + title.length, copyAll: copyAllButton(total, inner) };
}

/** The copy buttons' cells for a view whose top rule is screen row `top`. */
export function errorViewRegions(plan: ErrorViewPlan, top: number): HitRegion[] {
  const out: HitRegion[] = [];
  for (let r = 0; r < plan.buttonRows; r++) {
    const y = top + 1 + plan.buttonTop + r;
    out.push({ y, x0: INSET, x1: INSET + BUTTON_W, hit: { kind: 'copy' } });
    if (plan.copyAll) out.push({ y, x0: plan.copyAll.x0, x1: plan.copyAll.x1, hit: { kind: 'copyAll' } });
  }
  return out;
}
