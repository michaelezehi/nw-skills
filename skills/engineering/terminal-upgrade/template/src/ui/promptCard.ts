/**
 * The prompt card's rows and clickable cells, worked out without React so both are tested.
 * The card sits at the bottom of the region under the service cards while a command waits:
 * the question, then its answer row (buttons, the options of a list, or a field to type in).
 * When rows run short it gives up the button row under a field, then the question.
 */
import type { Prompt } from '../types.ts';
import { cellWidth, truncateEnd } from './format.ts';
import type { HitRegion } from './hogPlan.ts';

/** What the person has done in the card so far: typed text, and the highlighted choice or button. */
export interface PromptInput {
  typed: string;
  selected: number;
}

export interface PromptButton {
  label: string;
  /** What a click answers: 0 yes or send or continue, 1 no; in a list, the option index. */
  index: number;
  /** Cell offset inside the card's body. */
  x: number;
  /** Drawn filled: the default, or the one the arrows are on. */
  filled: boolean;
}

export type PromptLine =
  | { kind: 'question'; text: string }
  | { kind: 'buttons'; buttons: PromptButton[] }
  | { kind: 'option'; text: string; index: number; selected: boolean }
  | { kind: 'field'; text: string };

export interface PromptPlan {
  title: string;
  /** Rows including both rules. */
  rows: number;
  lines: PromptLine[];
}

const TITLES: Record<Prompt['kind'], string> = {
  secret: 'PASSWORD',
  confirm: 'CONFIRM',
  choice: 'CHOOSE',
  text: 'INPUT',
  continue: 'CONTINUE',
};

/** Body cells between the card's side borders and padding. */
export const CARD_INSET = 2;
/** Most list options shown at once; the arrows scroll the rest into view. */
const MAX_OPTIONS = 6;

/** The highlight a fresh prompt starts on: the list's own, else yes unless the default is no. */
export function initialSelection(prompt: Prompt): number {
  if (prompt.kind === 'choice') return prompt.current;
  if (prompt.kind === 'confirm') return prompt.default === 'no' ? 1 : 0;
  return 0;
}

function buttons(labels: string[], selected: number): PromptButton[] {
  let x = 0;
  return labels.map((label, index) => {
    const text = `[ ${label} ]`;
    const button = { label: text, index, x, filled: index === selected };
    x += cellWidth(text) + 2;
    return button;
  });
}

/** The field's text: what was typed, masked for a password, with a fixed cursor block. */
export function fieldText(prompt: Prompt, typed: string, room: number): string {
  const shown = prompt.kind === 'secret' ? '•'.repeat([...typed].length) : typed;
  const line = `› ${shown}▌`;
  // Keep the end in view: the newest characters are the ones being typed.
  return cellWidth(line) <= room ? line : `› …${shown.slice(-(room - 4))}▌`;
}

/** The card for `prompt` in `width` cells and at most `maxRows` rows, or undefined when under three. */
export function planPrompt(prompt: Prompt, input: PromptInput, width: number, maxRows: number): PromptPlan | undefined {
  if (maxRows < 3 || width < 16) return undefined;
  const room = Math.max(1, width - CARD_INSET * 2);
  const question: PromptLine = { kind: 'question', text: truncateEnd(prompt.question, room) };
  const body: PromptLine[] = [];
  const budget = maxRows - 2;

  if (prompt.kind === 'choice') {
    const shown = Math.max(1, Math.min(prompt.options.length, MAX_OPTIONS, budget - 1));
    const start = Math.max(0, Math.min(input.selected - Math.floor(shown / 2), prompt.options.length - shown));
    const options: PromptLine[] = prompt.options.slice(start, start + shown).map((text, i) => ({
      kind: 'option',
      text: truncateEnd(text, room - 2),
      index: start + i,
      selected: start + i === input.selected,
    }));
    body.push(...(budget > shown ? [question] : []), ...options);
  } else if (prompt.kind === 'text' || prompt.kind === 'secret') {
    const field: PromptLine = { kind: 'field', text: fieldText(prompt, input.typed, room) };
    const send: PromptLine = { kind: 'buttons', buttons: buttons(['Send'], 0) };
    body.push(...(budget >= 3 ? [question, field, send] : budget === 2 ? [question, field] : [field]));
  } else {
    const labels = prompt.kind === 'confirm' ? ['Yes', 'No'] : ['Continue'];
    const row: PromptLine = { kind: 'buttons', buttons: buttons(labels, prompt.kind === 'confirm' ? input.selected : 0) };
    body.push(...(budget >= 2 ? [question] : []), row);
  }
  return { title: TITLES[prompt.kind], rows: body.length + 2, lines: body };
}

/** Clickable cells of a card whose top rule is screen row `top`, as prompt hits. */
export function promptRegions(plan: PromptPlan, top: number, width: number): HitRegion[] {
  const out: HitRegion[] = [];
  plan.lines.forEach((line, i) => {
    const y = top + 1 + i;
    if (line.kind === 'buttons') {
      for (const b of line.buttons) out.push({ y, x0: CARD_INSET + b.x, x1: CARD_INSET + b.x + cellWidth(b.label), hit: { kind: 'prompt', index: b.index } });
    } else if (line.kind === 'option') {
      out.push({ y, x0: CARD_INSET, x1: width - CARD_INSET, hit: { kind: 'prompt', index: line.index } });
    }
  });
  return out;
}
