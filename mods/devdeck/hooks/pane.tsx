// The /devdeck pane: services, the last Convex calls and events, and the open
// errors, each one line until pressed, then its full body.
import type { Elements } from 'claude-code'

import type { Call, Err, Ev, Snap, Svc } from '../types'

import { AMBER, ASH, DOT, PAPER, RED, YELLOW, ageOf, badgeOf, fmtAge, fmtMem, fmtMs, statusColor } from './model'

type Table = Elements['terminal'] | Elements['desktop'] | Elements['vscode'] | Elements['mobile']

export type PaneInput = {
  ui: Table
  snap: Snap | null
  clock: number
  columns: number
  expanded: number[]
  toggle: (id: number) => void
}

export const NOT_RUNNING_PANE = 'Devdeck is not running in this project.'

const BADGE_COLOR: Record<string, string> = { Q: PAPER, M: YELLOW, A: AMBER, H: ASH }

const clip = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`

function section(ui: Table, key: string, title: string, rows: JSX.Element[], empty: string): JSX.Element {
  const { Box, Text } = ui
  return (
    <Box key={key} flexDirection="column" marginBottom={1}>
      <Text bold color={PAPER}>
        {title}
      </Text>
      {rows.length ? rows : <Text color={ASH}>{empty}</Text>}
    </Box>
  )
}

function serviceRow(ui: Table, p: PaneInput, snap: Snap, s: Svc): JSX.Element {
  const { Box, Text } = ui
  const reload =
    s.reloadAt === null
      ? ''
      : [s.reloadRoute, fmtMs(s.reloadMs), `${fmtAge(ageOf(snap, s.reloadAt, p.clock))} ago`].filter(Boolean).join(' ')
  return (
    <Box key={`svc-${s.id}`} flexDirection="row" gap={1}>
      <Text color={statusColor(s.status)} dimColor={s.status === 'stopped'}>
        {DOT}
      </Text>
      <Box width={12} flexShrink={0}>
        <Text wrap="truncate-end">{s.label}</Text>
      </Box>
      <Box width={6} flexShrink={0}>
        <Text color={ASH}>{s.port === null ? '' : `:${s.port}`}</Text>
      </Box>
      <Box width={9} flexShrink={0}>
        <Text color={statusColor(s.status)}>{s.status}</Text>
      </Box>
      <Box width={6} flexShrink={0}>
        <Text color={ASH}>{fmtMem(s.memMb)}</Text>
      </Box>
      <Box flexShrink={1}>
        <Text color={ASH} wrap="truncate-end">
          {reload}
        </Text>
      </Box>
    </Box>
  )
}

function callRow(ui: Table, c: Call): JSX.Element {
  const { Box, Text } = ui
  const badge = badgeOf(c.type)
  const color = c.ok ? undefined : RED
  return (
    <Box key={`call-${c.id}`} flexDirection="row" gap={1}>
      <Text bold color={c.ok ? (BADGE_COLOR[badge] ?? PAPER) : RED}>
        {badge}
      </Text>
      <Box flexShrink={1}>
        <Text color={color} wrap="truncate-end">
          {c.fn}
          {c.ok || !c.error ? '' : ` · ${c.error}`}
        </Text>
      </Box>
      <Box flexShrink={0}>
        <Text color={color ?? ASH}>{fmtMs(c.ms)}</Text>
      </Box>
    </Box>
  )
}

function eventRow(ui: Table, p: PaneInput, snap: Snap, ev: Ev): JSX.Element {
  const { Box, Text } = ui
  const color = ev.kind === 'error' || ev.kind === 'exit' ? RED : ev.kind === 'reload' ? AMBER : undefined
  return (
    <Box key={`ev-${ev.id}`} flexDirection="row" gap={1}>
      <Box width={4} flexShrink={0}>
        <Text color={ASH}>{fmtAge(ageOf(snap, ev.at, p.clock))}</Text>
      </Box>
      <Box width={8} flexShrink={0}>
        <Text color={ASH} wrap="truncate-end">
          {ev.service}
        </Text>
      </Box>
      <Box flexShrink={1}>
        <Text color={color} wrap="truncate-end">
          {[ev.text, fmtMs(ev.ms)].filter(Boolean).join(' ')}
        </Text>
      </Box>
    </Box>
  )
}

function errorRow(ui: Table, p: PaneInput, snap: Snap, e: Err): JSX.Element {
  const { Box, Text, Button } = ui
  const isOpen = p.expanded.includes(e.id)
  const age = fmtAge(ageOf(snap, e.at, p.clock))
  const label = clip(`${isOpen ? '▾' : '▸'} ${e.service} · ${e.title} · ${age}`, Math.max(10, p.columns - 2))
  return (
    <Box key={`errrow-${e.id}`} flexDirection="column">
      <Button key={`err-${e.id}`} label={label} plain onPress={() => p.toggle(e.id)} />
      {isOpen && (
        <Box key={`errbody-${e.id}`} flexDirection="column" paddingLeft={2}>
          {e.file && <Text color={ASH}>{e.file}</Text>}
          {e.body.map((line, i) => (
            <Text key={`errline-${e.id}-${i}`} color={RED}>
              {line || ' '}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

export function pane(p: PaneInput): JSX.Element {
  const { Box, Text } = p.ui
  const snap = p.snap
  if (snap === null) {
    return (
      <Box key="devdeck-pane" flexDirection="column">
        <Text color={ASH}>{NOT_RUNNING_PANE}</Text>
      </Box>
    )
  }

  const calls = [...snap.calls].reverse().map(c => callRow(p.ui, c))
  const events = [...snap.events].reverse().map(ev => eventRow(p.ui, p, snap, ev))
  const errors = [...snap.errors].reverse().map(e => errorRow(p.ui, p, snap, e))

  return (
    <Box key="devdeck-pane" flexDirection="column">
      {section(p.ui, 'services', `Services · ${fmtMem(snap.memMb)}`, snap.services.map(s => serviceRow(p.ui, p, snap, s)), 'No services.')}
      {section(p.ui, 'calls', 'Convex calls', calls, 'No calls yet.')}
      {section(p.ui, 'events', 'Events', events, 'No events yet.')}
      {section(p.ui, 'errors', snap.errorCount ? `Errors · ${snap.errorCount}` : 'Errors', errors, 'No errors.')}
    </Box>
  )
}
