// paste-view: reads logs for you. A pasted log in your prompt draws as a log card (what it is, how long, where it
// failed) and your own words draw under it as a chat line with a cyan bar, so the question is
// the first thing you find. A prompt with no paste gets the same chat line.
import type { Register } from 'claude-code'

import { noticeRow, readNotice } from './notice'
import { errorCount, fit, parsePrompt, planRows, segmentsOf, wrapWords, type Paste, type Tone } from './parse'
import { readShell, retone, summarize, type Node } from './shell'
import { shellStrip } from './shell-view'

export const ACCENT = '#67e8f9'
export const FG = '#f0fdff'
export const MUTED = '#7fa3ab'
export const LINK = '#60a5fa'
const LOG_FG = '#cfe9ee'
const VIOLET = '#a78bfa'
export const TONES: Record<Tone, string> = {
  error: '#f87171',
  warn: '#fbbf24',
  muted: MUTED,
  pointer: '#f472b6',
  add: '#4ade80',
  del: '#f87171',
  hunk: VIOLET,
  plain: LOG_FG,
}
const GLYPH: Record<Paste['kind'], string> = { log: '▤', 'stack trace': '≡', diff: '±', JSON: '{}', code: '‹›', text: '¶' }
// The prompts a person wrote, as against a task's notice or another agent's message.
const TYPED = new Set(['composer', 'bridge', 'sdk'])
const INDENT = 2
const SHELLS = new Set(['Bash', 'PowerShell'])

export const register: Register = on => {
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    if (!TYPED.has(e.props.origin.kind)) {
      // ctrl+o keeps the engine's full row; the compact one is for the transcript.
      const notice = e.props.isExpanded ? null : readNotice(e.props)
      if (notice === null) return next(e)
      return noticeRow($.ui.resolve(e) as never, notice, Math.max(30, (e.viewport?.columns ?? 100) - 6))
    }
    const prompt = parsePrompt(e.props.text)
    const isEmpty = prompt.pastes.length === 0 && !prompt.words && prompt.images.length === 0 && prompt.folded.length === 0
    if (isEmpty) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const room = Math.max(30, (e.viewport?.columns ?? 100) - INDENT - 4)

    const card = (paste: Paste, index: number): JSX.Element => {
      const rows = planRows(paste, e.props.isExpanded)
      const digits = String(paste.lines.length).length
      const width = room - digits - 4
      const errors = errorCount(paste)
      const count = paste.lines.length
      return (
        <Box key={`paste-${index}`} flexDirection="column" marginTop={1}>
          <Box flexDirection="row">
            <Text color={ACCENT} bold>{`${GLYPH[paste.kind]} ${paste.kind} `}</Text>
            <Text color={MUTED}>{`· ${count} ${count === 1 ? 'line' : 'lines'}`}</Text>
            {errors > 0 ? <Text color={TONES.error} bold>{` · ${errors} ${errors === 1 ? 'error' : 'errors'}`}</Text> : ''}
          </Box>
          {rows.map((row, i) => {
            if (row.type === 'gap') {
              const lines = `${row.hidden} ${row.hidden === 1 ? 'line' : 'lines'} hidden`
              return (
                <Box key={`gap-${i}`} flexDirection="row">
                  <Text color={MUTED}>{`┊ ${' '.repeat(digits)}  `}</Text>
                  <Text color={MUTED} italic>{lines}</Text>
                  {row.errors > 0 ? <Text color={TONES.error} italic>{`, ${row.errors} with errors`}</Text> : ''}
                </Box>
              )
            }
            const color = TONES[row.tone]
            const isLoud = row.tone === 'error' || row.tone === 'pointer'
            return (
              <Box key={`line-${i}`} flexDirection="row">
                <Text color={isLoud ? color : MUTED}>{isLoud ? '┃ ' : '│ '}</Text>
                <Text color={isLoud ? color : MUTED}>{`${String(row.n).padStart(digits)}  `}</Text>
                {segmentsOf(fit(row.text, width)).map((s, j) =>
                  s.isLink && row.tone !== 'error' && row.tone !== 'pointer' ? (
                    <Text key={`s-${j}`} color={LINK}>{s.text}</Text>
                  ) : (
                    <Text key={`s-${j}`} color={color} bold={isLoud && s.isLink}>{s.text}</Text>
                  ),
                )}
              </Box>
            )
          })}
        </Box>
      )
    }

    const chips = [...prompt.images.map(n => `image ${n}`), ...prompt.folded.map(f => f.toLowerCase())]
    const hasBubble = Boolean(prompt.words) || chips.length > 0
    const bar = <Text color={ACCENT}>{'▎ '}</Text>
    const bubble = hasBubble ? (
      <Box key="you" flexDirection="column" marginY={1}>
        <Box flexDirection="row">
          {bar}
          <Text color={MUTED}>you</Text>
        </Box>
        {(prompt.words ? wrapWords(prompt.words, room) : []).map((line, i) => (
          <Box key={`w-${i}`} flexDirection="row">
            {bar}
            <Text color={FG}>{line || ' '}</Text>
          </Box>
        ))}
        {chips.length > 0 ? (
          <Box flexDirection="row" gap={1}>
            {bar}
            {chips.map((c, i) => (
              <Text key={`chip-${i}`} color={VIOLET}>{`▣ ${c}`}</Text>
            ))}
          </Box>
        ) : (
          ''
        )}
      </Box>
    ) : (
      <Box key="you-none" height={1} />
    )

    return (
      <Box key="paste-view" flexDirection="column" paddingLeft={INDENT}>
        {prompt.pastes.map(card)}
        {bubble}
      </Box>
    )
  })

  // A shell result keeps the card beneath (the skin's, or Claude Code's own). This only adds:
  // its lines take their tones, and a strip above says how it failed and what the fold hides.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !SHELLS.has(e.props.tool)) return next(e)
    const shell = readShell(e.props.output, e.props.isErrored)
    if (shell === null || shell.lines.length === 0) return next(e)
    const beneath = await next(e)
    const sum = summarize(shell.lines, e.props.isErrored)
    if (!e.props.isErrored && sum.errors === 0) return beneath
    const ui = $.ui.resolve(e)
    const { Box } = ui
    const room = Math.max(30, (e.viewport?.columns ?? 100) - 6)
    const card = retone(beneath as Node, shell.lines, TONES, e.props.isErrored) as typeof beneath
    const strip = shellStrip(ui as never, shell, sum, e.props.isErrored, e.props.isExpanded === true, room, TONES)
    if (strip === null) return card
    return (
      <Box key="paste-view-result" flexDirection="column">
        {strip}
        {card}
      </Box>
    )
  })
}
