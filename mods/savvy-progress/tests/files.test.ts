import { describe, expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, RenderPropsOf } from 'claude-code'

import { keepFilesShut } from '../hooks/files'

const pane = { title: 'Agents', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 } } as unknown as RenderPropsOf['Pane']

const mountPane = ($: Parameters<Parameters<typeof test>[1]>[0]) =>
  $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane } as never)

describe('files', () => {
  test('an edit opens the strip under the agents and it closes itself once quiet', async ($, on) => {
    const clock = mock.clock(on)
    on('session.cwd', () => ({ value: '/work' }))
    on('tool.call', () => ({ result: 'ok' }))
    await $.tool.call({ tool: 'Edit', file_path: '/work/src/app.ts', old_string: 'a', new_string: 'b' } as never)
    await clock.settle()

    const panel = await mountPane($)
    expect(await panel.find({ type: 'Text', text: /src\/app\.ts/ })).toBeDefined()
    expect(await panel.find({ type: 'Text', text: /1 edited/ })).toBeDefined()

    await clock.advance(9_000)
    expect(await panel.find({ type: 'Text', text: /src\/app\.ts/ })).toBeUndefined()
  })

  test('a failed commit shows as failed, and hide closes the strip until the next touch', async ($, on) => {
    const clock = mock.clock(on)
    on('session.cwd', () => ({ value: '/work' }))
    on('tool.call', () => ({ result: 'boom', isError: true }))
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"' } as never)
    await clock.settle()

    const panel = await mountPane($)
    expect(await panel.find({ type: 'Text', text: /commit failed/ })).toBeDefined()
    await panel.press({ key: 'files-hide' })
    expect(await panel.find({ type: 'Text', text: /commit failed/ })).toBeUndefined()

    await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
    await clock.settle()
    expect(await panel.find({ type: 'Text', text: /push failed/ })).toBeDefined()
  })

  test("the filetree mod's unasked open is kept shut only while the agents pane is up", async () => {
    const withPanes = (ids: string[]) => ({ ui: { panes: async () => ids.map(id => ({ id })) } }) as unknown as EngineInterface
    expect(await keepFilesShut(withPanes(['savvy-agents']), 'filetree', undefined, 'savvy-agents')).toBe(true)
    expect(await keepFilesShut(withPanes(['savvy-agents']), 'filetree', true, 'savvy-agents')).toBe(false)
    expect(await keepFilesShut(withPanes([]), 'filetree', undefined, 'savvy-agents')).toBe(false)
    expect(await keepFilesShut(withPanes(['savvy-agents']), 'diff', undefined, 'savvy-agents')).toBe(false)
  })
})
