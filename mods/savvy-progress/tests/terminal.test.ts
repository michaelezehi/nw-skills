import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, RenderPropsOf } from 'claude-code'

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
