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
  setProcess(serviceId: string, patch: Partial<Pick<ServiceState, 'pid' | 'status' | 'exitCode' | 'startedAt' | 'restarts' | 'detail'>>): void;
  addEvent(serviceId: string, event: Omit<DevEvent, 'id' | 'at' | 'service'>): void;
  addCall(call: Omit<ConvexCall, 'id'>): void;
  /** Per-service usage, and the hogs from the same scan when given. */
  setUsage(usage: Record<string, { memMb: number; cpu: number }>, hogs?: Hog[]): void;
  dismissError(id: number): void;
}

let seq = 0;
const nextId = (): number => ++seq;

const cap = <T>(list: T[], max: number): T[] => (list.length > max ? list.slice(list.length - max) : list);

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
  };
}

export function createDeckStore(configs: ServiceConfig[], meta: DeckMeta) {
  return createStore<DeckState>()((set) => ({
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
        let service: ServiceState = { ...current };
        let events = state.events;
        let errors = state.errors;
        const now = Date.now();

        for (const signal of signals) {
          switch (signal.type) {
            case 'status':
              service.status = signal.status;
              service.detail = signal.detail;
              if (signal.status === 'ready' && service.readyAt === undefined) service.readyAt = now;
              break;
            case 'meta':
              if (signal.runtime !== undefined) service.runtime = signal.runtime;
              if (signal.bootMs !== undefined) service.bootMs = signal.bootMs;
              if (signal.port !== undefined) service.port = signal.port;
              break;
            case 'event':
              events = [...events, { id: nextId(), at: now, service: serviceId, kind: signal.kind, text: signal.text, ms: signal.ms, status: signal.status }];
              break;
            case 'reload':
              service.lastReload = { at: now, route: signal.route, ms: signal.ms };
              service.reloads += 1;
              events = [...events, { id: nextId(), at: now, service: serviceId, kind: 'reload', text: signal.route ? `compiled ${signal.route}` : 'hot reload', ms: signal.ms }];
              break;
            case 'error':
              errors = [...errors, { id: nextId(), at: now, service: serviceId, title: signal.title, body: signal.body, file: signal.file }];
              events = [...events, { id: nextId(), at: now, service: serviceId, kind: 'error', text: signal.title }];
              service.status = 'error';
              break;
            case 'recovered': {
              const before = errors.length;
              errors = errors.filter((e) => e.service !== serviceId);
              if (errors.length !== before) {
                events = [...events, { id: nextId(), at: now, service: serviceId, kind: 'recovered', text: 'errors cleared' }];
              }
              if (service.status === 'error') service.status = 'ready';
              break;
            }
          }
        }

        return {
          services: { ...state.services, [serviceId]: service },
          events: cap(events, MAX_EVENTS),
          errors: cap(errors, MAX_ERRORS),
        };
      });
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
        events: cap([...state.events, { ...event, id: nextId(), at: Date.now(), service: serviceId }], MAX_EVENTS),
      }));
    },

    addCall(call) {
      set((state) => ({
        calls: cap([...state.calls, { ...call, id: nextId() }], MAX_CALLS),
        callCount: state.callCount + 1,
        callErrorCount: state.callErrorCount + (call.ok ? 0 : 1),
      }));
    },

    setUsage(usage, hogs) {
      set((state) => {
        // An unchanged hog list keeps its reference, so nothing that reads it re-renders.
        const nextHogs = hogs !== undefined && !sameHogs(state.hogs, hogs) ? { hogs } : {};
        const services = { ...state.services };
        for (const [id, u] of Object.entries(usage)) {
          const current = services[id];
          if (!current) continue;
          services[id] = {
            ...current,
            memMb: u.memMb,
            cpu: u.cpu,
            memHistory: cap([...current.memHistory, u.memMb], MEM_HISTORY),
          };
        }
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
