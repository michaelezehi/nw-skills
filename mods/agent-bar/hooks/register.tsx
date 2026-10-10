import type { EngineInterface, Register } from 'claude-code'

const PROGRESS = 'mcp__savvy-progress__progress'
const FLOW = { plugin: 'savvy-progress', key: 'flow' } as const

type Row = { title: string; tier: string; isDone: boolean }

// The module's own memory of this session's rows; a reload starts it over.
const s = {
  lastPrompt: '',
  title: '',
  todos: [] as Row[],
  tasks: new Map<string, Row>(),
  agents: [] as Row[],
  agentRow: new Map<string, Row>(),
}

// savvy-progress only knows its own tiers; map ours onto them.
function tierOf(type: string, model: string | undefined): string {
  const bare = type.replace(/^[^:]*:/, '')
  if (bare.startsWith('savvy-')) return bare.slice('savvy-'.length)
  if (model === 'fable') return 'fable'
  if (model === 'sonnet' || model === 'haiku') return 'light'
  if (bare === 'Explore') return 'medium'
  return 'careful'
}

// "/plan Unframed ATS, HR, ..." -> "Unframed ATS, HR"
function titleOf(prompt: string): string {
  const words = prompt.replace(/^\/\S+\s*/, '').trim().split(/\s+/).slice(0, 5)
  return words.join(' ').replace(/[,.;:!?]+$/, '') || 'Working'
}

function rows(): Row[] {
  const seen = new Set<string>()
  return [...s.todos, ...s.tasks.values(), ...s.agents].filter(row => !seen.has(row.title) && seen.add(row.title))
}

function reset(): void {
  s.title = ''
  s.todos = []
  s.tasks = new Map()
  s.agents = []
  s.agentRow.clear()
}

// A skill that reports its own plan owns the bar: a running flow under
// another title is theirs, so this mod stays out of it.
async function isOwnedElsewhere($: EngineInterface): Promise<boolean> {
  const { value } = await $.state.get(FLOW)
  return Boolean(value && !value.isFinished && value.title !== s.title)
}

async function report($: EngineInterface): Promise<void> {
  const list = rows()
  if (list.length === 0) return
  if (s.title === '') s.title = titleOf(s.lastPrompt)
  if (await isOwnedElsewhere($)) return reset()

  const done = list.filter(row => row.isDone).length
  const isFinished = done === list.length
  const isDelegating = s.agents.some(row => !row.isDone)

  try {
    await $.tool.call({
      tool: PROGRESS,
      title: s.title,
      total: list.length,
      done,
      phase: isFinished ? 'close' : isDelegating ? 'delegate' : 'plan',
      tasks: list.map(row => ({ title: row.title, tier: row.tier })),
      ...(isFinished ? { finished: true } : {}),
    } as never)
  } catch {
    return
  }

  if (isFinished) reset()
}

export const register: Register = on => {
  on('prompt.submit', ($, e, next) => {
    if (!e.text.trim().startsWith('/agents-info')) s.lastPrompt = e.text

    return next(e)
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)

    if (!e.agentId && ran.deny === undefined) {
      s.todos = e.todos.map(todo => ({ title: todo.content, tier: 'careful', isDone: todo.status === 'completed' }))
      await report($)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    const id = /#?(\d+)/.exec(ran.text ?? '')?.[1]

    if (!e.agentId && ran.deny === undefined && id) {
      s.tasks.set(id, { title: e.subject, tier: 'careful', isDone: false })
      await report($)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    const row = s.tasks.get(e.taskId)

    if (!e.agentId && ran.deny === undefined && row && e.status) {
      if (e.status === 'deleted') s.tasks.delete(e.taskId)
      else s.tasks.set(e.taskId, { ...row, isDone: e.status === 'completed' })
      await report($)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (!e.agentId && !s.agents.some(row => row.title === e.description)) {
      const tier = tierOf(e.subagent_type ?? 'general-purpose', e.model)
      s.agents = [...s.agents, { title: e.description, tier, isDone: false }]
      await report($)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const row = s.agents.find(one => one.title === e.description)

    if (started.deny === undefined && started.agentId && row) s.agentRow.set(started.agentId, row)

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const agentId = e.agentId
    const row = agentId ? s.agentRow.get(agentId) : undefined

    if (agentId && row) {
      s.agents = s.agents.map(one => (one.title === row.title ? { ...one, isDone: true } : one))
      s.agentRow.delete(agentId)
      await report($)
    }

    return result
  })
}
