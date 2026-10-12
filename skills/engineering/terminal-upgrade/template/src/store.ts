import { createStore } from 'zustand/vanilla';
import { sameHogs } from './sampler.ts';
import type {
  ConvexCall,
  DeckMeta,
  DeckSnapshot,
  DevError,
  DevEvent,
  Hog,
  ServiceConfig,
  ServiceState,
  Signal,
} from './types.ts';

export const MAX_EVENTS = 300;
export const MAX_ERRORS = 50;
export const MAX_CALLS = 300;
export const MEM_HISTORY = 60;

export interface DeckState {
  meta: DeckMeta;
  order: string[];
  services: Record<string, ServiceState>;
  events: DevEvent[];
  errors: DevError[];
  calls: ConvexCall[];
  callCount: number;
  callErrorCount: number;
  /** Largest memory and cpu holders on the machine; replaced only when the list changes. */
  hogs: Hog[];

  apply(serviceId: string, signals: Signal[]): void;
  /** A card added while the deck runs, last in order. A known id is left as it is. */
  addService(config: ServiceConfig): void;
  setProcess(serviceId: string, patch: Partial<Pick<ServiceState, 'pid' | 'status' | 'exitCode' | 'startedAt' | 'restarts' | 'detail' | 'prompt' | 'progress'>>): void;
  addEvent(serviceId: string, event: Omit<DevEvent, 'id' | 'at' | 'service'>): void;
  addCall(call: Omit<ConvexCall, 'id'>): void;
  /** Several calls in one store update, as a feed chunk brings them. */
  addCalls(calls: readonly Omit<ConvexCall, 'id'>[]): void;
  /** Per-service usage, and the hogs from the same scan when given. */
  setUsage(usage: Record<string, { memMb: number; cpu: number }>, hogs?: Hog[]): void;
  dismissError(id: number): void;
}

let seq = 0;
const nextId = (): number => ++seq;

const cap = <T>(list: T[], max: number): T[] => (list.length > max ? list.slice(list.length - max) : list);

/** `list` then `items`, keeping the newest `max`, in one new array. */
function append<T>(list: readonly T[], items: readonly T[], max: number): T[] {
  if (items.length >= max) return items.slice(items.length - max);
  const keep = max - items.length;
  const head = list.length > keep ? list.slice(list.length - keep) : list;
  return head.concat(items);
}

function initialService(config: ServiceConfig): ServiceState {
  return {
    id: config.id,
    label: config.label,
    kind: config.kind,
    port: config.port,
    url: config.url,
    status: 'starting',
    reloads: 0,
    memMb: 0,
    cpu: 0,
    memHistory: [],
    restarts: 0,
    ...(config.pty ? { oneShot: true } : {}),
  };
}

/** True when the history is full and every sample in it is `value`; appending would change nothing. */
function flatAt(history: readonly number[], value: number): boolean {
  if (history.length < MEM_HISTORY) return false;
  for (const v of history) if (v !== value) return false;
  return true;
}

export function createDeckStore(configs: ServiceConfig[], meta: DeckMeta) {
  return createStore<DeckState>()((set, get) => ({
    meta,
    order: configs.map((c) => c.id),
    services: Object.fromEntries(configs.map((c) => [c.id, initialService(c)])),
    events: [],
    errors: [],
    calls: [],
    callCount: 0,
    callErrorCount: 0,
    hogs: [],

    apply(serviceId, signals) {
      if (signals.length === 0) return;
      set((state) => {
        const current = state.services[serviceId];
        if (!current) return state;
        // The service is copied only on its first real change, so a run of log events
        // leaves the service object, and every card that reads it, as it was.
        let service = current;
        const edit = (): ServiceState => (service === current ? (service = { ...current }) : service);
        // New events gather here and join the list once, in one copy.
        const added: DevEvent[] = [];
        let errors = state.errors;
        const now = Date.now();

        for (const signal of signals) {
          switch (signal.type) {
            case 'status':
              if (service.status !== signal.status || service.detail !== signal.detail) {
                edit().status = signal.status;
                service.detail = signal.detail;
              }
              if (signal.status === 'ready' && service.readyAt === undefined) edit().readyAt = now;
              break;
            case 'meta':
              if (signal.runtime !== undefined && signal.runtime !== service.runtime) edit().runtime = signal.runtime;
              if (signal.bootMs !== undefined && signal.bootMs !== service.bootMs) edit().bootMs = signal.bootMs;
              if (signal.port !== undefined && signal.port !== service.port) edit().port = signal.port;
              break;
            case 'event':
              added.push({ id: nextId(), at: now, service: serviceId, kind: signal.kind, text: signal.text, ms: signal.ms, status: signal.status });
              break;
            case 'reload':
              edit().lastReload = { at: now, route: signal.route, ms: signal.ms };
              service.reloads += 1;
              added.push({ id: nextId(), at: now, service: serviceId, kind: 'reload', text: signal.route ? `compiled ${signal.route}` : 'hot reload', ms: signal.ms });
              break;
            case 'error':
              errors = [...errors, { id: nextId(), at: now, service: serviceId, title: signal.title, body: signal.body, file: signal.file }];
              added.push({ id: nextId(), at: now, service: serviceId, kind: 'error', text: signal.title });
              if (service.status !== 'error') edit().status = 'error';
              break;
            case 'recovered': {
              const kept = errors.filter((e) => e.service !== serviceId);
              if (kept.length !== errors.length) {
                errors = kept;
                added.push({ id: nextId(), at: now, service: serviceId, kind: 'recovered', text: 'errors cleared' });
              }
              if (service.status === 'error') edit().status = 'ready';
              break;
            }
          }
        }

        return {
          services: service === current ? state.services : { ...state.services, [serviceId]: service },
          events: added.length > 0 ? append(state.events, added, MAX_EVENTS) : state.events,
          errors: cap(errors, MAX_ERRORS),
        };
      });
    },

    addService(config) {
      set((state) => (state.services[config.id] ? state : { order: [...state.order, config.id], services: { ...state.services, [config.id]: initialService(config) } }));
    },

    setProcess(serviceId, patch) {
      set((state) => {
        const current = state.services[serviceId];
        if (!current) return state;
        return { services: { ...state.services, [serviceId]: { ...current, ...patch } } };
      });
    },

    addEvent(serviceId, event) {
      set((state) => ({
        events: append(state.events, [{ ...event, id: nextId(), at: Date.now(), service: serviceId }], MAX_EVENTS),
      }));
    },

    addCall(call) {
      get().addCalls([call]);
    },

    addCalls(calls) {
      if (calls.length === 0) return;
      let failed = 0;
      for (const call of calls) if (!call.ok) failed += 1;
      set((state) => ({
        calls: append(state.calls, calls.map((call) => ({ ...call, id: nextId() })), MAX_CALLS),
        callCount: state.callCount + calls.length,
        callErrorCount: state.callErrorCount + failed,
      }));
    },

    setUsage(usage, hogs) {
      set((state) => {
        // An unchanged hog list keeps its reference, so nothing that reads it re-renders.
        const nextHogs = hogs !== undefined && !sameHogs(state.hogs, hogs) ? { hogs } : {};
        let services = state.services;
        for (const [id, u] of Object.entries(usage)) {
          const current = state.services[id];
          if (!current) continue;
          // A sample that would change nothing (same numbers, and a full history that
          // already reads that value throughout) keeps the service object.
          if (current.memMb === u.memMb && current.cpu === u.cpu && flatAt(current.memHistory, u.memMb)) continue;
          if (services === state.services) services = { ...state.services };
          const history = current.memHistory.length >= MEM_HISTORY ? current.memHistory.slice(1 - MEM_HISTORY) : current.memHistory.slice();
          history.push(u.memMb);
          services[id] = { ...current, memMb: u.memMb, cpu: u.cpu, memHistory: history };
        }
        // Returning the state itself skips the store's notify, so a still tick costs nothing.
        if (services === state.services) return 'hogs' in nextHogs ? nextHogs : state;
        return { services, ...nextHogs };
      });
    },

    dismissError(id) {
      set((state) => ({ errors: state.errors.filter((e) => e.id !== id) }));
    },
  }));
}

export type DeckStore = ReturnType<typeof createDeckStore>;

/** Bounded JSON view for the IPC socket and the Claude mod. */
export function toSnapshot(state: DeckState, limit = 20): DeckSnapshot {
  const services = state.order.map((id) => state.services[id]!).filter(Boolean);
  return {
    version: 1,
    now: Date.now(),
    meta: state.meta,
    services,
    events: state.events.slice(-limit),
    errors: state.errors.slice(-limit),
    calls: state.calls.slice(-limit),
    hogs: state.hogs,
    totals: {
      memMb: Math.round(services.reduce((sum, s) => sum + s.memMb, 0)),
      cpu: Math.round(services.reduce((sum, s) => sum + s.cpu, 0)),
      calls: state.callCount,
      callErrors: state.callErrorCount,
      errors: state.errors.length,
    },
  };
}
