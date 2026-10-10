import { describe, expect, test } from 'claude-code/testing'

type Report = { title?: string; total?: number; done?: number; finished?: boolean; tasks?: { title: string; tier: string }[] }

describe('register', () => {
  test('todos and agents become rows on the bar with tiers and a done count', async ($, on) => {
    const reports: Report[] = []
    on('tool.call', ($, e) => {
      if (e.tool === 'mcp__savvy-progress__progress') reports.push(e as unknown as Report)
      return { result: 'ok', text: 'ok' }
    })

    await $.prompt.submit({ text: '/plan Unframed ATS, HR, emails', wait: false, origin: { kind: 'composer' } } as never).catch(() => undefined)

    await $.tool.call({ tool: 'TodoWrite', todos: [
      { content: 'Read the product', status: 'completed', activeForm: 'Reading' },
      { content: 'Draft the email', status: 'in_progress', activeForm: 'Drafting' },
    ] })
    await $.tool.call({ tool: 'Agent', description: 'Crush email paths', prompt: 'x', subagent_type: 'Explore' })

    const last = reports.at(-1)!
    expect(last.total).toBe(3)
    expect(last.done).toBe(1)
    expect(last.tasks?.map(t => t.title)).toEqual(['Read the product', 'Draft the email', 'Crush email paths'])
    expect(last.tasks?.[2]?.tier).toBe('medium')
    expect(last.finished).toBe(undefined)
  })
})
