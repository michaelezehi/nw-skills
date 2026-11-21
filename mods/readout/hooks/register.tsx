// readout: a reply's run of `**label:** text` lines draws as one framed table, a neon colour
// per row, the label in its colour beside a bar and the text drawn by the engine, so inline
// code and links keep their look. A single labelled line stays plain markdown.
import type { Register } from 'claude-code'

import { parseReadouts, toneOf } from './parse'

/** The row colours, in order; each reads on a dark terminal and none is the frame's. */
export const NEON = ['#5eead4', '#a78bfa', '#f472b6', '#fbbf24', '#60a5fa', '#4ade80', '#fb923c', '#e879f9']
const FRAME = '#2b5f6b'
const TITLE = '#67e8f9'
const ERROR = '#f87171'
const MUTED = '#8a887f'
const LABEL_MAX = 24

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const segments = parseReadouts(e.props.text)
    if (!segments.some(s => s.kind === 'readout')) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const parts: JSX.Element[] = []

    for (const [i, s] of segments.entries()) {
      if (s.kind === 'markdown') {
        parts.push(<Box key={`md-${i}`}>{await next({ ...e, props: { ...e.props, text: s.text } })}</Box>)
        continue
      }
      const width = Math.min(LABEL_MAX, Math.max(...s.rows.map(r => r.label.length))) + 2
      const rows: JSX.Element[] = []
      for (const [j, r] of s.rows.entries()) {
        const tone = toneOf(r.label)
        const color = tone === 'error' ? ERROR : tone === 'muted' ? MUTED : NEON[j % NEON.length]!
        const body = r.text ? await next({ ...e, props: { ...e.props, text: r.text } }) : null
        rows.push(
          <Box key={`row-${i}-${j}`} flexDirection="row" gap={1}>
            <Box flexShrink={0}>
              <Text color={color}>▍</Text>
            </Box>
            <Box flexShrink={0} width={width}>
              <Text color={color} bold>
                {r.label}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              {body}
            </Box>
          </Box>,
        )
      }
      parts.push(
        <Box key={`readout-${i}`} flexDirection="column" marginY={1} paddingX={1} gap={1} borderStyle="round" borderColor={FRAME}>
          <Box flexDirection="row" gap={1}>
            <Text color={TITLE} bold>
              ◢ R E A D O U T
            </Text>
            <Text color={FRAME}>{`· ${s.rows.length}`}</Text>
          </Box>
          {rows}
        </Box>,
      )
    }
    return (
      <Box key="readout-message" flexDirection="column">
        {parts}
      </Box>
    )
  })
}
