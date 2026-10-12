// Finds callout blocks in a reply's markdown. A block is a run of quoted lines whose first
// reads `> [!ACTION] title` (or ASK, INPUT, DONE). Everything else stays markdown, in order.
import type { Callout, CalloutKind } from '../types'

export type Segment = { kind: 'markdown'; text: string } | { kind: 'callout'; callout: Callout }

const MARKER = /^\s*>\s*\[!(ACTION|ASK|INPUT|DONE)\][ \t]*(.*)$/i
const QUOTED = /^\s*>/
const ITEM = /^[-*]\s+(.+)$/

/** The reply split into markdown and callouts. One markdown segment when it holds none. */
export function parseCallouts(text: string): Segment[] {
  const lines = text.split('\n')
  const out: Segment[] = []
  let prose: string[] = []
  const flush = (): void => {
    const md = prose.join('\n').replace(/^\n+|\n+$/g, '')
    if (md.trim()) out.push({ kind: 'markdown', text: md })
    prose = []
  }
  for (let i = 0; i < lines.length; i++) {
    const m = MARKER.exec(lines[i] ?? '')
    if (!m) {
      prose.push(lines[i] ?? '')
      continue
    }
    flush()
    const callout: Callout = { kind: (m[1] ?? 'action').toLowerCase() as CalloutKind, title: (m[2] ?? '').trim(), body: [], options: [] }
    while (i + 1 < lines.length && QUOTED.test(lines[i + 1] ?? '') && !MARKER.test(lines[i + 1] ?? '')) {
      i++
      const line = (lines[i] ?? '').replace(/^\s*>\s?/, '').trimEnd()
      const item = ITEM.exec(line.trim())
      if (callout.kind === 'ask' && item) callout.options.push((item[1] ?? '').trim())
      else if (line.trim() || callout.body.length) callout.body.push(line)
    }
    while (callout.body.length && !callout.body[callout.body.length - 1]?.trim()) callout.body.pop()
    if (!callout.title && callout.body.length) callout.title = (callout.body.shift() ?? '').trim()
    out.push({ kind: 'callout', callout })
  }
  flush()
  return out
}

/** The blocks that wait on the person: every ACTION, ASK and INPUT. */
export const openOf = (segments: readonly Segment[]): Callout[] =>
  segments.flatMap(s => (s.kind === 'callout' && s.callout.kind !== 'done' ? [s.callout] : []))

/** The message a press sends back for this callout. */
export function answerText(c: Callout, answer?: string): string {
  if (c.kind === 'action') return `Done: ${c.title}`
  return answer ?? ''
}
