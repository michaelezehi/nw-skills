import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

const ROOT = '/repo'
const SOCK = `${ROOT}/.devdeck/devdeck.sock`
const TOOL = 'mcp__devdeck__devdeck_status'
const HOME = '/home/me'
const THEME = `${HOME}/.config/devdeck/theme.json`

const EMBER = {
  accent: '#ff7a45', activity: '#ffb347', text: '#f4e9e1', muted: '#9c8f86', line: '#4a3f3a', error: '#ff4d4f',
}
const themeFile = (colors: Record<string, unknown>) => JSON.stringify({ version: 1, preset: 'ember', colors })

const BAND: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 10 }, view: {},
}
const PANE = { title: 'Devdeck', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as unknown as RenderPropsOf['Pane']

const svc = (id: string, kind: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, label: id, kind, status, port: 3000, reloads: 0, memMb: 400, cpu: 1, memHistory: [1, 2], restarts: 0, ...extra,
})

const SNAPSHOT = {
  version: 1,
  now: 50_000,
  meta: { startedAt: 0, node: 'v22', root: ROOT },
  services: [
    svc('web', 'next', 'ready', { lastReload: { at: 48_000, route: '/dashboard', ms: 182 } }),
    svc('admin', 'next', 'compiling'),
    svc('teams', 'next', 'stopped'),
    svc('pdf', 'node', 'crashed'),
    svc('convex', 'convex', 'ready'),
    svc('types', 'watch', 'ready'),
  ],
  events: [{ id: 1, at: 49_000, service: 'web', kind: 'reload', text: 'compiled /dashboard', ms: 182 }],
  errors: [
    { id: 7, at: 45_000, service: 'admin', title: 'Type error in page.tsx', body: ['Type error in page.tsx', 'line two of the body'] },
    { id: 8, at: 46_000, service: 'pdf', title: 'Process exited 1', body: ['Process exited 1'] },
  ],
  calls: [{ id: 3, at: 47_000, type: 'Mutation', fn: 'roadmap:updateMilestone', ms: 31, ok: true, cached: false, logLines: [] }],
  totals: { memMb: 2048, cpu: 4, calls: 1, callErrors: 0 },
}

const ERRORS = [
  { id: 7, at: 45_000, service: 'admin', title: 'Type error in page.tsx', body: ['Type error in page.tsx', 'full body line from /errors'] },
  { id: 8, at: 46_000, service: 'pdf', title: 'Process exited 1', body: ['Process exited 1'] },
]

/**
 * The world beneath the plugin: a session in /repo/apps/web, Devdeck up or not,
 * and a theme file at `files` paths (none unless a test writes one).
 */
function world(on: On, isUp: boolean, env: Record<string, string> = { HOME }) {
  const clock = mock.clock(on, { now: 1000 })
  mock.env(on, env)
  const state = { isUp, isHung: false, errorTotal: null as number | null }
  const files = new Map<string, string>()
  const reads: string[] = []
  on('fs.read', ($, e) => {
    reads.push(e.path)
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // What the engine draws when the plugin passes: an empty Box, keyed to find.
  on('ui.render', () => ({ type: 'Box', props: { key: 'engine-own' } }))
  on('session.cwd', () => ({ value: `${ROOT}/apps/web` }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__devdeck__${e.name}` } }))
  on('fs.exists', ($, e) => ({ value: state.isUp && e.path === SOCK }))
  on('http.fetch', async ($, e) => {
    if (state.isHung) await clock.sleep(600_000)
    if (!state.isUp || e.init?.socketPath !== SOCK) return { deny: 'ECONNREFUSED' }
    const snapshot = state.errorTotal === null ? SNAPSHOT : { ...SNAPSHOT, totals: { ...SNAPSHOT.totals, errors: state.errorTotal } }
    const body = e.url.endsWith('/errors') ? ERRORS : snapshot
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } }
  })
  return { clock, state, files, reads }
}

/** The colours the band drew: DEV, each service dot, the latest activity, errors and memory. */
async function bandColors(row: Mounted<'terminal', 'AbovePrompt'>) {
  const colorIn = async (key: string) => (await row.find({ key }))?.children.map(c => (c as { props?: { color?: unknown } }).props?.color)[0]
  return {
    dev: (await row.find({ type: 'Text', text: 'DEV' }))?.props.color,
    dots: (await row.findAll({ type: 'Text', text: '●' })).map(t => t.props.color),
    latest: await colorIn('devdeck-latest'),
    errors: await colorIn('devdeck-errors'),
    mem: await colorIn('devdeck-mem'),
  }
}

describe('band', () => {
  test('renders nothing without a snapshot', async ($, on) => {
    const { clock } = world(on, false)
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const row = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ key: 'devdeck-band' })).toBeUndefined()
    expect(await row.find({ key: 'engine-own' })).toBeDefined()
  })

  test('shows a dot per main service and the error count', async ($, on) => {
    const { clock } = world(on, true)
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const row = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ key: 'devdeck-band' })).toBeDefined()
    for (const id of ['web', 'admin', 'teams', 'pdf', 'convex']) expect(await row.find({ key: `dot-${id}` })).toBeDefined()
    expect(await row.find({ key: 'dot-types' })).toBeUndefined()
    expect((await row.find({ key: 'devdeck-errors' }))?.text).toBe('◆ 2')
    expect((await row.find({ key: 'devdeck-sprite' }))?.type).toBe('Raster')
    expect((await row.find({ key: 'devdeck-latest' }))?.text).toBe('↯ web /dashboard 182ms')
    expect((await row.find({ key: 'devdeck-mem' }))?.text).toBe('2.0G')
  })

  test('a narrow band drops the activity and memory before it wraps', async ($, on) => {
    const { clock } = world(on, true)
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const row = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 24 } })
    expect(await row.find({ key: 'dot-convex' })).toBeDefined()
    expect(await row.find({ key: 'devdeck-errors' })).toBeDefined()
    expect(await row.find({ key: 'devdeck-latest' })).toBeUndefined()
    expect(await row.find({ key: 'devdeck-mem' })).toBeUndefined()
  })

  test('a stale snapshot hides the band', async ($, on) => {
    const { clock, state } = world(on, true)
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const row = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ key: 'devdeck-band' })).toBeDefined()

    // Devdeck hangs: the tick still runs but no poll lands.
    state.isHung = true
    await clock.advance(6000)
    await row.redraw()
    expect(await row.find({ key: 'devdeck-band' })).toBeUndefined()
  })
})

describe('poller', () => {
  test('a hung fetch times out and later polls still land', async ($, on) => {
    const { clock, state } = world(on, true)
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const row = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ key: 'devdeck-band' })).toBeDefined()

    // Devdeck accepts the request and never answers: the poll gives up after 1.5s.
    state.isHung = true
    await clock.advance(3000)
    await row.redraw()
    expect(await row.find({ key: 'devdeck-band' })).toBeUndefined()

    // It answers again: the next retry lands, so the poller was not left busy.
    state.isHung = false
    await clock.advance(12_000)
    await row.redraw()
    expect(await row.find({ key: 'devdeck-band' })).toBeDefined()
  })

  test('the band and pane count every open error from totals', async ($, on) => {
    const { clock, state } = world(on, true)
    state.errorTotal = 41
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const row = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await row.find({ key: 'devdeck-errors' }))?.text).toBe('◆ 41')
    const panel = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'Pane', requestId: 'devdeck', props: PANE } as never)
    expect(await panel.find({ type: 'Text', text: 'Errors · 41' })).toBeDefined()
  })
})

describe('devdeck_status tool', () => {
  test('answers within the timeout when Devdeck hangs', async ($, on) => {
    const { clock, state } = world(on, true)
    state.isHung = true
    const pending = $.tool.call({ tool: TOOL } as never)
    await clock.advance(2000)
    const out = await pending
    expect(String(out.result)).toMatch(/did not answer GET \/state/)
  })

  test('summarises services and every error body', async ($, on) => {
    world(on, true)
    const out = await $.tool.call({ tool: TOOL } as never)
    const text = String(out.result)
    expect(text).toMatch(/web :3000 ready/)
    expect(text).toMatch(/M roadmap:updateMilestone 31ms/)
    expect(text).toMatch(/Errors \(2\)/)
    expect(text).toMatch(/full body line from \/errors/)
  })

  test('says so when no socket is found', async ($, on) => {
    world(on, false)
    const out = await $.tool.call({ tool: TOOL } as never)
    expect(out.result).toBe('Devdeck is not running in this project.')
  })
})

describe('pane', () => {
  test('an error expands on press and collapses on the next', async ($, on) => {
    const { clock } = world(on, true)
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })
    await clock.settle()
    const panel = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'Pane', requestId: 'devdeck', props: PANE } as never)
    expect(await panel.find({ key: 'svc-admin' })).toBeDefined()
    expect(await panel.find({ key: 'call-3' })).toBeDefined()
    expect(await panel.find({ key: 'err-7' })).toBeDefined()
    expect(await panel.find({ key: 'errbody-7' })).toBeUndefined()

    await panel.press({ key: 'err-7' })
    expect(await panel.find({ key: 'errbody-7' })).toBeDefined()
    expect(await panel.find({ type: 'Text', text: 'line two of the body' })).toBeDefined()

    await panel.press({ key: 'err-7' })
    expect(await panel.find({ key: 'errbody-7' })).toBeUndefined()
  })
})

describe('palette', () => {
  const mount = ($: Engine) => $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const start = ($: Engine) =>
    $.session.start({ cwd: `${ROOT}/apps/web`, surface: 'terminal', isInteractive: true })

  // Dots in order: web ready, admin compiling, teams stopped, pdf crashed, convex ready.
  const DEFAULT_COLORS = {
    dev: '#fde047',
    dots: ['#fde047', '#f5a524', '#8a887f', '#f87171', '#fde047'],
    latest: '#f5a524',
    errors: '#f87171',
    mem: '#8a887f',
  }

  test('no theme file draws the default palette', async ($, on) => {
    const { clock, reads } = world(on, true)
    await start($)
    await clock.settle()
    expect(reads).toEqual([THEME])
    expect(await bandColors(await mount($))).toEqual(DEFAULT_COLORS)
  })

  test('an Ember theme file recolours the band, sprite included', async ($, on) => {
    const { clock, files } = world(on, true)
    await start($)
    await clock.settle()
    const before = (await (await mount($)).find({ key: 'devdeck-sprite' }))?.props.cells

    files.set(THEME, themeFile(EMBER))
    await clock.advance(10_000)
    const row = await mount($)
    expect(await bandColors(row)).toEqual({
      dev: EMBER.accent,
      dots: [EMBER.accent, EMBER.activity, EMBER.muted, EMBER.error, EMBER.accent],
      latest: EMBER.activity,
      errors: EMBER.error,
      mem: EMBER.muted,
    })
    expect((await row.find({ key: 'devdeck-sprite' }))?.props.cells).not.toBe(before)
  })

  test('XDG_CONFIG_HOME wins over HOME', async ($, on) => {
    const { clock, files, reads } = world(on, true, { HOME, XDG_CONFIG_HOME: '/xdg' })
    files.set('/xdg/devdeck/theme.json', themeFile(EMBER))
    await start($)
    await clock.settle()
    expect(reads).toEqual(['/xdg/devdeck/theme.json'])
    expect((await bandColors(await mount($))).dev).toBe(EMBER.accent)
  })

  test('a corrupt theme file draws the defaults', async ($, on) => {
    const { clock, files } = world(on, true)
    files.set(THEME, '{ "version": 1, "colors": { "accent": "#ff7a45"')
    await start($)
    await clock.settle()
    expect(await bandColors(await mount($))).toEqual(DEFAULT_COLORS)
  })

  test('a bad hex falls back for that token alone', async ($, on) => {
    const { clock, files } = world(on, true)
    files.set(THEME, themeFile({ ...EMBER, accent: 'orange', error: '#f00' }))
    await start($)
    await clock.settle()
    const colors = await bandColors(await mount($))
    expect(colors.dev).toBe('#fde047')
    expect(colors.errors).toBe('#f87171')
    expect(colors.mem).toBe(EMBER.muted)
    expect(colors.latest).toBe(EMBER.activity)
  })

  test('the pane draws in the palette too', async ($, on) => {
    const { clock, files } = world(on, false)
    files.set(THEME, themeFile(EMBER))
    await start($)
    await clock.settle()
    const panel = await $.ui.mount({ plugin: 'devdeck', surface: 'terminal', component: 'Pane', requestId: 'devdeck', props: PANE } as never)
    expect((await panel.find({ type: 'Text', text: 'Devdeck is not running in this project.' }))?.props.color).toBe(EMBER.muted)
  })

  test('the file is read once per 10s, not on every 1s poll', async ($, on) => {
    const { clock, files, reads } = world(on, true)
    await start($)
    await clock.settle()
    expect(reads).toHaveLength(1)

    // A pick in Devdeck lands on the next 10s read, not before.
    files.set(THEME, themeFile(EMBER))
    await clock.advance(5000)
    expect(reads).toHaveLength(1)
    expect((await bandColors(await mount($))).dev).toBe('#fde047')

    await clock.advance(5000)
    expect(reads).toHaveLength(2)
    expect((await bandColors(await mount($))).dev).toBe(EMBER.accent)
  })
})

describe('run, restart and wait tools', () => {
  const RESULT = (extra: Record<string, unknown> = {}) => ({
    id: 'run-build', label: 'build', status: 'stopped', running: false, exitCode: 0, ranMs: 42_000,
    progress: { fraction: 1, label: 'step 9/9' }, errors: [], tail: ['compiled', 'done'], ...extra,
  })

  /** A socket that answers each route; `sent` records method, url and body. */
  function sockets(on: On, answer: (method: string, url: string, body: string) => { status: number; body: unknown }) {
    const clock = mock.clock(on, { now: 1000 })
    const sent: string[] = []
    on('session.cwd', () => ({ value: `${ROOT}/apps/web` }))
    on('fs.exists', ($, e) => ({ value: e.path === SOCK }))
    on('http.fetch', async ($, e) => {
      const method = e.init?.method ?? 'GET'
      const body = typeof e.init?.body === 'string' ? e.init.body : ''
      sent.push(`${method} ${e.url}${body ? ` ${body}` : ''}`)
      const out = answer(method, e.url, body)
      return { value: { status: out.status, ok: out.status < 300, headers: {}, text: JSON.stringify(out.body) } }
    })
    return { clock, sent }
  }

  test('devdeck_run posts the script, waits for the exit, and reports code, progress and output', async ($, on) => {
    const { sent } = sockets(on, (method, url) =>
      method === 'POST' ? { status: 200, body: RESULT({ status: 'starting', running: true }) } : { status: 200, body: { reason: 'exit', result: RESULT() } },
    )
    const out = await $.tool.call({ tool: 'mcp__devdeck__devdeck_run', script: 'build', timeoutSec: 30 } as never)
    expect(sent).toEqual(['POST http://devdeck/run {"script":"build"}', 'GET http://devdeck/wait?id=run-build&until=exit&timeoutMs=30000'])
    const text = String(out.result)
    expect(text).toMatch(/^build finished in 42\.0s\./)
    expect(text).toMatch(/Progress: 100% step 9\/9/)
    expect(text).toMatch(/Last 2 lines:\ncompiled\ndone/)
  })

  test('devdeck_run names the real scripts when the name is not one', async ($, on) => {
    sockets(on, () => ({ status: 404, body: { error: 'no script named "rm -rf /" in package.json', scripts: ['build', 'lint'] } }))
    const out = await $.tool.call({ tool: 'mcp__devdeck__devdeck_run', script: 'rm -rf /' } as never)
    expect(out.result).toBe('no script named "rm -rf /" in package.json. Scripts: build, lint.')
  })

  test('a prompt hands the question back for the user to answer in the deck', async ($, on) => {
    sockets(on, (method) =>
      method === 'POST'
        ? { status: 200, body: RESULT({ running: true }) }
        : { status: 200, body: { reason: 'prompt', result: RESULT({ running: true, prompt: { kind: 'confirm', question: 'Deploy to production?' } }) } },
    )
    const out = await $.tool.call({ tool: 'mcp__devdeck__devdeck_run', script: 'ship' } as never)
    expect(String(out.result)).toMatch(/^build is waiting for input: "Deploy to production\?" \(yes\/no\)\. Only a person can answer it/)
  })

  test('devdeck_restart waits for ready, and devdeck_wait reports a timeout', async ($, on) => {
    const { sent } = sockets(on, (method, url) =>
      method === 'POST'
        ? { status: 200, body: { id: 'web' } }
        : url.includes('until=ready')
          ? { status: 200, body: { reason: 'ready', result: RESULT({ id: 'web', label: 'Web', status: 'ready', running: true }) } }
          : { status: 200, body: { reason: 'timeout', result: RESULT({ running: true, status: 'starting', ranMs: 130_000 }) } },
    )
    const restarted = await $.tool.call({ tool: 'mcp__devdeck__devdeck_restart', id: 'web' } as never)
    expect(String(restarted.result)).toMatch(/^Web is ready\./)
    expect(sent[1]).toBe('GET http://devdeck/wait?id=web&until=ready&timeoutMs=120000')
    const waited = await $.tool.call({ tool: 'mcp__devdeck__devdeck_wait', id: 'run-build', timeoutSec: 9999 } as never)
    expect(String(waited.result)).toMatch(/^build is still running after the wait \(2m 10s so far\)\. Call devdeck_wait again/)
    expect(sent.at(-1)).toBe('GET http://devdeck/wait?id=run-build&until=exit&timeoutMs=600000')
  })

  test('says how to start Devdeck when no socket is found', async ($, on) => {
    mock.clock(on, { now: 1000 })
    on('session.cwd', () => ({ value: `${ROOT}/apps/web` }))
    on('fs.exists', () => ({ value: false }))
    const out = await $.tool.call({ tool: 'mcp__devdeck__devdeck_run', script: 'build' } as never)
    expect(out.result).toBe('Devdeck is not running in this project. Start it with pnpm dev in a terminal first.')
  })
})
