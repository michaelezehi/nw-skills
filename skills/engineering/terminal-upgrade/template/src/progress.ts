/**
 * How far along a build or deploy is, read from one line of its output. Next.js build
 * stages map to a fraction of the six it walks through; anything else needs a number in
 * the line: a percentage, `(12/40)`, `[3/9]` or Docker's `Step 3/9`. Pure.
 *
 * A BuildKit build counts steps per stage (`[deps 6/16]`, `[builder 30/31]`), so one line
 * alone says little: createProgressTracker sums every stage seen, and reads a step's own
 * output (a Next build inside `RUN pnpm build`) as progress within that step.
 */
import type { Progress } from './types.ts';

/** Next's build stages in order, and the label each shows. */
const NEXT_STAGES: [RegExp, string][] = [
  [/creating an optimized production build/i, 'building'],
  [/compiled successfully|compiled with warnings/i, 'compiled'],
  [/linting and checking validity of types|checking validity of types/i, 'checking types'],
  [/collecting page data/i, 'collecting page data'],
  [/generating static pages/i, 'generating static pages'],
  [/finalizing page optimization/i, 'finalizing'],
];

const PERCENT = /(?:^|[\s[(:])(\d{1,3}(?:\.\d+)?)\s?%(?!\w)/;
const BRACKETED = /[[(](?:[^\])]*?\s)?(\d{1,5})\s?\/\s?(\d{1,5})\s*[\])]/;
const STEP = /\bstep\s+(\d{1,5})\s*\/\s*(\d{1,5})\b/i;

const clampFraction = (n: number): number => Math.max(0, Math.min(1, n));

/** The line as a label: no bracketed counters, no percent, no Docker `#12` prefix, spaces squeezed. */
const label = (line: string): string =>
  line
    .replace(/^#\d+\s+/, '')
    .replace(BRACKETED, '')
    .replace(PERCENT, ' ')
    .replace(/[▕▏█▉▊▋▌▍▎░▒▓■□=>#-]{3,}/g, ' ')
    .replace(/[[(]\s*[\])]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function counted(done: number, total: number): number | undefined {
  return total > 0 && done <= total ? done / total : undefined;
}

export function parseProgress(line: string): Progress | undefined {
  const text = line.trim();
  if (text === '') return undefined;
  for (let i = 0; i < NEXT_STAGES.length; i++) {
    const [pattern, name] = NEXT_STAGES[i]!;
    if (!pattern.test(text)) continue;
    const m = BRACKETED.exec(text);
    const within = m ? (counted(Number(m[1]), Number(m[2])) ?? 0) : 0;
    const shown = m ? `${name} ${m[1]}/${m[2]}` : name;
    return { fraction: clampFraction((i + within) / NEXT_STAGES.length), label: shown };
  }
  const step = STEP.exec(text);
  if (step) {
    const fraction = counted(Number(step[1]), Number(step[2]));
    if (fraction !== undefined) return { fraction, label: `step ${step[1]}/${step[2]} ${label(text.replace(STEP, ''))}`.trim() };
  }
  const bracket = BRACKETED.exec(text);
  if (bracket) {
    const fraction = counted(Number(bracket[1]), Number(bracket[2]));
    if (fraction !== undefined) return { fraction, label: `${label(text)} ${bracket[1]}/${bracket[2]}`.trim() };
  }
  const percent = PERCENT.exec(text);
  if (percent) {
    const n = Number(percent[1]);
    if (n <= 100) return { fraction: n / 100, label: label(text) };
  }
  return undefined;
}

/** Worth a store update: a new label, or the bar moved at least one percent. */
export function progressMoved(prev: Progress | undefined, next: Progress): boolean {
  if (!prev || prev.label !== next.label) return true;
  return Math.round((prev.fraction ?? 0) * 100) !== Math.round((next.fraction ?? 0) * 100);
}

/** `=> CACHED [deps 6/16] COPY …`, `#14 [builder 30/31] RUN …`, `[runner 2/9] WORKDIR /app`. */
const BUILDKIT = /^(?:#\d+\s+)?(?:=>\s+)?(CACHED\s+)?\[([\w.-]+)\s+(\d{1,4})\/(\d{1,4})\]\s*(.*)$/;
/** A BuildKit step that printed its time is finished: `… 0.0s`, `#14 DONE 918.2s`. */
const FINISHED = /\s\d+(?:\.\d+)?s$/;
/** A step's own output, nested under it: `=> => # Creating …`, `#14 12.3 Creating …`. */
const NESTED = /^(?:=>\s*=>\s*#?\s*|#\d+\s+\d+(?:\.\d+)?\s+)/;

export interface ProgressTracker {
  /** The progress after this line, or undefined when it says nothing new. */
  feed(line: string): Progress | undefined;
}

/** Progress across a whole command's output; one per run. */
export function createProgressTracker(): ProgressTracker {
  const stages = new Map<string, { done: number; total: number }>();
  let step: { stage: string; n: number; total: number; text: string } | undefined;
  let inner: Progress | undefined;

  const snapshot = (): Progress => {
    let done = 0;
    let total = 0;
    for (const s of stages.values()) {
      done += s.done;
      total += s.total;
    }
    const running = step && (stages.get(step.stage)?.done ?? 0) < step.n;
    const within = running ? (inner?.fraction ?? 0) : 0;
    const where = step ? `${step.stage} ${step.n}/${step.total}` : '';
    const what = running && inner ? inner.label : (step?.text ?? '');
    return { fraction: clampFraction((done + within) / Math.max(1, total)), label: [where, what].filter(Boolean).join(' · '), left: total - done };
  };

  return {
    feed(line) {
      const text = line.trim();
      if (text === '') return undefined;
      const m = BUILDKIT.exec(text);
      if (m) {
        const [, cached, stage, nText, totalText, rest] = m;
        const n = Number(nText);
        const total = Number(totalText);
        if (n > total) return undefined;
        const s = stages.get(stage!) ?? { done: 0, total };
        s.total = total;
        s.done = Math.max(s.done, cached || FINISHED.test(rest!) ? n : n - 1);
        stages.set(stage!, s);
        if (!step || step.stage !== stage || step.n !== n) inner = undefined;
        step = { stage: stage!, n, total, text: label(rest!.replace(FINISHED, '')) };
        return snapshot();
      }
      if (stages.size === 0) return parseProgress(text);
      if (/^#\d+\s+DONE\b/.test(text) && step) {
        const s = stages.get(step.stage);
        if (s) s.done = Math.max(s.done, step.n);
        return snapshot();
      }
      if (!NESTED.test(text) || !step) return undefined;
      const nested = parseProgress(text.replace(NESTED, ''));
      if (!nested) return undefined;
      inner = nested;
      return snapshot();
    },
  };
}
