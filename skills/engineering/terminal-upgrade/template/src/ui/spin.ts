/**
 * Which services still spin. A starting or compiling spinner runs for SPIN_MAX_MS from the
 * moment the service entered that status (its startedAt for a start), then rests on a
 * static glyph, so a service that never prints ready does not keep the frame clock running.
 */
import { useRef } from 'react';
import type { ServiceState, ServiceStatus } from '../types.ts';
import { SPIN_MAX_MS } from './sprites.ts';

interface Since {
  status: ServiceStatus;
  at: number;
}

export function useSpinning(services: readonly ServiceState[], now: number): ReadonlySet<string> {
  const since = useRef(new Map<string, Since>());
  const last = useRef<ReadonlySet<string>>(new Set());
  const spinning = new Set<string>();
  for (const service of services) {
    if (service.status !== 'starting' && service.status !== 'compiling') {
      since.current.delete(service.id);
      continue;
    }
    let entry = since.current.get(service.id);
    if (!entry || entry.status !== service.status) {
      entry = { status: service.status, at: service.status === 'starting' ? (service.startedAt ?? now) : now };
      since.current.set(service.id, entry);
    }
    if (now - entry.at < SPIN_MAX_MS) spinning.add(service.id);
  }
  // The same members keep the same set, so memoised grids see no change.
  if (spinning.size === last.current.size && [...spinning].every((id) => last.current.has(id))) return last.current;
  last.current = spinning;
  return spinning;
}
