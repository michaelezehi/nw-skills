import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

const ROOT = '/repo'
const SOCK = `${ROOT}/.devdeck/devdeck.sock`
const TOOL = 'mcp__devdeck__devdeck_status'

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

/** The world beneath the plugin: a session in /repo/apps/web, Devdeck up or not. */
function world(on: On, isUp: boolean) {
  const clock = mock.clock(on, { now: 1000 })
  const state = { isUp, isHung: false }
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
    const body = e.url.endsWith('/errors') ? ERRORS : SNAPSHOT
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } }
  })
  return { clock, state }
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

describe('devdeck_status tool', () => {
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
