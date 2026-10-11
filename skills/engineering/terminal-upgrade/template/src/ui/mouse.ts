/**
 * Mouse clicks without Ink's help. The deck asks the terminal for xterm SGR mouse
 * reports (ESC[?1000h, ESC[?1006h) while it is mounted and turns them off again on
 * unmount and on process exit, so a shell is never left in mouse mode. A press arrives
 * on stdin as ESC[<b;x;yM (release ends in m); Ink hands it to useInput as one input
 * with the ESC already stripped. Hit testing is against regions the layout computed.
 */
import type { HitRegion, HogHit } from './hogPlan.ts';

export const MOUSE_ON = '\u001b[?1000h\u001b[?1006h';
export const MOUSE_OFF = '\u001b[?1006l\u001b[?1000l';

export interface MouseEvent {
  /** 0 left, 1 middle, 2 right, 64 and 65 the wheel; modifier bits removed. */
  button: number;
  /** 0-based screen column and row. */
  x: number;
  y: number;
  press: boolean;
}

const SGR = /^\u001b?\[<(\d+);(\d+);(\d+)([Mm])$/;

/** An SGR mouse report, with or without its ESC, or undefined for anything else. */
export function parseMouse(input: string): MouseEvent | undefined {
  const m = SGR.exec(input);
  if (!m) return undefined;
  const code = Number(m[1]);
  // Bits 2 to 4 are shift, meta and ctrl; bit 5 is motion.
  const button = code & ~(4 | 8 | 16 | 32);
  return { button, x: Number(m[2]) - 1, y: Number(m[3]) - 1, press: m[4] === 'M' };
}

/** A left-button press, the only report the deck acts on. */
export function isClick(event: MouseEvent): boolean {
  return event.press && event.button === 0;
}

/** The first region under the cell; earlier regions win, so buttons sit before their row. */
export function hitTest(regions: readonly HitRegion[], x: number, y: number): HogHit | undefined {
  return regions.find((r) => r.y === y && x >= r.x0 && x < r.x1)?.hit;
}

interface Writable {
  write(data: string): unknown;
}

/**
 * Turn mouse reports on for `stdout` and return the undo. The undo also runs on process
 * exit, which covers the paths that exit without unmounting (a second Ctrl-C). Idempotent.
 */
export function enableMouse(stdout: Writable, proc: Pick<NodeJS.Process, 'once' | 'removeListener'> = process): () => void {
  let on = true;
  const off = (): void => {
    if (!on) return;
    on = false;
    proc.removeListener('exit', off);
    try {
      stdout.write(MOUSE_OFF);
    } catch {
      // The terminal is gone; nothing left to reset.
    }
  };
  stdout.write(MOUSE_ON);
  proc.once('exit', off);
  return off;
}
