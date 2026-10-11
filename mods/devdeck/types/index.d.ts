// The trimmed Devdeck snapshot the mod keeps in plugin state. The source shape
// is DeckSnapshot in founder-x packages/devdeck/src/types.ts.

export type ServiceStatus = 'starting' | 'ready' | 'compiling' | 'error' | 'stopped' | 'crashed'

export type Svc = {
  id: string
  label: string
  kind: string
  port: number | null
  status: ServiceStatus
  memMb: number
  reloadAt: number | null
  reloadRoute: string | null
  reloadMs: number | null
}

export type Ev = { id: number; at: number; service: string; kind: string; text: string; ms: number | null }

export type Call = { id: number; at: number; type: string; fn: string; ms: number; ok: boolean; error: string | null }

export type Err = { id: number; at: number; service: string; title: string; body: string[]; file: string | null }

export type Snap = {
  /** `$.clock.now()` when this snapshot arrived. */
  fetchedAt: number
  /** Devdeck's own clock when it wrote the snapshot. */
  now: number
  root: string
  services: Svc[]
  events: Ev[]
  calls: Call[]
  errors: Err[]
  /** Every open error Devdeck holds (`totals.errors`); `errors` keeps only the latest few. */
  errorCount: number
  memMb: number
}

export type ActivityKind = 'reload' | 'mutation' | 'error'

export type Activity = { kind: ActivityKind; at: number }

/** The palette picked in Devdeck (its theme.json `colors`), every token `#rrggbb`. */
export type Palette = {
  /** Ready dots, the DEV label, mutation badges. */
  accent: string
  /** Compiling and starting, the reload bolt. */
  activity: string
  /** Main text. */
  text: string
  /** Labels, ports, ages, memory. */
  muted: string
  line: string
  /** Errors and failed calls. */
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    devdeck: {
      snap: Snap | null
      /** Error ids expanded in the pane. */
      expanded: number[]
      /** `$.clock.now()` at the last tick, so a stale snapshot hides. */
      clock: number
      /** The sprite's animation frame, ticking only while it animates. */
      frame: number
      activity: Activity | null
      /** Read at session start, then at most every 10s by the poll loop. */
      palette: Palette
    }
  }
}
