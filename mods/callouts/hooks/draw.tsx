// How callouts look: a yellow card in the transcript for what needs the person, a finished
// banner for DONE, and the band above the prompt that holds the open ones with their answers.
import type { Elements } from 'claude-code'

import type { Callout, CalloutKind, Palette } from '../types'

import { INK } from './palette'

type Table = Elements['terminal'] | Elements['desktop'] | Elements['vscode'] | Elements['mobile']

export const LABELS: Record<CalloutKind, string> = {
  action: '⚑  N E E D S   Y O U',
  ask: '?  Y O U R   C A L L',
  input: '✎  N E E D S   I N P U T',
  secret: '✱  K E Y   N E E D E D',
  done: '✓  D O N E',
}

/** One callout as it sits in the reply. */
export function calloutBlock(ui: Table, c: Callout, palette: Palette, key: string): JSX.Element {
  const { Box, Text } = ui
  if (c.kind === 'done') {
    return (
      <Box key={key} flexDirection="column" marginTop={1}>
        <Text key={`${key}-label`} color={palette.accent} bold>
          {LABELS.done}
        </Text>
        {c.title && (
          <Text key={`${key}-title`} color={palette.text} bold>
            {c.title}
          </Text>
        )}
        {c.body.map((line, i) => (
          <Text key={`${key}-body-${i}`} color={palette.text}>
            {line || ' '}
          </Text>
        ))}
      </Box>
    )
  }
  const hint =
    c.kind === 'action'
      ? 'Answer above the prompt: 1 Done'
      : c.kind === 'ask'
        ? 'Pick an answer above the prompt'
        : c.kind === 'secret'
          ? 'Paste it above the prompt. It goes into the file, never into the chat.'
          : 'Type it above the prompt'
  return (
    <Box key={key} flexDirection="column" marginTop={1} paddingX={1} backgroundColor={palette.accent}>
      <Text key={`${key}-label`} color={INK} backgroundColor={palette.accent} bold>
        {LABELS[c.kind]}
      </Text>
      <Text key={`${key}-title`} color={INK} backgroundColor={palette.accent} bold>
        {c.title}
      </Text>
      {c.body.map((line, i) => (
        <Text key={`${key}-body-${i}`} color={INK} backgroundColor={palette.accent}>
          {line || ' '}
        </Text>
      ))}
      {c.options.map((option, i) => (
        <Text key={`${key}-opt-${i}`} color={INK} backgroundColor={palette.accent}>
          {`  ${i + 1}  ${option}`}
        </Text>
      ))}
      <Text key={`${key}-hint`} color={INK} backgroundColor={palette.accent} italic>
        {hint}
      </Text>
    </Box>
  )
}

export type BandInput = {
  ui: Table
  open: Callout[]
  palette: Palette
  columns: number
  /** Dots to show for each SECRET's field, by its index in `open`. */
  masked: Record<number, number>
  /** Send `text` as the person's message for item `index`. */
  answer: (index: number, text: string) => void
  /** Drop item `index` without sending anything. */
  dismiss: (index: number) => void
  secretInput: (index: number, value: string) => void
  secretSubmit: (index: number) => void
}

const ICONS: Record<CalloutKind, string> = { action: '⚑', ask: '?', input: '✎', secret: '✱', done: '✓' }

/** `text` broken at spaces into lines of at most `width` cells; a word longer than that is split. */
export function wrapText(text: string, width: number): string[] {
  const room = Math.max(8, width)
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word
    while (rest.length > room) {
      if (line) lines.push(line)
      lines.push(rest.slice(0, room))
      line = ''
      rest = rest.slice(room)
    }
    if (!line) line = rest
    else if (line.length + 1 + rest.length <= room) line = `${line} ${rest}`
    else {
      lines.push(line)
      line = rest
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

/**
 * Everything still open, above the prompt: a yellow header with the count, then each item
 * in full, its question wrapped onto as many rows as it needs and each option on its own
 * row. Nothing is cut: a band taller than the room scrolls. The first item's buttons take
 * the hotkeys (1 to 9, x).
 */
export function band(p: BandInput): JSX.Element | null {
  const { Box, Text, Button, Input } = p.ui
  if (p.open.length === 0) return null
  const count = p.open.length
  const head = `⚑  ${count === 1 ? '1 THING NEEDS YOU' : `${count} THINGS NEED YOU`}`
  const width = Math.max(20, p.columns - 2)
  const chip = (text: string, strong = true): JSX.Element => (
    <Text color={strong ? INK : p.palette.muted} backgroundColor={strong ? p.palette.accent : undefined} bold={strong}>
      {` ${text} `}
    </Text>
  )
  const rows: JSX.Element[] = []
  for (const [i, c] of p.open.entries()) {
    const first = i === 0
    const hot = (key: string): { hotkey?: string } => (first ? { hotkey: key } : {})
    const later = (
      <Button key={`later-${i}`} {...hot('x')} onPress={() => p.dismiss(i)}>
        {chip(first ? 'x  Not now' : 'Not now', false)}
      </Button>
    )
    for (const [n, text] of wrapText(c.title, width - 2).entries()) {
      rows.push(
        <Box key={`title-${i}-${n}`} flexDirection="row" gap={1}>
          <Text color={p.palette.accent} bold>
            {n === 0 ? ICONS[c.kind] : ' '}
          </Text>
          <Text color={p.palette.text} bold={first}>
            {text}
          </Text>
        </Box>,
      )
    }
    if (c.kind === 'action') {
      rows.push(
        <Box key={`answers-${i}`} flexDirection="row" gap={2} paddingLeft={2}>
          <Button key={`done-${i}`} {...hot('1')} onPress={() => p.answer(i, `Done: ${c.title}`)}>
            {chip(first ? '1  Done' : 'Done')}
          </Button>
          {later}
        </Box>,
      )
    } else if (c.kind === 'ask') {
      for (const [n, option] of c.options.slice(0, 9).entries()) {
        const label = `${n + 1}`
        const lines = wrapText(option, width - 2 - (label.length + 2) - 1)
        rows.push(
          <Box key={`opt-${i}-${n}`} flexDirection="row" gap={1} paddingLeft={2}>
            <Button key={`opt-btn-${i}-${n}`} label={option} {...hot(label)} onPress={() => p.answer(i, option)}>
              {chip(label)}
            </Button>
            <Text color={p.palette.text}>{lines[0]}</Text>
          </Box>,
        )
        for (const [k, more] of lines.slice(1).entries()) {
          rows.push(
            <Box key={`opt-${i}-${n}-${k}`} flexDirection="row" paddingLeft={2 + label.length + 3}>
              <Text color={p.palette.text}>{more}</Text>
            </Box>,
          )
        }
      }
      rows.push(
        <Box key={`answers-${i}`} flexDirection="row" paddingLeft={2}>
          {later}
        </Box>,
      )
    } else if (c.kind === 'input') {
      rows.push(
        <Box key={`answers-${i}`} flexDirection="row" gap={2} paddingLeft={2}>
          <Input key={`input-${i}`} placeholder="type here" submitLabel="send" onSubmit={value => value.trim() && p.answer(i, value.trim())} />
          {later}
        </Box>,
      )
    } else if (c.kind === 'secret') {
      const where = c.secret ? `saved to ${c.secret.path}, never sent to the chat` : 'the title names no .env file, so it cannot be saved'
      rows.push(
        <Box key={`answers-${i}`} flexDirection="row" gap={2} paddingLeft={2}>
          {c.secret ? (
            <Input
              key={`secret-${i}`}
              placeholder="paste the key"
              value={'•'.repeat(p.masked[i] ?? 0)}
              submitLabel="save"
              onInput={value => p.secretInput(i, value)}
              onSubmit={() => p.secretSubmit(i)}
            />
          ) : null}
          {later}
        </Box>,
      )
      for (const [k, text] of wrapText(where, width - 2).entries()) {
        rows.push(
          <Box key={`where-${i}-${k}`} flexDirection="row" paddingLeft={2}>
            <Text color={p.palette.muted}>{text}</Text>
          </Box>,
        )
      }
    }
  }
  return (
    <Box key="callouts-band" flexDirection="column">
      <Box key="callout-head" flexDirection="row" paddingX={1} backgroundColor={p.palette.accent}>
        <Text color={INK} backgroundColor={p.palette.accent} bold>
          {head}
        </Text>
      </Box>
      {rows}
    </Box>
  )
}
