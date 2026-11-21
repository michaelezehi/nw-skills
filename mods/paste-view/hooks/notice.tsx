// A task's notice or another agent's message as one compact row: a bar in the sender's colour
// (never the cyan of your own words), a chip naming who it is from, and the first line.
import type { RenderElement } from 'claude-code'

import { fit } from './parse'

export type NoticeProps = {
  text: string
  origin: { kind: string; name?: string }
  task?: { status?: string; type?: string; durationMs?: number }
  from?: { name: string }
}
export type Notice = { chip: string; color: string; mark: string; first: string; rest: number; duration: string }

export const AGENT = '#a78bfa'
export const DONE = '#4ade80'
export const FAILED = '#f87171'
export const STOPPED = '#fbbf24'
const INK = '#0b1417'
const TEXT = '#cfe9ee'
const MUTED = '#7fa3ab'

// Who a row with no sender name is from, by where it came from.
const LABELS: Record<string, string> = {
  'task-notification': 'task',
  'scheduled-trigger': 'schedule',
  peer: 'agent',
  'peer-send-message': 'agent',
  'projects-relay': 'project',
  channel: 'channel',
  coordinator: 'coordinator',
  'slack-ping': 'slack',
  plugin: 'mod',
}

export function durationOf(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

/** What the row says; null for a row this mod leaves to the engine. */
export function readNotice(p: NoticeProps): Notice | null {
  const label = p.from?.name ?? (p.origin.kind === 'plugin' ? p.origin.name : undefined) ?? LABELS[p.origin.kind]
  if (label === undefined) return null
  const lines = p.text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  const status = p.task?.status
  const [color, mark] =
    status === 'failed' ? [FAILED, '✖'] : status === 'killed' ? [STOPPED, '■'] : status === 'completed' ? [DONE, '✔'] : [AGENT, '◆']
  return {
    chip: label.length > 24 ? `${label.slice(0, 23)}…` : label,
    color,
    mark,
    first: lines[0] ?? '',
    rest: lines.length - 1,
    duration: p.task?.durationMs === undefined ? '' : durationOf(p.task.durationMs),
  }
}

type El = (props: Record<string, unknown>, ...children: unknown[]) => RenderElement

export function noticeRow(ui: { Box: El; Text: El }, n: Notice, room: number): RenderElement {
  const Box = ui.Box as never as (p: Record<string, unknown>) => JSX.Element
  const Text = ui.Text as never as (p: Record<string, unknown>) => JSX.Element
  const tail = [n.rest > 0 ? `+${n.rest} ${n.rest === 1 ? 'line' : 'lines'}` : '', n.duration].filter(Boolean).join(' · ')
  const width = room - n.chip.length - 8 - (tail ? tail.length + 2 : 0)
  return (
    <Box key="paste-view-notice" flexDirection="row" paddingLeft={2}>
      <Text color={n.color}>{'▎ '}</Text>
      <Text color={INK} backgroundColor={n.color} bold>{` ${n.chip} `}</Text>
      <Text color={n.color}>{` ${n.mark} `}</Text>
      <Text color={TEXT}>{fit(n.first, Math.max(20, width))}</Text>
      {tail ? <Text color={MUTED}>{`  ${tail}`}</Text> : ''}
    </Box>
  ) as never
}
