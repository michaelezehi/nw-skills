import { describe, expect, test } from 'claude-code/testing'

import { AGENT, DONE, FAILED, STOPPED, durationOf, readNotice } from '../hooks/notice'
import { ACCENT } from '../hooks/register'

const REPORT = 'Built paste-view at ~/.claude/mods/paste-view.\n\nTests: 14 pass, 0 fail.\nOpen risk: clash with skins.'

describe('reading a notice', () => {
  test('the sender, the status and the first line', () => {
    const n = readNotice({ text: REPORT, origin: { kind: 'task-notification' }, task: { status: 'completed', durationMs: 122000 }, from: { name: 'Explore' } })
    expect(n).toEqual({ chip: 'Explore', color: DONE, mark: '✔', first: 'Built paste-view at ~/.claude/mods/paste-view.', rest: 2, duration: '2m 2s' })
    expect(readNotice({ text: 'x', origin: { kind: 'task-notification' }, task: { status: 'failed' } })?.color).toBe(FAILED)
    expect(readNotice({ text: 'x', origin: { kind: 'task-notification' }, task: { status: 'killed' } })?.color).toBe(STOPPED)
    expect(readNotice({ text: 'x', origin: { kind: 'task-notification' } })?.chip).toBe('task')
  })

  test('a message with no task reads in the agent colour; a row from nobody is left alone', () => {
    expect(readNotice({ text: 'New requirement from the owner', origin: { kind: 'coordinator' } })).toMatchObject({ chip: 'coordinator', color: AGENT, mark: '◆' })
    expect(readNotice({ text: 'sync done', origin: { kind: 'plugin', name: 'devdeck' } })?.chip).toBe('devdeck')
    expect(readNotice({ text: 'Continue', origin: { kind: 'auto-continuation' } })).toBeNull()
    expect(readNotice({ text: '  \n ', origin: { kind: 'peer' } })).toBeNull()
    expect([durationOf(4200), durationOf(3725000)]).toEqual(['4s', '1h 2m'])
  })
})

describe('draw', () => {
  type Ui = { find: (q: object) => Promise<{ text?: string; props: Record<string, unknown> } | undefined> }
  const mount = ($: unknown, props: object) =>
    ($ as { ui: { mount: (a: never) => Promise<Ui> } }).ui.mount({ plugin: 'paste-view', surface: 'terminal', component: 'UserMessage', props: { isExpanded: false, ...props } } as never)

  test("a finished agent's report is one row: bar, chip, first line, what is left and how long", async ($, on) => {
    let engineDrew = 0
    on('ui.render', () => (engineDrew++, { type: 'Box', props: { key: 'engine-own' } }))
    const ui = await mount($, { text: REPORT, origin: { kind: 'task-notification' }, task: { status: 'completed', durationMs: 122000 }, from: { name: 'Explore' } })

    expect((await ui.find({ type: 'Text', text: /^ Explore $/ }))?.props.backgroundColor).toBe(DONE)
    const bar = await ui.find({ type: 'Text', text: /^▎ $/ })
    expect(bar?.props.color).toBe(DONE)
    expect(bar?.props.color).not.toBe(ACCENT)
    expect(await ui.find({ type: 'Text', text: /^Built paste-view at ~\/\.claude\/mods\/paste-view\.$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {2}\+2 lines · 2m 2s$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^you$/ })).toBeUndefined()
    expect(engineDrew).toBe(0)
  })

  test("another agent's message takes the violet bar, and a failed task the red one", async ($, on) => {
    on('ui.render', () => ({ type: 'Box', props: { key: 'engine-own' } }))
    const msg = await mount($, { text: 'The owner chose to build all four fixes.', origin: { kind: 'coordinator' } })
    expect((await msg.find({ type: 'Text', text: /^▎ $/ }))?.props.color).toBe(AGENT)
    expect((await msg.find({ type: 'Text', text: /^ coordinator $/ }))?.props.backgroundColor).toBe(AGENT)

    const failed = await mount($, { text: 'Background shell exited with code 1', origin: { kind: 'task-notification' }, task: { status: 'failed' } })
    expect((await failed.find({ type: 'Text', text: /^ ✖ $/ }))?.props.color).toBe(FAILED)
  })

  test('ctrl+o keeps the full row the engine draws', async ($, on) => {
    let engineDrew = 0
    on('ui.render', () => (engineDrew++, { type: 'Box', props: { key: 'engine-own' } }))
    const ui = await mount($, { text: REPORT, origin: { kind: 'task-notification' }, from: { name: 'Explore' }, isExpanded: true })
    expect(await ui.find({ type: 'Text', text: /^ Explore $/ })).toBeUndefined()
    expect(engineDrew).toBe(1)
  })
})
