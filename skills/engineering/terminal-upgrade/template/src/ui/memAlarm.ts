/**
 * When memory is trouble. One server is in trouble once it holds a quarter of the
 * machine's RAM, capped at 4 GB: a Next dev server past that is leaking, and a restart
 * gives it back. The deck as a whole is in trouble at 90% of the machine.
 */
import os from 'node:os';
import { formatMb } from './format.ts';

const MACHINE_MB = Math.max(1024, Math.round(os.totalmem() / 1024 / 1024));

export const SERVER_ALARM_MB = Math.min(4096, Math.round(MACHINE_MB / 4));
export const MACHINE_ALARM_PERCENT = 90;

export function serverInTrouble(memMb: number, limitMb = SERVER_ALARM_MB): boolean {
  return memMb >= limitMb;
}

/** The gloss under a card's memory row, longest first. */
export function memoryGlosses(memMb: number, limitMb = SERVER_ALARM_MB): readonly string[] {
  if (!serverInTrouble(memMb, limitMb)) return CALM_GLOSSES;
  const over = formatMb(limitMb);
  return [`past ${over}, likely a leak · press r to restart`, `past ${over} · press r to restart`, 'press r to restart', 'restart with r'];
}

const CALM_GLOSSES = [
  'this server plus every process it started',
  'the server plus processes it started',
  'server + the processes it started',
  'server + its child processes',
  'with its child processes',
  'with child processes',
  'incl. children',
] as const;
