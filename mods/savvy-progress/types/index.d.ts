export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
  /** The run's final answer, capped; what its digest is cut from. */
  report?: string
  /** Sent with the worker's last `step`; each wins over the report. */
  summary?: string
  followUp?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  autoOpenedFor: string
  /** Finished runs whose card is open to show its digest. */
  expanded: string[]
}

/** One file read, written or git action, as the strip under the agents lists it. */
export type FileTouch = {
  id: number
  kind: 'read' | 'write' | 'git' | 'failed'
  text: string
  at: number
}

export type FilesStrip = {
  log: FileTouch[]
  lastAt: number
  /** Kept open and taller until pressed again. */
  more: boolean
  /** The last touch when the person hid the strip; a newer one opens it again. */
  dismissedId: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      files: FilesStrip
    }
  }
}
