import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, On, RenderPropsOf } from 'claude-code'

import type { AgentRun, Flow } from '../types'
import { FRAME_MS, isMoving } from '../hooks/motion'
import { barCells, cardCrabCells, miniCrabCells } from '../hooks/terminal'

const band: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 10 }, view: {},
}
const pane = { title: 'Agents', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 } } as unknown as RenderPropsOf['Pane']

const plan = {
  tool: 'mcp__savvy-progress__progress',
  title: 'Launch kit',
  total: 4,
  done: 1,
  phase: 'delegate',
  tasks: [
    { title: 'Research competitor launches', tier: 'careful' },
    { title: 'Design the launch graphics', tier: 'medium' },
    { title: 'Build the landing page', tier: 'light' },
    { title: 'Review the whole kit', tier: 'heavy', after: [1, 2, 3] },
  ],
}

const panes = (isPlaced: boolean) => () => ({
  value: [{ id: 'savvy-agents', title: 'Agents', isShown: true, isFocused: false, isPlaced }],
})

const spawn = (description: string, subagentType: string) =>
  ({ prompt: 'x', description, subagentType, tool_use_id: `t-${description}`, background: true, fork: false }) as unknown as AgentSpawnInput

describe('terminal', () => {
  test('the band paints a raster bar and crab in the terminal, an SVG on the desktop', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.panes', panes(true))
    await $.tool.call(plan as never)

    const row = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'AbovePrompt', props: band })
    expect((await row.find({ key: 'savvy-bar' }))?.type).toBe('Raster')
    expect((await row.find({ key: 'savvy-mini' }))?.type).toBe('Raster')
    expect(await row.find({ type: 'Text', text: /Launch kit/ })).toBeDefined()

    const desk = await $.ui.mount({ plugin: 'savvy-progress', surface: 'desktop', component: 'AbovePrompt', props: band })
    expect(await desk.find({ type: 'Svg' })).toBeDefined()
  })

  test('the pane paints a crab card per running agent and per planned task', async ($, on) => {
    mock.clock(on)
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.panes', panes(true))
    on('agent.spawn', ($, e) => ({ model: 'claude-opus-5-5', agentId: `a-${e.description}` }))
    await $.tool.call(plan as never)
    await $.agent.spawn(spawn('Build the landing page', 'savvy-flow:savvy-light'))
    await $.agent.spawn(spawn('Design the launch graphics', 'savvy-flow:savvy-medium'))

    const row = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'AbovePrompt', props: band })
    const panel = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane } as never)
    expect((await panel.find({ key: 'crab-a-Build the landing page' }))?.type).toBe('Raster')
    expect((await panel.find({ key: 'line-a-Build the landing page' }))?.type).toBe('Raster')
    expect(await panel.find({ key: 'crab-plan-4' })).toBeDefined()
    expect(await panel.find({ type: 'Text', text: /^Cost$/ })).toBeDefined()
  })

  test('a pane too narrow to place lists its running agents under the bar', async ($, on) => {
    mock.clock(on)
    const opens: { rows?: number }[] = []
    on('ui.open', ($, e) => {
      opens.push(e as { rows?: number })
      return { value: { isPlaced: false, reason: 'below 144 columns' } }
    })
    on('ui.panes', panes(false))
    on('agent.spawn', ($, e) => ({ model: 'claude-opus-5-5', agentId: `a-${e.description}` }))
    await $.tool.call(plan as never)
    await $.agent.spawn(spawn('Build the landing page', 'savvy-flow:savvy-light'))
    await $.agent.spawn(spawn('Design the launch graphics', 'savvy-flow:savvy-medium'))

    // At the first spawn: header 5, gap 1, running 1 + one card of 5,
    // planned 1 + two of 3 (task 1 is done, task 3 is running).
    expect(opens[0]?.rows).toBe(19)
    const row = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'AbovePrompt', props: band })
    expect(await row.find({ key: 'band-a-Build the landing page' })).toBeDefined()
    expect(await row.find({ key: 'band-a-Design the launch graphics' })).toBeDefined()
  })
})

const flowOf = (over: Partial<Flow>): Flow => ({
  title: 'Launch kit', total: 4, done: 1, running: 1, phase: 'delegate', isFinished: false, tasks: [], ...over,
})

const runOf = (over: Partial<AgentRun>): AgentRun => ({
  id: 'a', type: 'savvy-flow:savvy-light', description: 'x', model: 'claude-opus-5-5', status: 'running', startedAt: 0,
  contextTokens: 0, contextMax: 1, tokens: 0, costUsd: 0, steps: 0, round: 1, ...over,
})

const DONE = '#5fbf8f'
const ACCENT = 0x8f8cf4

describe('motion', () => {
  test('the done crab waves for three seconds, then rests still', () => {
    // `party` is frames into the celebration; null once it is over.
    const a = cardCrabCells('light', '#1D9E75', 'done', 0, 0, DONE)
    const b = cardCrabCells('light', '#1D9E75', 'done', 2, 2, DONE)
    expect(a).not.toBe(b)
    expect(cardCrabCells('light', '#1D9E75', 'done', 0, null, DONE)).toBe(cardCrabCells('light', '#1D9E75', 'done', 3, null, DONE))
    // Resting is still the done pose, not the walking costume.
    expect(cardCrabCells('light', '#1D9E75', 'done', 0, null, DONE)).not.toBe(cardCrabCells('light', '#1D9E75', 'failed', 0, null, DONE))
  })

  test('the band crab waves while the flow celebrates, then holds', () => {
    expect(miniCrabCells(0, 'party', 0x5fbf8f)).not.toBe(miniCrabCells(2, 'party', 0x5fbf8f))
    expect(miniCrabCells(0, 'rest', 0x5fbf8f)).toBe(miniCrabCells(3, 'rest', 0x5fbf8f))
  })

  test('the bar moves while work is out and holds once finished and settled', () => {
    const working = flowOf({})
    const at = (frame: number) => barCells(working, 60, 'Tasks 1/4', 0.25, ACCENT, { frame, isWorking: true, party: null })
    expect(at(0)).not.toBe(at(3))
    expect(at(5)).toBe(at(5))

    const finished = flowOf({ done: 4, running: 0, isFinished: true, phase: 'close' })
    const still = (frame: number) => barCells(finished, 60, 'Done', 1, 0x5fbf8f, { frame, isWorking: false, party: null })
    expect(still(0)).toBe(still(3))
    const party = (n: number) => barCells(finished, 60, 'Done', 1, 0x5fbf8f, { frame: 0, isWorking: false, party: n })
    expect(party(4)).not.toBe(party(12))
  })

  test('nothing moves without a running worker or a fresh finish', () => {
    const idle = flowOf({ running: 0 })
    expect(isMoving(null, [], 10_000, 0)).toBe(false)
    expect(isMoving(idle, [], 10_000, 0)).toBe(false)
    expect(isMoving(flowOf({}), [], 10_000, 0)).toBe(true)
    expect(isMoving(idle, [runOf({})], 10_000, 0)).toBe(true)
    expect(isMoving(idle, [runOf({ status: 'done', endedAt: 9_000 })], 10_000, 0)).toBe(true)
    expect(isMoving(idle, [runOf({ status: 'done', endedAt: 6_000 })], 10_000, 0)).toBe(false)
    expect(isMoving(idle, [runOf({ status: 'failed', endedAt: 9_000 })], 10_000, 0)).toBe(false)
    const closed = flowOf({ running: 0, isFinished: true })
    expect(isMoving(closed, [], 10_000, 8_000)).toBe(true)
    expect(isMoving(closed, [], 10_000, 6_000)).toBe(false)
  })

  test('the frame clock runs only while something moves', async ($, on) => {
    // A clock of the test's own, to see each timer the plugin asks for; a
    // period is held, never resolved, so a started clock shows up as one ask.
    const frames: number[] = []
    on('clock.now', () => ({ value: 1000 }))
    on('clock.every', ($, e) => {
      if (e.ms === FRAME_MS) frames.push(e.ms)
      return new Promise<never>(() => undefined)
    })
    world(on)
    // A kick reads the state before it asks for a timer: let those reads land.
    const settle = () => new Promise(done => setTimeout(done, 20))
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.tool.call(plan as never)
    await settle()
    expect(frames.length).toBe(0)

    await $.agent.spawn(spawn('Build the landing page', 'savvy-flow:savvy-light'))
    await settle()
    expect(frames.length).toBe(1)
  })
})

// What the session's registrations and the pane answer, so the hooks run to the end.
function world(on: On) {
  mock.env(on, {})
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', panes(true))
  on('agent.spawn', ($, e) => ({ model: 'claude-opus-5-5', agentId: `a-${e.description}` }))
}
