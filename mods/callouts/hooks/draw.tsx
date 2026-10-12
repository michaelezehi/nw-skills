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

const clip = (text: string, width: number): string => (text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`)

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
  maxRows: number
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

/** Rows one item takes: its line, plus a line for options or a field. */
const rowsOf = (c: Callout): number => (c.kind === 'action' ? 1 : 2)

/**
 * Everything still open, above the prompt: a yellow header with the count, then one block
 * per item with its own answer. The first item's buttons take the hotkeys (1 to 9, x).
 */
export function band(p: BandInput): JSX.Element | null {
  const { Box, Text, Button, Input } = p.ui
  if (p.open.length === 0 || p.maxRows < 2) return null
  const count = p.open.length
  const head = `⚑  ${count === 1 ? '1 THING NEEDS YOU' : `${count} THINGS NEED YOU`}`
  const chip = (text: string, strong = true): JSX.Element => (
    <Text color={strong ? INK : p.palette.muted} backgroundColor={strong ? p.palette.accent : undefined} bold={strong}>
      {` ${text} `}
    </Text>
  )
  const rows: JSX.Element[] = []
  let used = 1
  let shown = 0
  for (const [i, c] of p.open.entries()) {
    if (used + rowsOf(c) > p.maxRows - (i < count - 1 ? 1 : 0)) break
    used += rowsOf(c)
    shown += 1
    const first = i === 0
    const hot = (key: string): { hotkey?: string } => (first ? { hotkey: key } : {})
    const later = (
      <Button key={`later-${i}`} {...hot('x')} onPress={() => p.dismiss(i)}>
        {chip(first ? 'x  Not now' : 'Not now', false)}
      </Button>
    )
    const titleRoom = Math.max(10, p.columns - (c.kind === 'action' ? 30 : 4))
    const line = (
      <Box key={`line-${i}`} flexDirection="row" gap={1}>
        <Text color={p.palette.accent} bold>
          {ICONS[c.kind]}
        </Text>
        <Text color={p.palette.text} bold={first}>
          {clip(c.title, titleRoom)}
        </Text>
        {c.kind === 'action' && (
          <Button key={`done-${i}`} {...hot('1')} onPress={() => p.answer(i, `Done: ${c.title}`)}>
            {chip(first ? '1  Done' : 'Done')}
          </Button>
        )}
        {c.kind === 'action' && later}
      </Box>
    )
    rows.push(line)
    if (c.kind === 'ask') {
      rows.push(
        <Box key={`answers-${i}`} flexDirection="row" gap={2} paddingLeft={2}>
          {c.options.slice(0, 9).map((option, n) => (
            <Button key={`opt-${i}-${n}`} {...hot(String(n + 1))} onPress={() => p.answer(i, option)}>
              {chip(`${n + 1}  ${clip(option, 28)}`)}
            </Button>
          ))}
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
          <Text color={p.palette.muted}>{where}</Text>
          {later}
        </Box>,
      )
    }
  }
  if (shown < count) {
    rows.push(
      <Text key="more" color={p.palette.muted}>
        {`  +${count - shown} more; answer these first`}
      </Text>,
    )
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
