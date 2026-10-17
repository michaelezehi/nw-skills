import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, RenderPropsOf } from 'claude-code'

import { digestOf, digestRows } from '../hooks/summary'
import { paneRows } from '../hooks/terminal'

const REPORT = [
  '## Result',
  '',
  'Added the **digest** under each finished card, built from `summary.ts`. See [the brief](https://example.com/brief) for scope. It wraps to the pane.',
  '',
  '| File | Lines |',
  '|------|-------|',
  '| register.tsx | 869 |',
  '',
  '```ts',
  'const secret = `code`',
  '```',
  '',
  '> [!ACTION] Run the **migration** on staging.',
  '',
  '### Open questions',
  '- Should the toggle remember its state?',
  '- `paneRows` may overshoot by a row.',
  '',
  '## Notes',
  '- Not a follow-up.',
].join('\n')

const pane = { title: 'Agents', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 } } as unknown as RenderPropsOf['Pane']

const spawn = (description: string, subagentType: string) =>
  ({ prompt: 'x', description, subagentType, tool_use_id: `t-${description}`, background: true, fork: false }) as unknown as AgentSpawnInput

describe('digest', () => {
  test('a report full of markdown, a table and a code fence comes out as plain lines', () => {
    const d = digestOf({ report: REPORT }, 60)
    const all = [...d.lines, ...d.follow.map(f => f.text)].join('\n')
    expect(d.lines.join(' ')).toContain('Added the digest under each finished card, built from summary.ts.')
    expect(d.lines.length).toBeLessThanOrEqual(3)
    for (const mark of ['|', '`', '**', '#', '](', 'secret']) expect(all).not.toContain(mark)
    expect(d.lines.every(l => l.length <= 60)).toBe(true)
  })

  test('follow-ups come from an ACTION callout (blocking) and an open questions list (not)', () => {
    const d = digestOf({ report: REPORT }, 60)
    expect(d.follow).toEqual([
      { text: 'Run the migration on staging.', isBlocking: true },
      { text: 'Should the toggle remember its state?', isBlocking: false },
      { text: 'paneRows may overshoot by a row.', isBlocking: false },
    ])
  })

  test("the step tool's summary and follow-up win over the report", () => {
    const d = digestOf({ report: REPORT, summary: 'Shipped the digest.', followUp: 'Approve the release.' }, 60)
    expect(d.lines).toEqual(['Shipped the digest.'])
    expect(d.follow).toEqual([{ text: 'Approve the release.', isBlocking: true }])
    expect(digestOf({ summary: 'x', followUp: 'Pick a colour for the flag?' }, 60).follow[0]?.isBlocking).toBe(false)
  })

  test('nothing to go on says so', () => {
    expect(digestOf({}, 60)).toEqual({ lines: ['No report yet'], follow: [] })
  })

  test('paneRows grows by the rows an open card adds', () => {
    const base = { title: 'Kit', running: 0, finished: 2, planned: 0, isCompact: false, isDoneCollapsed: false }
    expect(paneRows({ ...base, open: 4 })).toBe(paneRows(base) + 4)
    expect(paneRows({ ...base, isDoneCollapsed: true, open: 4 })).toBe(paneRows({ ...base, isDoneCollapsed: true }))
  })

  test('a click on a finished card opens its digest and the pane grows to fit', async ($, on) => {
    mock.clock(on)
    const opens: number[] = []
    on('ui.open', ($, e) => {
      opens.push((e as { rows?: number }).rows ?? 0)
      return { value: { isPlaced: true } }
    })
    on('ui.panes', () => ({ value: [{ id: 'savvy-agents', title: 'Agents', isShown: true, isFocused: false, isPlaced: true }] }))
    on('agent.spawn', ($, e) => ({ model: 'claude-opus-5-5', agentId: `a-${e.description}` }))
    on('turn.complete', () => ({ text: REPORT }))

    await $.agent.spawn(spawn('Build the landing page', 'savvy-flow:savvy-light'))
    await $.turn.complete({ reason: 'answer', answer: REPORT, durationMs: 1, agentId: 'a-Build the landing page', turnId: 't1', isAborted: false } as never)

    const panel = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane } as never)
    expect(await panel.find({ type: 'Text', text: /Added the digest/ })).toBeUndefined()
    const before = opens.at(-1) ?? 0

    await panel.press({ key: 'open-a-Build the landing page' })
    expect(await panel.find({ type: 'Text', text: /Added the digest/ })).toBeDefined()
    expect(await panel.find({ type: 'Text', text: /⚑ Run the migration on staging\./ })).toBeDefined()
    expect(opens.at(-1) ?? 0).toBeGreaterThan(before)

    await panel.press({ key: 'open-a-Build the landing page' })
    expect(await panel.find({ type: 'Text', text: /Added the digest/ })).toBeUndefined()
  })

  test('the desktop rows and the text rows open the same digest', async ($, on) => {
    mock.clock(on)
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.panes', () => ({ value: [{ id: 'savvy-agents', title: 'Agents', isShown: true, isFocused: false, isPlaced: true }] }))
    on('agent.spawn', ($, e) => ({ model: 'claude-opus-5-5', agentId: `a-${e.description}` }))
    on('turn.complete', () => ({ text: REPORT }))
    await $.agent.spawn(spawn('Build the landing page', 'savvy-flow:savvy-light'))
    await $.turn.complete({ reason: 'answer', answer: REPORT, durationMs: 1, agentId: 'a-Build the landing page', turnId: 't1', isAborted: false } as never)

    for (const surface of ['desktop', 'mobile', 'vscode'] as const) {
      const panel = await $.ui.mount({ plugin: 'savvy-progress', surface, component: 'Pane', requestId: 'savvy-agents', props: pane } as never)
      const shown = () => panel.find({ type: 'Text', text: /Added the digest/ })
      expect(await shown()).toBeUndefined()
      await panel.press({ key: 'open-a-Build the landing page' })
      expect(await shown()).toBeDefined()
      await panel.press({ key: 'open-a-Build the landing page' })
    }
  })

  test("a worker's last step sends the summary and follow-up its card shows", async ($, on) => {
    mock.clock(on)
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.panes', () => ({ value: [{ id: 'savvy-agents', title: 'Agents', isShown: true, isFocused: false, isPlaced: true }] }))
    on('agent.spawn', ($, e) => ({ model: 'claude-opus-5-5', agentId: `a-${e.description}` }))
    on('turn.complete', () => ({ text: REPORT }))

    await $.agent.spawn(spawn('Fix the bar', 'savvy-flow:savvy-light'))
    const step = { tool: 'mcp__savvy-progress__step', agentId: 'a-Fix the bar', done: 3, total: 3 }
    await $.tool.call({ ...step, summary: 'Fixed the bar width.', followUp: 'Restart the session.' } as never)
    await $.turn.complete({ reason: 'answer', answer: REPORT, durationMs: 1, agentId: 'a-Fix the bar', turnId: 't2', isAborted: false } as never)

    const panel = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane } as never)
    await panel.press({ key: 'open-a-Fix the bar' })
    expect(await panel.find({ type: 'Text', text: /^Fixed the bar width\.$/ })).toBeDefined()
    expect((await panel.find({ type: 'Text', text: /Restart the session/ }))?.props.color).toBe('#fde047')
    expect(await panel.find({ type: 'Text', text: /Added the digest/ })).toBeUndefined()
  })
})

describe('digest safety and height', () => {
  test('a report quoting escape sequences shows none of them', () => {
    const report = 'Fixed the build. \u001b[31mred\u001b[0m and \u001b]52;c;aGk=\u0007 gone.\u0007'
    const d = digestOf({ report }, 60)
    expect(d.lines).toEqual(['Fixed the build. red and gone.'])
    expect(d.lines.join('')).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
  })

  test('the pane reckons a wrapping summary at its widest: three rows', () => {
    const summary = 'Moved the bar to eighth blocks and added a sheen. Tests pass.'
    expect(digestRows({ summary })).toBe(3)
    expect(digestOf({ summary }, 70).lines.length).toBe(1)
  })
})
