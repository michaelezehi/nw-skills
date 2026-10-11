// devdeck: a small live mirror of the Devdeck dev dashboard. Polls
// <repo>/.devdeck/devdeck.sock, draws one line above the prompt, opens a pane
// on /devdeck, and answers the devdeck_status tool. Every function that
// takes `$` lives in this file: the engine follows `$` across no import.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Snap } from '../types'

import { band } from './band'
import { ANIMATE_MS, activityBetween, isFresh, parseErrors, seenOf, trimSnapshot } from './model'
import type { Seen } from './model'
import { pane } from './pane'
import { ERRORS_URL, FRAME_MS, POLL_MS, RETRY_MS, STATE_URL, ancestors, socketIn } from './socket'
import { NOT_RUNNING, summaryText } from './summary'

const PANE = 'devdeck'
const TOOL = 'mcp__devdeck__devdeck_status'

const snapAtom = atom({ plugin: 'devdeck', key: 'snap' } as const, null)
const expandedAtom = atom({ plugin: 'devdeck', key: 'expanded' } as const, [])
const clockAtom = atom({ plugin: 'devdeck', key: 'clock' } as const, 0)
const frameAtom = atom({ plugin: 'devdeck', key: 'frame' } as const, 0)
const activityAtom = atom({ plugin: 'devdeck', key: 'activity' } as const, null)

/** The nearest Devdeck socket at or above `cwd`, or null. */
async function findSocket($: EngineInterface, cwd: string): Promise<string | null> {
  if (!cwd.startsWith('/')) return null
  for (const dir of ancestors(cwd)) {
    const path = socketIn(dir)
    const isThere = await $.fs.exists(path).catch(() => false)
    if (isThere) return path
  }
  return null
}

/** GET over the socket: the body on a 2xx, else null. Never rejects. */
async function getText($: EngineInterface, url: string, socketPath: string): Promise<string | null> {
  try {
    const res = await $.http.fetch(url, { socketPath })
    return res.ok ? res.text : null
  } catch {
    return null
  }
}

/** The tool's answer, read fresh so it works whether or not the poller has run. */
async function statusText($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd().catch(() => '')
  const socket = await findSocket($, cwd)
  if (socket === null) return NOT_RUNNING

  const clock = await $.clock.now().catch(() => 0)
  const text = await getText($, STATE_URL, socket)
  const snap = text === null ? null : trimSnapshot(text, clock)
  if (snap === null) return `Devdeck's socket is at ${socket} but it did not answer GET /state.`

  const full = await getText($, ERRORS_URL, socket)
  const errors = (full === null ? null : parseErrors(full)) ?? snap.errors
  return summaryText(snap, errors, socket, clock)
}

/**
 * One module load's loop: a 1s tick that keeps the band's clock, polls when
 * due (1s while Devdeck answers, 10s while it does not), and runs the sprite
 * for 2s after something happens. Returns the stop.
 */
function startPoller($: EngineInterface, cwd: string): () => void {
  let socket: string | null = null
  let nextAt = 0
  let isBusy = false
  let seen: Seen | null = null
  let anim: Timer | null = null

  const now = (): Promise<number> => $.clock.now().catch(() => 0)

  const animate = (startedAt: number): void => {
    anim?.cancel()
    let frame = 0
    anim = $.clock.every(FRAME_MS, () => {
      frame += 1
      void (async () => {
        if ((await now()) - startedAt >= ANIMATE_MS) {
          anim?.cancel()
          anim = null
        }
        await update($, frameAtom, () => frame)
      })().catch(() => undefined)
    })
  }

  const fail = async (at: number): Promise<void> => {
    socket = null
    seen = null
    nextAt = at + RETRY_MS
    if ((await read($, snapAtom)) !== null) await update($, snapAtom, () => null)
  }

  const poll = async (at: number): Promise<void> => {
    socket ??= await findSocket($, cwd)
    if (socket === null) return fail(at)

    const text = await getText($, STATE_URL, socket)
    const snap: Snap | null = text === null ? null : trimSnapshot(text, at)
    if (snap === null) return fail(at)

    const next = seenOf(snap)
    const happened = seen === null ? null : activityBetween(seen, next, at)
    seen = next
    nextAt = at + POLL_MS
    await update($, clockAtom, () => at)
    await update($, snapAtom, () => snap)
    if (happened) {
      await update($, activityAtom, () => happened)
      animate(at)
    }
  }

  const tick = async (): Promise<void> => {
    const at = await now()
    if ((await read($, snapAtom)) !== null) await update($, clockAtom, () => at)
    if (isBusy || at < nextAt) return
    isBusy = true
    try {
      await poll(at)
    } finally {
      isBusy = false
    }
  }

  const run = (): void => void tick().catch(() => undefined)
  const timer = $.clock.every(POLL_MS, run)
  run()

  return () => {
    timer.cancel()
    anim?.cancel()
  }
}

export const register: Register = on => {
  // Module scope is fine: session.start runs again on every (re)load.
  let stop: (() => void) | null = null

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    try {
      await $.command.register({
        name: 'devdeck',
        description: 'Show the Devdeck pane: services, Convex calls, events and errors',
      })
      await $.tool.register({
        name: 'devdeck_status',
        description:
          'Read-only. Summarises the running Devdeck dev dashboard for this project: each service and its status, ' +
          'recent Convex calls, and every open dev error in full (compile, type, runtime, Convex). ' +
          'Use it to answer what is failing or erroring in local dev instead of reading logs. Takes no input.',
        inputSchema: { type: 'object', properties: {} },
      })
    } catch {
      // A refused registration leaves the band working.
    }
    stop?.()
    stop = startPoller($, e.cwd)
    return started
  })

  on('command.run', { command: 'devdeck' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Devdeck' })
    return { text: opened.isPlaced ? 'Devdeck pane opened.' : 'Devdeck pane opens once the terminal is wide enough.' }
  }).catch(() => ({ text: 'Devdeck pane could not open.' }))

  on('tool.call', { tool: TOOL }, async $ => ({ result: await statusText($) })).catch(() => ({
    result: 'Devdeck status could not be read.',
  }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const snap = await read($, snapAtom)
    const clock = await read($, clockAtom)
    if (!isFresh(snap, clock)) return next(e)

    return band({
      ui: $.ui.resolve(e),
      Raster: e.surface === 'terminal' ? $.ui.resolve(e).Raster : null,
      snap,
      clock,
      frame: await read($, frameAtom),
      activity: await read($, activityAtom),
      columns: e.props.bodyColumns,
    })
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const snap = await read($, snapAtom)
    const clock = await read($, clockAtom)
    return pane({
      ui: $.ui.resolve(e),
      snap: isFresh(snap, clock) ? snap : null,
      clock,
      columns: e.props.bodyColumns,
      expanded: await read($, expandedAtom),
      toggle: id =>
        void update($, expandedAtom, ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])).catch(
          () => undefined,
        ),
    })
  }).catch(($, e, next) => next(e))
}
