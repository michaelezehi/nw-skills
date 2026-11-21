// The strip paste-view adds above a shell result: how it ended and the line that says why,
// then the error lines the output's fold hides. The card under it stays whoever drew it.
import type { RenderElement } from 'claude-code'

import { fit } from './parse'
import type { ShellRead, Summary } from './shell'

type Colors = { error: string; pointer: string; muted: string }
type El = (props: Record<string, unknown>, ...children: unknown[]) => RenderElement
type Ui = { Box: El; Text: El }

export function shellStrip(ui: Ui, read: ShellRead, sum: Summary, isErrored: boolean, isExpanded: boolean, room: number, c: Colors): RenderElement | null {
  const Box = ui.Box as never as (p: Record<string, unknown>) => JSX.Element
  const Text = ui.Text as never as (p: Record<string, unknown>) => JSX.Element
  const rows = isExpanded ? [] : sum.hidden
  if (!isErrored && rows.length === 0) return null
  const digits = String(read.lines.length).length
  const status = read.exitCode === null ? '✖ failed' : `✖ exit ${read.exitCode}`
  const head = isErrored ? status : `▤ ${rows.length + sum.more} error ${rows.length + sum.more === 1 ? 'line' : 'lines'} inside the fold`
  return (
    <Box key="paste-view-shell" flexDirection="column">
      <Box flexDirection="row">
        <Text color={c.error} bold>{head}</Text>
        {isErrored && sum.last ? <Text color={c.error}>{`  ${fit(sum.last.trim(), room - status.length - 2)}`}</Text> : ''}
      </Box>
      {sum.more > 0 && rows.length > 0 ? (
        <Box flexDirection="row">
          <Text color={c.muted}>{`┊ ${' '.repeat(digits)}  `}</Text>
          <Text color={c.muted} italic>{`${sum.more} earlier error ${sum.more === 1 ? 'line' : 'lines'}, ctrl+o shows all`}</Text>
        </Box>
      ) : (
        ''
      )}
      {rows.map((r, i) => (
        <Box key={`f-${i}`} flexDirection="row">
          <Text color={c[r.tone === 'pointer' ? 'pointer' : 'error']}>{'┃ '}</Text>
          <Text color={c.muted}>{`${String(r.n).padStart(digits)}  `}</Text>
          <Text color={c[r.tone === 'pointer' ? 'pointer' : 'error']}>{fit(r.text, room - digits - 4)}</Text>
        </Box>
      ))}
    </Box>
  ) as never
}
