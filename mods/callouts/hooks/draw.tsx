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
  const hint = c.kind === 'action' ? 'Answer above the prompt: 1 Done' : c.kind === 'ask' ? 'Pick an answer above the prompt' : 'Type it above the prompt'
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
  /** Send `text` as the person's message. */
  answer: (index: number, text: string) => void
  /** Drop the callout without sending anything. */
  dismiss: (index: number) => void
}

/** The open callouts above the prompt: the first with its answers, the rest counted. */
export function band(p: BandInput): JSX.Element | null {
  const { Box, Text, Button, Input } = p.ui
  const c = p.open[0]
  if (!c || p.maxRows < 2) return null
  const more = p.open.length - 1
  const icon = LABELS[c.kind].charAt(0)
  const head = `${icon} ${more > 0 ? `${p.open.length} THINGS NEED YOU` : c.kind === 'ask' ? 'YOUR CALL' : 'NEEDS YOU'}`
  const chip = (text: string): JSX.Element => (
    <Text color={INK} backgroundColor={p.palette.accent} bold>
      {` ${text} `}
    </Text>
  )
  const later = (
    <Button key="callout-later" hotkey="x" onPress={() => p.dismiss(0)}>
      <Text color={p.palette.muted}> Not now </Text>
    </Button>
  )
  const answers =
    c.kind === 'action' ? (
      <Box key="callout-answers" flexDirection="row" gap={2}>
        <Button key="callout-done" hotkey="1" onPress={() => p.answer(0, `Done: ${c.title}`)}>
          {chip('1  Done')}
        </Button>
        {later}
      </Box>
    ) : c.kind === 'ask' ? (
      <Box key="callout-answers" flexDirection="row" gap={2}>
        {c.options.slice(0, 9).map((option, i) => (
          <Button key={`callout-opt-${i}`} hotkey={String(i + 1)} onPress={() => p.answer(0, option)}>
            {chip(`${i + 1}  ${clip(option, 30)}`)}
          </Button>
        ))}
        {later}
      </Box>
    ) : (
      <Box key="callout-answers" flexDirection="row" gap={2}>
        <Input key="callout-input" placeholder={clip(c.title, 60)} submitLabel="send" onSubmit={value => value.trim() && p.answer(0, value.trim())} />
        {later}
      </Box>
    )
  return (
    <Box key="callouts-band" flexDirection="column">
      <Box key="callout-head" flexDirection="row" paddingX={1} backgroundColor={p.palette.accent}>
        <Text color={INK} backgroundColor={p.palette.accent} bold>
          {clip(`${head}  ·  ${c.title}`, Math.max(10, p.columns - 2))}
        </Text>
      </Box>
      {p.maxRows >= 2 && answers}
    </Box>
  )
}
