// A finished card's click target and, once open, what the agent did: a few dim
// plain lines, then each follow-up flagged in the callouts mod's yellow (it
// waits on the person) or violet (it only asks). No borders and no tables, so
// the open card stays a quiet note under the stats. Every surface draws it.
import type { Elements } from 'claude-code'

import type { AgentRun } from '../types'

import { clip, digestOf } from './summary'

type Parts = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

const BLOCKING = '#fde047'
const ASKING = '#a78bfa'

export const isFinished = (a: AgentRun): boolean => a.status === 'done' || a.status === 'failed'

// A card's title: for a finished run a plain Button whose glyph says whether
// its digest is open; a running one keeps its bold text.
export function cardTitle(ui: Parts, a: AgentRun, isOpen: boolean, width: number, onPress: () => void): JSX.Element {
  const { Button, Text } = ui
  if (!isFinished(a)) {
    return (
      <Text bold wrap="truncate-end">
        {a.description || a.type}
      </Text>
    )
  }
  return (
    <Button key={`open-${a.id}`} plain onPress={onPress}>
      {isOpen ? '▾' : '▸'} <Text bold>{clip(a.description || a.type, Math.max(4, width - 2))}</Text>
    </Button>
  )
}

// The open card's lines, indented to sit under the title past its glyph.
export function digestBlock(ui: Parts, a: AgentRun, width: number, empty: string): JSX.Element {
  const { Box, Text } = ui
  const d = digestOf(a, width - 2, empty)
  return (
    <Box key={`digest-${a.id}`} flexDirection="column" marginLeft={2}>
      {d.lines.map((line, i) => (
        <Text key={`sum-${a.id}-${i}`} dimColor>
          {line}
        </Text>
      ))}
      {d.follow.map((f, i) => (
        <Text key={`ask-${a.id}-${i}`} color={f.isBlocking ? BLOCKING : ASKING} wrap="truncate-end">
          ⚑ {f.text}
        </Text>
      ))}
    </Box>
  )
}
