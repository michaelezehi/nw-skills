import { alreadyRunning } from './ipc.ts';
import { cleanupLeftovers } from './pidfile.ts';

export type StartCheck = { blocked: string } | { blocked?: undefined; cleaned: number };

/**
 * Runs before anything is spawned. A live devdeck in this repo blocks the start (and its
 * servers are left alone); otherwise servers a previous run left behind are killed first.
 */
export async function prepareStart(root: string, graceMs?: number): Promise<StartCheck> {
  const blocked = await alreadyRunning(root);
  if (blocked) return { blocked };
  return { cleaned: await cleanupLeftovers(root, graceMs) };
}

export const cleanedText = (n: number): string => `cleaned up ${n} ${n === 1 ? 'server' : 'servers'} left by a previous run`;
