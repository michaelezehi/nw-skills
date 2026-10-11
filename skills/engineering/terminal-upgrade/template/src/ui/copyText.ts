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

/** Every open error, oldest first, separated by a blank line. */
export function allErrorsPayload(errors: readonly DevError[]): CopyPayload | undefined {
  if (errors.length === 0) return undefined;
  const text = errors.map(errorText).join('\n\n');
  return { text, what: `${errors.length} error${errors.length === 1 ? '' : 's'}`, lines: text.split('\n').length };
}

/** The log lines on screen for `service`. */
export function logPayload(service: string, lines: readonly string[]): CopyPayload | undefined {
  if (lines.length === 0) return undefined;
  return { text: lines.join('\n'), what: `${service} log`, lines: lines.length };
}

export const copiedNotice = (payload: CopyPayload): string => `Copied · ${payload.what} · ${payload.lines} line${payload.lines === 1 ? '' : 's'}`;
export const COPY_FAILED = 'Copy failed, nothing on the clipboard';
