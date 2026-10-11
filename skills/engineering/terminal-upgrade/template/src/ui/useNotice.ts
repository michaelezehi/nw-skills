/**
 * Which notice card to show. A card follows the newest reload, push, error or recovery,
 * stays NOTICE_MS, and a new one appears at most once every NOTICE_GAP_MS: anything that
 * arrives sooner waits for the gap to pass, and only the newest of the waiting ones shows.
 */
import { useEffect, useRef, useState } from 'react';
import type { DevEvent } from '../types.ts';
import { NOTICE_GAP_MS, NOTICE_MS } from './theme.ts';
import { noticeFor, type NoticeData } from './Notice.tsx';

export function useNotice(events: readonly DevEvent[]): NoticeData | undefined {
  const [notice, setNotice] = useState<NoticeData | undefined>();
  const seen = useRef(events[events.length - 1]?.id ?? 0);
  const shownAt = useRef(-Infinity);
  const pending = useRef<NoticeData | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last || last.id <= seen.current) return;
    seen.current = last.id;
    const next = noticeFor(last);
    if (!next) return;
    const show = (data: NoticeData) => {
      shownAt.current = Date.now();
      setNotice(data);
    };
    const wait = shownAt.current + NOTICE_GAP_MS - Date.now();
    if (wait <= 0) {
      show(next);
      return;
    }
    pending.current = next;
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      if (pending.current) show(pending.current);
      pending.current = undefined;
    }, wait);
    timer.current.unref?.();
  }, [events]);

  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice((n) => (n?.id === notice.id ? undefined : n)), NOTICE_MS);
    return () => clearTimeout(hide);
  }, [notice]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return notice;
}

/**
 * A notice the deck raises itself (palette saved, copied), shown for NOTICE_MS and
 * replaced outright by the next one. It takes precedence over the event-driven card.
 */
export function useLocalNotice(): [NoticeData | undefined, (data: Omit<NoticeData, 'id' | 'at'>) => void] {
  const [notice, setNotice] = useState<NoticeData | undefined>();
  const seq = useRef(0);
  const show = (data: Omit<NoticeData, 'id' | 'at'>) => {
    seq.current += 1;
    setNotice({ ...data, id: -seq.current, at: Date.now() });
  };
  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice((n) => (n?.id === notice.id ? undefined : n)), NOTICE_MS);
    hide.unref?.();
    return () => clearTimeout(hide);
  }, [notice]);
  return [notice, show];
}
