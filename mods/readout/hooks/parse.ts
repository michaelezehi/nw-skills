// Finds the runs of `**label:** text` lines in a reply. Two or more in a row make a readout;
// everything else stays markdown for the engine to draw.
import type { Row, Segment } from '../types'

const ROW = /^\s*(?:[-*•]\s+)?\*\*([^*\n]{1,80}?)(?::\*\*|\*\*\s*:)\s*(.*)$/
const FENCE = /^\s*(```|~~~)/
// A line that starts something of its own, so it never joins the row above.
const OWN = /^\s*([-*•+]\s|\d+[.)]\s|#{1,6}\s|>|\||```|~~~)/

export function parseReadouts(text: string): Segment[] {
  const lines = text.split('\n')
  const out: Segment[] = []
  let prose: string[] = []
  let rows: Row[] = []
  let inFence = false

  const flushProse = (): void => {
    const md = prose.join('\n').replace(/^\n+|\n+$/g, '')
    if (md.trim()) out.push({ kind: 'markdown', text: md })
    prose = []
  }
  const flushRows = (): void => {
    if (rows.length >= 2) {
      flushProse()
      out.push({ kind: 'readout', rows })
    } else {
      prose.push(...rows.map(r => r.source))
    }
    rows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (FENCE.test(line)) inFence = !inFence
    const m = inFence ? null : ROW.exec(line)
    if (m) {
      rows.push({ label: (m[1] ?? '').trim(), text: (m[2] ?? '').trim(), source: line })
      continue
    }
    const last = rows.at(-1)
    if (last && !inFence && line.trim() && !OWN.test(line)) {
      last.text = `${last.text} ${line.trim()}`.trim()
      last.source = `${last.source}\n${line}`
      continue
    }
    // One blank line between two rows keeps the run going.
    if (last && !line.trim() && ROW.test(lines[i + 1] ?? '')) continue
    flushRows()
    prose.push(line)
  }
  flushRows()
  flushProse()
  return out
}

/** The tone a label asks for: a miss reads red, a skip reads quiet, the rest take the cycle. */
export function toneOf(label: string): 'error' | 'muted' | null {
  if (/\b(fail(ed|s)?|error|broken|blocked|not shipped)\b/i.test(label)) return 'error'
  if (/\b(not changed|skipped|unchanged|left alone)\b/i.test(label)) return 'muted'
  return null
}
