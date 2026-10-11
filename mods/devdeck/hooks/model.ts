// The palette and pure helpers over the trimmed snapshot.
import type { Activity, Call, Err, Ev, ServiceStatus, Snap, Svc } from '../types'

export const YELLOW = '#fde047'
export const AMBER = '#f5a524'
export const PAPER = '#ecebe4'
export const ASH = '#8a887f'
export const RED = '#f87171'

/** The reload marker: a text glyph, since U+26A1 draws as an emoji. */
export const BOLT = '↯'
export const DOT = '●'
export const DIAMOND = '◆'

export const FRESH_MS = 5000
export const RELOAD_SHOWN_MS = 10_000
export const ANIMATE_MS = 2000

const MAX_EVENTS = 8
const MAX_CALLS = 8
const MAX_ERRORS = 30
const MAX_BODY = 80

export function statusColor(status: ServiceStatus): string {
  if (status === 'ready') return YELLOW
  if (status === 'compiling' || status === 'starting') return AMBER
  if (status === 'error' || status === 'crashed') return RED
  return ASH
}

export const isFresh = (snap: Snap | null, clock: number): snap is Snap =>
  snap !== null && clock - snap.fetchedAt < FRESH_MS

/** How long ago a Devdeck timestamp was, on the session's clock. */
export const ageOf = (snap: Snap, at: number, clock: number): number =>
  Math.max(0, snap.now - at + (clock - snap.fetchedAt))

/** The services the band shows: every non-watch service, plus a watch in error. */
export const bandServices = (snap: Snap): Svc[] =>
  snap.services.filter(s => s.kind !== 'watch' || s.status === 'error' || s.status === 'crashed')

const BADGE: Record<string, string> = { Query: 'Q', Mutation: 'M', Action: 'A', HttpAction: 'H' }
export const badgeOf = (type: string): string => BADGE[type] ?? '?'

export function fmtMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}G`
  return `${Math.round(mb)}M`
}

export function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

export const fmtMs = (ms: number | null): string => (ms === null ? '' : `${Math.round(ms)}ms`)

export type Latest = { text: string; color: string; isFailed: boolean }

/** The band's activity text: a reload within 10s or the latest call, whichever is newer. */
export function latestOf(snap: Snap, clock: number): Latest | null {
  let reload: { svc: Svc; at: number } | null = null
  for (const svc of snap.services) {
    if (svc.reloadAt === null) continue
    if (ageOf(snap, svc.reloadAt, clock) > RELOAD_SHOWN_MS) continue
    if (reload === null || svc.reloadAt > reload.at) reload = { svc, at: svc.reloadAt }
  }
  const call = snap.calls[snap.calls.length - 1] ?? null

  if (reload && (call === null || reload.at >= call.at)) {
    const parts = [BOLT, reload.svc.id, reload.svc.reloadRoute ?? '', fmtMs(reload.svc.reloadMs)]
    return { text: parts.filter(Boolean).join(' '), color: AMBER, isFailed: false }
  }
  if (call) {
    const text = `${badgeOf(call.type)} ${call.fn} ${fmtMs(call.ms)}`
    return { text, color: call.ok ? PAPER : RED, isFailed: !call.ok }
  }
  return null
}

// --- turning the wire snapshot into the trimmed one, defensively.

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter(isObj) : [])

const STATUSES: ServiceStatus[] = ['starting', 'ready', 'compiling', 'error', 'stopped', 'crashed']
const statusOf = (v: unknown): ServiceStatus => (STATUSES.includes(v as ServiceStatus) ? (v as ServiceStatus) : 'stopped')

function svcOf(r: Raw): Svc {
  const reload = isObj(r.lastReload) ? r.lastReload : null
  return {
    id: str(r.id),
    label: str(r.label, str(r.id)),
    kind: str(r.kind),
    port: numOrNull(r.port),
    status: statusOf(r.status),
    memMb: num(r.memMb),
    reloadAt: reload ? numOrNull(reload.at) : null,
    reloadRoute: reload ? strOrNull(reload.route) : null,
    reloadMs: reload ? numOrNull(reload.ms) : null,
  }
}

const evOf = (r: Raw): Ev => ({
  id: num(r.id), at: num(r.at), service: str(r.service), kind: str(r.kind), text: str(r.text), ms: numOrNull(r.ms),
})

const callOf = (r: Raw): Call => ({
  id: num(r.id), at: num(r.at), type: str(r.type), fn: str(r.fn), ms: num(r.ms), ok: r.ok !== false, error: strOrNull(r.error),
})

export const errOf = (r: Raw, maxBody = MAX_BODY): Err => ({
  id: num(r.id),
  at: num(r.at),
  service: str(r.service),
  title: str(r.title),
  body: (Array.isArray(r.body) ? r.body : []).map(line => String(line)).slice(0, maxBody),
  file: strOrNull(r.file),
})

/** Parses GET /state. Null when the text is not a version 1 DeckSnapshot. */
export function trimSnapshot(text: string, fetchedAt: number): Snap | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.services)) return null
  const meta = isObj(raw.meta) ? raw.meta : {}
  const totals = isObj(raw.totals) ? raw.totals : {}
  return {
    fetchedAt,
    now: num(raw.now, fetchedAt),
    root: str(meta.root),
    services: list(raw.services).map(svcOf),
    events: list(raw.events).slice(-MAX_EVENTS).map(evOf),
    calls: list(raw.calls).slice(-MAX_CALLS).map(callOf),
    errors: list(raw.errors).slice(-MAX_ERRORS).map(r => errOf(r)),
    // Every open error; the list above keeps only the latest few.
    errorCount: num(totals.errors, list(raw.errors).length),
    memMb: num(totals.memMb),
  }
}

/** Parses GET /errors: a bare array, or an object holding `errors`. */
export function parseErrors(text: string): Err[] | null {
  try {
    const raw: unknown = JSON.parse(text)
    const rows = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.errors) ? raw.errors : null
    return rows === null ? null : rows.filter(isObj).map(r => errOf(r, Number.MAX_SAFE_INTEGER))
  } catch {
    return null
  }
}

export type Seen = { reloadAt: number; callId: number; errorId: number }

export function seenOf(snap: Snap): Seen {
  return {
    reloadAt: Math.max(0, ...snap.services.map(s => s.reloadAt ?? 0)),
    callId: Math.max(0, ...snap.calls.filter(c => c.type === 'Mutation').map(c => c.id)),
    errorId: Math.max(0, ...snap.errors.map(e => e.id)),
  }
}

/** What happened between two polls, the loudest kind first. */
export function activityBetween(prev: Seen, next: Seen, at: number): Activity | null {
  if (next.errorId > prev.errorId) return { kind: 'error', at }
  if (next.reloadAt > prev.reloadAt) return { kind: 'reload', at }
  if (next.callId > prev.callId) return { kind: 'mutation', at }
  return null
}
