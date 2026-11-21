// readout: a reply's run of `**label:** text` lines draws as folded cards. Each card shows its
// label chip and a one-line summary; a click opens the rest, drawn by the engine so inline code
// and links keep their look. While a card is open the others go quiet in zinc. A label that
// names a failure gets a warning icon and a red border. A single labelled line stays markdown.
import { atom, memberOf, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { parseReadouts, plainOf, summaryOf, toneOf } from './parse'

/** The chip colours, in order; each reads on a dark terminal. */
export const NEON = ['#5eead4', '#a78bfa', '#f472b6', '#fbbf24', '#60a5fa', '#4ade80', '#fb923c', '#e879f9']
export const ZINC = { line: '#3f3f46', quiet: '#71717a', chip: '#52525b' }
const INK = '#0b1417'
const FG = '#e4e4e7'
const ERROR = '#f87171'
const LABEL_MAX = 24

const openAtom = atom({ plugin: 'readout', key: 'open' } as const, [] as string[])

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const segments = parseReadouts(e.props.text)
    if (!segments.some(s => s.kind === 'readout')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const opened = memberOf(openAtom, e)
    const open = new Set(await read($, opened))
    const toggle = (key: string) => void update($, opened, keys => (keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]))
    const parts: JSX.Element[] = []

    for (const [i, s] of segments.entries()) {
      if (s.kind === 'markdown') {
        parts.push(<Box key={`md-${i}`}>{await next({ ...e, props: { ...e.props, text: s.text } })}</Box>)
        continue
      }
      const width = Math.min(LABEL_MAX, Math.max(...s.rows.map(r => r.label.length))) + 2
      const anyOpen = s.rows.some((_, j) => open.has(`${i}-${j}`))
      const cards: JSX.Element[] = []
      for (const [j, r] of s.rows.entries()) {
        const key = `${i}-${j}`
        const isOpen = open.has(key)
        const isQuiet = anyOpen && !isOpen
        const isAlert = toneOf(r.label) === 'error'
        const muted = toneOf(r.label) === 'muted'
        const color = isAlert ? ERROR : muted ? ZINC.chip : NEON[j % NEON.length]!
        const summary = summaryOf(r.text)
        const hasMore = summary !== plainOf(r.text)
        const chevron = hasMore ? (isOpen ? '▾' : '▸') : ' '
        cards.push(
          <Box
            key={`card-${key}`}
            flexDirection="column"
            borderStyle="round"
            borderColor={isAlert && !isQuiet ? ERROR : ZINC.line}
            paddingX={1}
          >
            <Box flexDirection="row" gap={1}>
              <Box flexShrink={0}>
                <Text color={isQuiet ? ZINC.quiet : color}>{isAlert ? '⚠' : chevron}</Text>
              </Box>
              <Box flexShrink={0} width={width}>
                <Text color={isQuiet ? FG : INK} backgroundColor={isQuiet ? ZINC.line : color} bold wrap="truncate-end">
                  {` ${r.label} `}
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                {hasMore ? (
                  <Button key={`fold-${key}`} label={isOpen ? summary : `${summary}  ···`} plain dimColor={isQuiet} onPress={() => toggle(key)} />
                ) : (
                  <Text color={isQuiet ? ZINC.quiet : FG} wrap="truncate-end">
                    {summary}
                  </Text>
                )}
              </Box>
            </Box>
            {isOpen && hasMore && (
              <Box key={`body-${key}`} marginTop={1} paddingLeft={2}>
                {await next({ ...e, props: { ...e.props, text: r.text } })}
              </Box>
            )}
          </Box>,
        )
      }
      parts.push(
        <Box key={`readout-${i}`} flexDirection="column" marginY={1}>
          {cards}
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
