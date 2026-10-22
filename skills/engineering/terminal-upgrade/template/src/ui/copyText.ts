/** What `y` and `Y` put on the clipboard: plain text, untruncated, no escapes. */
import type { DevError } from '../types.ts';
import { formatClockSeconds } from './format.ts';

export interface CopyPayload {
  text: string;
  /** For the notice: "admin error", "admin log", "3 errors". */
  what: string;
  lines: number;
}

/** `service · title · time`, then the whole body. */
export function errorText(error: DevError): string {
  return [`${error.service} · ${error.title} · ${formatClockSeconds(error.at)}`, ...error.body].join('\n');
}

export function errorPayload(error: DevError): CopyPayload {
  const text = errorText(error);
  return { text, what: `${error.service} error`, lines: text.split('\n').length };
}

/** Where the errors come from: the deck's title and repo root, for the header line. */
export interface CopyContext {
  title?: string;
  root: string;
}

/**
 * Every open error, ready to paste into a coding agent: a header naming the deck, root and
 * count, then each error oldest first, numbered, with its whole body, a blank line between.
 */
export function allErrorsPayload(errors: readonly DevError[], context: CopyContext): CopyPayload | undefined {
  if (errors.length === 0) return undefined;
  const noun = errors.length === 1 ? 'error' : 'errors';
  const header = ['Devdeck', context.title, context.root, `${errors.length} open ${noun}`].filter(Boolean).join(' · ');
  const text = [header, ...errors.map((error, i) => `${i + 1}. ${errorText(error)}`)].join('\n\n');
  return { text, what: `${errors.length} ${noun}`, lines: text.split('\n').length };
}

/** The log lines on screen for `service`. */
export function logPayload(service: string, lines: readonly string[]): CopyPayload | undefined {
  if (lines.length === 0) return undefined;
  return { text: lines.join('\n'), what: `${service} log`, lines: lines.length };
}

export const copiedNotice = (payload: CopyPayload): string => `Copied · ${payload.what} · ${payload.lines} line${payload.lines === 1 ? '' : 's'}`;
export const COPY_FAILED = 'Copy failed, nothing on the clipboard';
