/**
 * The two-step stop for memory hogs, shared by the keys and the mouse. The first `s` or
 * click on Stop arms that hog and the button turns into `[ Stop? ]`; a second one within
 * ARM_MS calls controls.killPid and raises a notice with the result. `S` and the
 * panel's Stop all orphans button do the same for every orphan at once. Anything else
 * the user does disarms it.
 */
import { useRef, useState } from 'react';
import type { DeckControls, Hog, KillResult } from '../types.ts';
import type { NoticeData } from './Notice.tsx';
import { useWakeAt } from './useFrame.ts';
import { killNotice, orphansNotice } from './hogCopy.ts';
import type { Armed } from './hogPlan.ts';

/** How long a first press waits for its second. */
export const ARM_MS = 3000;

type ShowNotice = (data: Omit<NoticeData, 'id' | 'at'>) => void;

export interface HogActions {
  /** The pending stop, while it is still live. */
  armed?: Armed;
  stop(hog: Hog | undefined): void;
  stopOrphans(): void;
  disarm(): void;
}

export function useHogs(hogs: readonly Hog[], controls: DeckControls, showNotice: ShowNotice, now: number): HogActions {
  const [pending, setPendingState] = useState<{ armed: Armed; at: number } | undefined>();
  // The ref answers a second press that lands before React re-renders from the first.
  const latest = useRef(pending);
  const setPending = (next: { armed: Armed; at: number } | undefined) => {
    latest.current = next;
    setPendingState(next);
  };
  const live = pending && now - pending.at < ARM_MS ? pending.armed : undefined;
  // One re-render when the window closes, so the button turns back without a clock.
  useWakeAt(pending ? pending.at + ARM_MS : undefined);

  // Checked again at the press, not only at the last render: the window may have closed since.
  const armedNow = (): Armed | undefined => {
    const p = latest.current;
    return p && Date.now() - p.at < ARM_MS ? p.armed : undefined;
  };
  const report = ({ ok, text }: { ok: boolean; text: string }) => showNotice({ kind: ok ? 'stopped' : 'failed', service: '', text });

  const stop = (hog: Hog | undefined) => {
    if (!hog) return;
    if (hog.self) {
      setPending(undefined);
      return showNotice({ kind: 'failed', service: '', text: 'devdeck cannot stop itself, q quits it' });
    }
    if (armedNow()?.target === hog.pid) {
      setPending(undefined);
      void controls.killPid(hog.pid).then((result) => report(killNotice(hog, result)));
      return;
    }
    setPending({ armed: { target: hog.pid }, at: Date.now() });
  };

  const stopOrphans = () => {
    const orphans = hogs.filter((h) => h.orphan);
    if (orphans.length === 0) return;
    if (armedNow()?.target === 'orphans') {
      setPending(undefined);
      void Promise.all(orphans.map((h) => controls.killPid(h.pid).catch((): KillResult => 'denied'))).then((results) => report(orphansNotice(orphans, results)));
      return;
    }
    setPending({ armed: { target: 'orphans' }, at: Date.now() });
  };

  const disarm = () => {
    if (latest.current) setPending(undefined);
  };

  return { armed: live, stop, stopOrphans, disarm };
}
