/**
 * Is the command waiting for an answer? Read when its output has gone quiet: `partial` is
 * the line it printed without a newline (where a prompt leaves the cursor), `tail` the
 * last complete lines before it, ANSI already stripped. Pure, so every shape is tested.
 */
import type { Prompt } from './types.ts';

const SECRET = /(?:password|passphrase|passcode|\bpin\b|token|secret|one[- ]time code|otp|2fa|verification code)[^\n]{0,60}[:?]\s*$/i;
const CONFIRM = /[[(]\s*(y(?:es)?)\s*\/\s*(n(?:o)?)\b[^\])]*[\])]/i;
const CONTINUE = /\bpress (?:enter|return|any key)\b/i;
/** A line that is surely log output, not a question, even when it ends in a colon. */
const LOG_LINE = /^\s*(?:\[?\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|(?:info|warn|warning|error|debug|trace|log)\b)/i;
/** Inquirer and similar draw the question with a leading `?`; clack with a diamond. */
const QUESTION = /^\s*(?:[?◆◇]\s+|\S.*\(use arrow keys\))/i;
/** The highlighted option of an arrow-key list, and an option that is not. */
const CURRENT = /^\s*(?:│\s*)?[❯›>▸●◉]\s+(.*\S)\s*$/;
const OTHER = /^\s*(?:│\s*)?(?:[○◯◯]\s+)?(.*\S)\s*$/;

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

function confirmPrompt(line: string): Prompt | undefined {
  const m = CONFIRM.exec(line);
  if (!m) return undefined;
  const [y, n] = [m[1] ?? 'y', m[2] ?? 'n'];
  const yesDefault = y[0] === 'Y' && n[0] === 'n';
  const noDefault = n[0] === 'N' && y[0] === 'y';
  const question = clean(line.slice(0, m.index)) || clean(line);
  return {
    kind: 'confirm',
    question,
    yes: y.length > 1 ? 'yes' : 'y',
    no: n.length > 1 ? 'no' : 'n',
    ...(yesDefault ? { default: 'yes' as const } : noDefault ? { default: 'no' as const } : {}),
  };
}

/** The last arrow-key list on screen: a question line, then two or more options, one highlighted. */
function choicePrompt(lines: readonly string[]): Prompt | undefined {
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (QUESTION.test(lines[i] ?? '')) {
      start = i;
      break;
    }
  }
  if (start < 0) return undefined;
  const options: string[] = [];
  let current = -1;
  for (const line of lines.slice(start + 1)) {
    if (/^\s*└/.test(line) || line.trim() === '' || /^\s*│\s*$/.test(line)) continue;
    const hit = CURRENT.exec(line);
    if (hit) {
      current = options.length;
      options.push(clean(hit[1] ?? ''));
      continue;
    }
    const other = OTHER.exec(line);
    if (other) options.push(clean(other[1] ?? ''));
  }
  if (options.length < 2 || current < 0) return undefined;
  const question = clean((lines[start] ?? '').replace(/^\s*[?◆◇]\s+/, '').replace(/\(use arrow keys\)/i, ''));
  return { kind: 'choice', question, options, current };
}

export function detectPrompt(tail: readonly string[], partial: string): Prompt | undefined {
  const line = partial.replace(/\s+$/, ' ');
  if (line.trim() !== '') {
    if (SECRET.test(line)) return { kind: 'secret', question: clean(line) };
    const confirm = confirmPrompt(line);
    if (confirm) return confirm;
  }
  const choice = choicePrompt([...tail.slice(-20), partial]);
  if (choice) return choice;
  if (line.trim() === '') return undefined;
  if (CONTINUE.test(line)) return { kind: 'continue', question: clean(line) };
  const text = clean(line);
  if (/[?:>]$/.test(text) && text.length <= 160 && /[a-z]/i.test(text) && !LOG_LINE.test(text) && !/https?:\/\/\S+$/.test(text)) {
    return { kind: 'text', question: text.replace(/^\?\s+/, '') };
  }
  return undefined;
}

/** The bytes that pick `index` in a list whose highlight is on `current`: arrows, then Enter. */
export function choiceKeys(current: number, index: number): string {
  const step = index - current;
  return (step > 0 ? '\u001b[B'.repeat(step) : '\u001b[A'.repeat(-step)) + '\r';
}

/** Two prompts are the same when nothing the card shows differs. */
export const samePrompt = (a: Prompt | undefined, b: Prompt | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);
