// How callouts look: a yellow card in the transcript for what blocks the person, a violet card
// for a question, a violet outline for something worth a look, a finished banner for DONE,
// and the band above the prompt that holds the open ones with their answers.
import type { Elements } from 'claude-code'

import type { Callout, CalloutKind, Palette } from '../types'

import { INK, VIOLET, fillOf } from './palette'

type Table = Elements['terminal'] | Elements['desktop'] | Elements['vscode'] | Elements['mobile']

export const LABELS: Record<CalloutKind, string> = {
  action: '⚑  N E E D S   Y O U',
  ask: '?  Y O U R   C A L L',
  input: '✎  N E E D S   I N P U T',
  secret: '✱  K E Y   N E E D E D',
  review: '◇  W O R T H   A   L O O K',
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
  if (c.kind === 'review') {
    return (
      <Box key={key} flexDirection="column" marginTop={1} paddingX={1} borderStyle="round" borderColor={VIOLET}>
        <Text key={`${key}-label`} color={VIOLET} bold>
          {LABELS.review}
        </Text>
        <Text key={`${key}-title`} color={palette.text} bold>
          {c.title}
        </Text>
        {c.body.map((line, i) => (
          <Text key={`${key}-body-${i}`} color={palette.text}>
            {line || ' '}
          </Text>
        ))}
        <Text key={`${key}-hint`} color={palette.muted} italic>
          Mark it seen above the prompt
        </Text>
      </Box>
    )
  }
  const fill = fillOf(c.kind, palette)
  const hint =
    c.kind === 'action'
      ? 'Answer above the prompt: Done'
      : c.kind === 'ask'
        ? 'Pick an answer above the prompt'
        : c.kind === 'secret'
          ? 'Paste it above the prompt. It goes into the file, never into the chat.'
          : 'Type it above the prompt'
  return (
    <Box key={key} flexDirection="column" marginTop={1} paddingX={1} backgroundColor={fill}>
      <Text key={`${key}-label`} color={INK} backgroundColor={fill} bold>
        {LABELS[c.kind]}
      </Text>
      <Text key={`${key}-title`} color={INK} backgroundColor={fill} bold>
        {c.title}
      </Text>
      {c.body.map((line, i) => (
        <Text key={`${key}-body-${i}`} color={INK} backgroundColor={fill}>
          {line || ' '}
        </Text>
      ))}
      {c.options.map((option, i) => (
        <Text key={`${key}-opt-${i}`} color={INK} backgroundColor={fill}>
          {`  ${String.fromCharCode(97 + i)}  ${option}`}
        </Text>
      ))}
      <Text key={`${key}-hint`} color={INK} backgroundColor={fill} italic>
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

const ICONS: Record<CalloutKind, string> = { action: '⚑', ask: '?', input: '✎', secret: '✱', review: '◇', done: '✓' }

/** Where each kind sits in the band: blockers, then questions, then things worth a look. */
const RANK: Record<CalloutKind, number> = { action: 0, secret: 1, ask: 2, input: 3, review: 4, done: 5 }

/** The header's tiers: which kinds each counts and how it reads for a count. */
const TIERS: { kinds: CalloutKind[]; icon: string; say: (n: number) => string }[] = [
  { kinds: ['action', 'secret'], icon: '⚑', say: n => `${n} ${n === 1 ? 'NEEDS' : 'NEED'} YOU` },
  { kinds: ['ask', 'input'], icon: '?', say: n => `${n} ${n === 1 ? 'QUESTION' : 'QUESTIONS'}` },
  { kinds: ['review'], icon: '◇', say: n => `${n} TO LOOK AT` },
]

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
 * Everything still open, above the prompt: a header with one chip per tier and its count,
 * then each item in full, blockers first, questions next, things worth a look last. Each
 * question wraps onto as many rows as it needs and each option sits on its own row. Nothing is cut: a band taller than the room scrolls. The first item's buttons take
 * the hotkeys: letters, which fire only while the band holds the focus (ctrl+x tab or a
 * click). Never digits: the engine lets a bare digit in an empty prompt press a band
 * Button, so a message starting "1." would answer the band instead of reaching the chat.
 */
export function band(p: BandInput): JSX.Element | null {
  const { Box, Text, Button, Input } = p.ui
  if (p.open.length === 0) return null
  const width = Math.max(20, p.columns - 2)
  // A chip with no fill is the quiet one: muted text, no background.
  const chip = (text: string, fill?: string): JSX.Element => (
    <Text color={fill ? INK : p.palette.muted} backgroundColor={fill} bold={fill !== undefined}>
      {` ${text} `}
    </Text>
  )
  const heads: JSX.Element[] = []
  for (const tier of TIERS) {
    const n = p.open.filter(c => tier.kinds.includes(c.kind)).length
    if (n === 0) continue
    const fill = fillOf(tier.kinds[0] ?? 'action', p.palette)
    heads.push(
      <Text key={`head-${tier.kinds[0]}`} color={INK} backgroundColor={fill} bold>
        {` ${tier.icon} ${tier.say(n)} `}
      </Text>,
    )
  }
  // Drawn in tier order, each keeping its index in `open`: the callbacks and keys use that one.
  const order = [...p.open.entries()].sort(([a, x], [b, y]) => RANK[x.kind] - RANK[y.kind] || a - b)
  const rows: JSX.Element[] = []
  for (const [at, [i, c]] of order.entries()) {
    const first = at === 0
    const fill = fillOf(c.kind, p.palette)
    const hot = (key: string): { hotkey?: string } => (first ? { hotkey: key } : {})
    const later = (
      <Button key={`later-${i}`} {...hot('x')} onPress={() => p.dismiss(i)}>
        {chip(first ? 'x  Not now' : 'Not now')}
      </Button>
    )
    for (const [n, text] of wrapText(c.title, width - 2).entries()) {
      rows.push(
        <Box key={`title-${i}-${n}`} flexDirection="row" gap={1}>
          <Text color={fill} bold>
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
          <Button key={`done-${i}`} {...hot('d')} onPress={() => p.answer(i, `Done: ${c.title}`)}>
            {chip(first ? 'd  Done' : 'Done', fill)}
          </Button>
          {later}
        </Box>,
      )
    } else if (c.kind === 'ask') {
      for (const [n, option] of c.options.slice(0, 9).entries()) {
        const label = String.fromCharCode(97 + n)
        const lines = wrapText(option, width - 2 - (label.length + 2) - 1)
        rows.push(
          <Box key={`opt-${i}-${n}`} flexDirection="row" gap={1} paddingLeft={2}>
            <Button key={`opt-btn-${i}-${n}`} label={option} {...hot(label)} onPress={() => p.answer(i, option)}>
              {chip(label, fill)}
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
    } else if (c.kind === 'review') {
      rows.push(
        <Box key={`answers-${i}`} flexDirection="row" paddingLeft={2}>
          <Button key={`seen-${i}`} {...hot('s')} onPress={() => p.dismiss(i)}>
            {chip(first ? 's  Seen' : 'Seen', fill)}
          </Button>
        </Box>,
      )
    }
  }
  return (
    <Box key="callouts-band" flexDirection="column">
      <Box key="callout-head" flexDirection="row" gap={1}>
        {heads}
      </Box>
      {rows}
    </Box>
  )
}
