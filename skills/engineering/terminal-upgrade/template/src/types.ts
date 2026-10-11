/** Shared contracts. Supervisor, parsers, UI, IPC and the Claude mod all read these shapes. */

export type ServiceKind = 'next' | 'convex' | 'node' | 'watch' | 'vite';

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

export interface ServiceConfig {
  id: string;
  label: string;
  /** Package directory relative to the repo root. */
  dir: string;
  kind: ServiceKind;
  port?: number;
  url?: string;
  /** argv run in `dir`, no shell. Default: [packageManager, 'run', 'dev']. */
  command?: string[];
}

/** The default export of devdeck.config.ts, which sits in the devdeck package dir. */
export interface DeckConfig {
  /** Header text, shown as `<title> · DEV`. */
  title: string;
  /** Repo root, relative to the config file. */
  root: string;
  packageManager: PackageManager;
  /** Every long-running dev process, in display order. */
  services: ServiceConfig[];
}

export type ServiceStatus = 'starting' | 'ready' | 'compiling' | 'error' | 'stopped' | 'crashed';

export interface Reload {
  at: number;
  route?: string;
  ms?: number;
}

export interface ServiceState {
  id: string;
  label: string;
  kind: ServiceKind;
  port?: number;
  url?: string;
  status: ServiceStatus;
  /** Short context for the status, e.g. the route being compiled. */
  detail?: string;
  /** e.g. "Next.js 16.3.0", "tsx watch", "convex 1.43.0". */
  runtime?: string;
  pid?: number;
  startedAt?: number;
  readyAt?: number;
  /** Boot time reported by the tool ("Ready in 1.2s"). */
  bootMs?: number;
  lastReload?: Reload;
  reloads: number;
  memMb: number;
  cpu: number;
  /** Last 60 memory samples in MB, oldest first. */
  memHistory: number[];
  restarts: number;
  exitCode?: number | null;
}

export type DevEventKind =
  | 'ready'
  | 'reload'
  | 'compile'
  | 'request'
  | 'push'
  | 'error'
  | 'recovered'
  | 'exit'
  | 'restart'
  | 'info';

export interface DevEvent {
  id: number;
  at: number;
  service: string;
  kind: DevEventKind;
  text: string;
  ms?: number;
  status?: number;
}

export interface DevError {
  id: number;
  at: number;
  service: string;
  /** First meaningful line, shown collapsed. */
  title: string;
  /** Full block, shown expanded. */
  body: string[];
  /** "path/file.tsx:12:5" when the block names one. */
  file?: string;
}

export type UdfType = 'Query' | 'Mutation' | 'Action' | 'HttpAction';

export interface ConvexCall {
  id: number;
  at: number;
  type: UdfType;
  fn: string;
  ms: number;
  ok: boolean;
  cached: boolean;
  caller?: string;
  error?: string;
  logLines: string[];
}

/** What a parser can tell the store about one service. */
export type Signal =
  | { type: 'status'; status: ServiceStatus; detail?: string }
  | { type: 'meta'; runtime?: string; bootMs?: number; port?: number }
  | { type: 'event'; kind: DevEventKind; text: string; ms?: number; status?: number }
  | { type: 'reload'; route?: string; ms?: number }
  | { type: 'error'; title: string; body: string[]; file?: string }
  /** A successful compile or push: clears this service's open errors. */
  | { type: 'recovered' };

export interface LineParser {
  /** Feed one ANSI-stripped line. */
  push(line: string): Signal[];
  /** Called after 1s of quiet: close any half-read multi-line block. */
  flush(): Signal[];
}

export interface DeckMeta {
  /** Header text from the config; the UI shows it uppercased as `<title> · DEV`. */
  title?: string;
  startedAt: number;
  branch?: string;
  node: string;
  root: string;
  convexDeployment?: string;
}

/**
 * Where a memory hog lives. `run`: inside a devdeck service tree, or devdeck itself.
 * `platform`: a dev tool or anything naming the repo root, outside the run (leftovers,
 * orphans). `system`: everything else, such as browsers and editors.
 */
export type HogScope = 'run' | 'platform' | 'system';

/** One process (or one macOS app's processes, summed) holding a lot of memory or cpu. */
export interface Hog {
  pid: number;
  ppid: number;
  /** Readable name: `vitest`, `tsc`, `Brave Browser`, `devdeck`. */
  name: string;
  command: string;
  memMb: number;
  cpu: number;
  /** Seconds since the process started. */
  ageSec: number;
  scope: HogScope;
  /** A dev process reparented to launchd (ppid 1) and alive for over an hour. */
  orphan: boolean;
  /** The devdeck service whose tree holds it, so restart can free it. */
  serviceId?: string;
  /** Processes summed into this row; set when an app's helpers are grouped. */
  count?: number;
  /** Devdeck's own process. */
  self?: boolean;
}

/** What killPid did: stopped it, it was already gone, not allowed, or it outlived SIGKILL. */
export type KillResult = 'stopped' | 'gone' | 'denied' | 'survived';

/** The JSON served on GET /state over .devdeck/devdeck.sock. The Claude mod reads this. */
export interface DeckSnapshot {
  version: 1;
  now: number;
  meta: DeckMeta;
  services: ServiceState[];
  events: DevEvent[];
  errors: DevError[];
  calls: ConvexCall[];
  /** Processes holding the most memory or cpu, run, platform and system alike, largest first. */
  hogs: Hog[];
  /** `errors` counts every open error; the `errors` list above holds only the latest few. */
  totals: { memMb: number; cpu: number; calls: number; callErrors: number; errors: number };
}

/** Actions the UI may ask of the supervisor. */
export interface DeckControls {
  restart(id: string): void;
  open(id: string): void;
  /** Stop every service and exit with `exitCode` (0 for q, 130 for Ctrl-C). */
  quit(exitCode?: number): void;
  rawLines(id: string): readonly string[];
  /** Fires when a service gets a new raw line. Returns an unsubscribe. */
  onRaw(id: string, cb: () => void): () => void;
  /**
   * SIGTERM one pid, SIGKILL it after about 3 s. Refuses pid 1 and below, devdeck itself
   * and a service root (those restart instead) with 'denied', as it does on EPERM.
   */
  killPid(pid: number): Promise<KillResult>;
}
