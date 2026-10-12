// devdeck: a small live mirror of the Devdeck dev dashboard. Polls
// <repo>/.devdeck/devdeck.sock, draws one line above the prompt, opens a pane
// on /devdeck, and answers the devdeck_status tool. Every function that
// takes `$` lives in this file: the engine follows `$` across no import.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Snap } from '../types'

import { RESTART_URL, RUN_URL, refusedText, resultText, waitSeconds, waitText, waitUrl } from './actions'
import { band } from './band'
import { ANIMATE_MS, activityBetween, isFresh, parseErrors, seenOf, trimSnapshot } from './model'
import type { Seen } from './model'
import { pane } from './pane'
import { DEFAULT_PALETTE, THEME_MS, parsePalette, samePalette, themePath } from './palette'
import { ERRORS_URL, FETCH_TIMEOUT_MS, FRAME_MS, POLL_MS, RETRY_MS, STATE_URL, ancestors, socketIn } from './socket'
import { NOT_RUNNING, summaryText } from './summary'

const PANE = 'devdeck'
const TOOL = 'mcp__devdeck__devdeck_status'
const RUN_TOOL = 'mcp__devdeck__devdeck_run'
const RESTART_TOOL = 'mcp__devdeck__devdeck_restart'
const WAIT_TOOL = 'mcp__devdeck__devdeck_wait'

const snapAtom = atom({ plugin: 'devdeck', key: 'snap' } as const, null)
const expandedAtom = atom({ plugin: 'devdeck', key: 'expanded' } as const, [])
const clockAtom = atom({ plugin: 'devdeck', key: 'clock' } as const, 0)
const frameAtom = atom({ plugin: 'devdeck', key: 'frame' } as const, 0)
const activityAtom = atom({ plugin: 'devdeck', key: 'activity' } as const, null)
const paletteAtom = atom({ plugin: 'devdeck', key: 'palette' } as const, DEFAULT_PALETTE)

/** The theme file's text, or null when there is no home to find it in or it cannot be read. */
async function themeText($: EngineInterface): Promise<string | null> {
  const xdg = await $.env.get('XDG_CONFIG_HOME').catch(() => undefined)
  const home = await $.env.get('HOME').catch(() => undefined)
  const path = themePath(xdg, home)
  if (path === null) return null
  return $.fs.read(path).then(
    out => (typeof out === 'string' ? out : null),
    () => null,
  )
}

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

/**
 * GET over the socket: the body on a 2xx, else null. Never rejects, and gives up after
 * FETCH_TIMEOUT_MS: a Devdeck that accepts the connection and never answers must not
 * hold the poller busy, or the tool call, for good.
 */
async function getText($: EngineInterface, url: string, socketPath: string): Promise<string | null> {
  const res = await ask($, url, socketPath)
  return res !== null && res.status >= 200 && res.status < 300 ? res.text : null
}

/** Any request over the socket, with its status; null when it failed or ran past `timeoutMs`. */
async function ask(
  $: EngineInterface,
  url: string,
  socketPath: string,
  init: { method?: string; body?: string } = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<{ status: number; text: string } | null> {
  let giveUp: (value: null) => void = () => undefined
  const timedOut = new Promise<null>(resolve => {
    giveUp = resolve
  })
  const timer = $.clock.after(timeoutMs, () => giveUp(null))
  const headers = init.body === undefined ? undefined : { 'content-type': 'application/json' }
  const fetched = $.http.fetch(url, { ...init, ...(headers ? { headers } : {}), socketPath }).then(
    res => ({ status: res.status, text: res.text }),
    () => null,
  )
  try {
    return await Promise.race([fetched, timedOut])
  } finally {
    timer.cancel()
  }
}

/** Wait on a card over the socket: the tool's answer text. */
async function waitOn($: EngineInterface, socket: string, id: string, until: 'exit' | 'ready', seconds: number): Promise<string> {
  // A little past the socket's own deadline, so the socket answers "timeout" itself.
  const res = await ask($, waitUrl(id, until, seconds * 1000), socket, {}, seconds * 1000 + 5000)
  if (res === null) return `Devdeck did not answer while waiting on ${id}.`
  return res.status === 404 ? `Devdeck has no card "${id}".` : waitText(res.text)
}

/** The answer for devdeck_run, devdeck_restart and devdeck_wait. */
async function actionText($: EngineInterface, tool: string, args: Record<string, unknown>): Promise<string> {
  const cwd = await $.session.cwd().catch(() => '')
  const socket = await findSocket($, cwd)
  if (socket === null) return `${NOT_RUNNING} Start it with pnpm dev in a terminal first.`
  const seconds = waitSeconds(args.timeoutSec)
  const wait = args.wait !== false

  if (tool === RUN_TOOL) {
    const script = typeof args.script === 'string' ? args.script : ''
    const res = await ask($, RUN_URL, socket, { method: 'POST', body: JSON.stringify({ script }) })
    if (res === null) return 'Devdeck did not answer POST /run.'
    if (res.status !== 200) return refusedText(res.text)
    if (!wait) return resultText(res.text)
    const id = (JSON.parse(res.text) as { id: string }).id
    return waitOn($, socket, id, 'exit', seconds)
  }
  if (tool === RESTART_TOOL) {
    const id = typeof args.id === 'string' ? args.id : ''
    const res = await ask($, RESTART_URL, socket, { method: 'POST', body: JSON.stringify({ id }) })
    if (res === null) return 'Devdeck did not answer POST /restart.'
    if (res.status !== 200) return refusedText(res.text)
    return wait ? waitOn($, socket, id, 'ready', seconds) : `Restarted ${id}.`
  }
  const id = typeof args.id === 'string' ? args.id : ''
  return waitOn($, socket, id, args.until === 'ready' ? 'ready' : 'exit', seconds)
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
 * due (1s while Devdeck answers, 10s while it does not), reads the theme file
 * on the first tick and then every 10s, and runs the sprite for 2s after
 * something happens. Returns the stop.
 */
function startPoller($: EngineInterface, cwd: string): () => void {
  let socket: string | null = null
  let nextAt = 0
  let themeAt = 0
  let isBusy = false
  let seen: Seen | null = null
  let anim: Timer | null = null
  // Set by the stop: a poll still in flight then writes nothing.
  let isStopped = false

  const now = (): Promise<number> => $.clock.now().catch(() => 0)

  const animate = (startedAt: number): void => {
    anim?.cancel()
    let frame = 0
    const timer = $.clock.every(FRAME_MS, () => {
      frame += 1
      void (async () => {
        const at = await now()
        // A tick that resolves after a newer animation started leaves that one alone.
        if (anim !== timer) return timer.cancel()
        if (at - startedAt >= ANIMATE_MS) {
          timer.cancel()
          anim = null
        }
        await update($, frameAtom, () => frame)
      })().catch(() => undefined)
    })
    anim = timer
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
    if (isStopped) return
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

  /** Stores the theme file's palette when it differs from the one drawn. */
  const loadTheme = async (): Promise<void> => {
    const palette = parsePalette(await themeText($))
    if (isStopped || samePalette(palette, await read($, paletteAtom))) return
    await update($, paletteAtom, () => palette)
  }

  const tick = async (): Promise<void> => {
    const at = await now()
    if (at >= themeAt) {
      themeAt = at + THEME_MS
      void loadTheme().catch(() => undefined)
    }
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
    isStopped = true
    timer.cancel()
    anim?.cancel()
    anim = null
  }
}

export const register: Register = on => {
  // Module scope is fine: session.start runs again on every (re)load, and a hot reload
  // cancels the old module's clock timers with its environment (see `$.clock` in the
  // engine types), so the previous poller's tick and animation stop with it. The engine
  // has no unload event to hook; `stop` covers a second session.start within one load.
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
      const timeoutSec = { type: 'number', description: 'Most seconds to wait. Default 120, at most 600.' }
      await $.tool.register({
        name: 'devdeck_run',
        description:
          'Runs a package.json script (build, test:ci, lint, ship) as a card in the running Devdeck, where the user sees its ' +
          'progress and answers its prompts, then waits for it to end and returns the exit code, its errors and last 40 lines. ' +
          'Prefer it to Bash for package scripts while Devdeck runs. Only script names from package.json are accepted.',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'The script name, as in package.json.' },
            wait: { type: 'boolean', description: 'Wait for it to end. Default true.' },
            timeoutSec,
          },
          required: ['script'],
        },
      })
      await $.tool.register({
        name: 'devdeck_restart',
        description: 'Restarts a Devdeck service by id (see devdeck_status) and waits until it is ready or fails.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, wait: { type: 'boolean', description: 'Default true.' }, timeoutSec },
          required: ['id'],
        },
      })
      await $.tool.register({
        name: 'devdeck_wait',
        description: 'Waits on a Devdeck card (a script run or a service) until it exits, or is ready, or stops at a prompt.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, until: { type: 'string', enum: ['exit', 'ready'] }, timeoutSec },
          required: ['id'],
        },
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

  for (const tool of [RUN_TOOL, RESTART_TOOL, WAIT_TOOL]) {
    on('tool.call', { tool }, async ($, e) => ({ result: await actionText($, tool, e as unknown as Record<string, unknown>) })).catch(() => ({
      result: 'Devdeck could not be reached.',
    }))
  }

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
      palette: await read($, paletteAtom),
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
      palette: await read($, paletteAtom),
      toggle: id =>
        void update($, expandedAtom, ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])).catch(
          () => undefined,
        ),
    })
  }).catch(($, e, next) => next(e))
}
