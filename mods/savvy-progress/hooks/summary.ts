// What a finished agent did, in a few plain lines: the summary it sent with its
// last step, else the gist of its final report with the markdown, code and
// tables taken out; and what it wants from the person, flagged. Pure functions,
// so the card that shows them and the pane's height agree.
import type { AgentRun } from '../types'

export type Follow = { text: string; isBlocking: boolean }
export type Digest = { lines: string[]; follow: Follow[] }

const MAX_LINES = 3
const MAX_FOLLOW = 3
// The width the pane's height is reckoned at: narrower than most panes, so a
// summary never needs more rows than were asked for.
const ROWS_WIDTH = 48

// Callouts that wait on the person (yellow) and those that only ask (violet).
const BLOCKING = new Set(['ACTION', 'SECRET'])
const ASKING = new Set(['ASK', 'INPUT', 'REVIEW'])
const FOLLOW_LEAD = /open questions?|follow[- ]?ups?|next steps?|needs? you|risks?/i
const NONE = /^(none|n\/a|nothing)\b/i

type Line = {
  text: string
  indent: number
  isHeading: boolean
  isItem: boolean
  isBold: boolean
  // The callout this line opens, or the one whose quoted body it is in.
  callout?: string
  isBody: boolean
}

// Inline markdown to plain words: links keep their text, markers go.
export const plain = (s: string): string =>
  s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const clip = (s: string, w: number): string => (s.length <= w ? s : `${s.slice(0, Math.max(1, w - 1)).trimEnd()}…`)

// Words into lines of `width`; past `max` lines the last one ends in an ellipsis.
export function wrap(text: string, width: number, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= width) {
      line = next
      continue
    }
    if (line) out.push(line)
    line = clip(word, width)
  }
  if (line) out.push(line)
  if (out.length <= max) return out
  const kept = out.slice(0, max)
  const last = kept[max - 1] ?? ''
  kept[max - 1] = last.length < width ? `${last}…` : clip(last, width)
  return kept
}

// The first `n` sentences; a full stop inside a word (a file name) is not an end.
const sentences = (s: string, n: number): string => s.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).slice(0, n).join(' ')

function linesOf(report: string): Line[] {
  const out: Line[] = []
  let fence = ''
  let open: string | undefined
  for (const raw of report.split(/\r?\n/)) {
    const t = raw.trim()
    const f = /^(```|~~~)/.exec(t)
    if (fence) {
      if (f && t.startsWith(fence)) fence = ''
      continue
    }
    if (f) {
      fence = f[1] ?? '```'
      continue
    }
    const isQuote = t.startsWith('>')
    if (!isQuote) open = undefined
    // Table rows and rules end a paragraph and show nothing.
    if (t.startsWith('|') || /^([-*_]\s*){3,}$/.test(t)) {
      out.push({ text: '', indent: 0, isHeading: false, isItem: false, isBold: false, isBody: false })
      continue
    }
    let s = t.replace(/^(>\s*)+/, '')
    const isHeading = /^#{1,6}\s/.test(s)
    s = s.replace(/^#{1,6}\s+/, '')
    const isItem = /^([-*+]|\d+[.)])\s+/.test(s)
    s = s.replace(/^([-*+]|\d+[.)])\s+/, '').replace(/^\[[ xX]\]\s+/, '')
    const isBold = /^(\*\*|__)/.test(s)
    const mark = /^\[!([A-Za-z]+)\]\s*/.exec(s)
    if (mark) s = s.slice(mark[0].length)
    const callout = mark ? (mark[1] ?? '').toUpperCase() : isQuote ? open : undefined
    if (mark) open = callout
    const indent = raw.length - raw.trimStart().length
    out.push({ text: plain(s), indent, isHeading, isItem, isBold, callout, isBody: !mark && callout !== undefined })
  }
  return out
}

const isProse = (l: Line): boolean => l.text !== '' && !l.isHeading && l.callout === undefined

// The first plain paragraph at or after `from`: a lead ending in a colon is
// skipped, and a list item stands alone.
function paragraphAt(lines: Line[], from: number): string {
  const start = lines.findIndex((l, i) => i >= from && isProse(l) && !l.text.endsWith(':'))
  if (start < 0) return ''
  const words = [lines[start]?.text ?? '']
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l || !isProse(l) || l.isItem) break
    words.push(l.text)
  }
  return words.join(' ')
}

function summaryFrom(lines: Line[]): string {
  const done = lines.find(l => l.callout === 'DONE' && !l.isBody && l.text)
  if (done) return done.text
  for (const word of ['summary', 'result']) {
    const lead = new RegExp(`^${word}s?(?:\\s*[:\\-]\\s*|\\s*$)(.*)$`, 'i')
    const i = lines.findIndex(l => l.callout === undefined && lead.test(l.text))
    if (i < 0) continue
    const rest = (lead.exec(lines[i]?.text ?? '')?.[1] ?? '').trim()
    // A bare status ("done.") reads better with the paragraph after it.
    const text = rest.split(' ').length > 3 ? rest : `${rest} ${paragraphAt(lines, i + 1)}`.trim()
    if (text) return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return paragraphAt(lines, 0)
}

// What a callout or a follow-up section asks of the person.
function followsFrom(lines: Line[]): Follow[] {
  const out: Follow[] = []
  const add = (text: string, isBlocking: boolean): void => {
    if (text && !NONE.test(text) && !out.some(f => f.text === text)) out.push({ text, isBlocking })
  }
  lines.forEach((l, i) => {
    if (l.callout && !l.isBody && (BLOCKING.has(l.callout) || ASKING.has(l.callout))) {
      // A marker alone on its line: its first quoted line says it.
      const body = lines[i + 1]?.isBody && lines[i + 1]?.callout === l.callout ? (lines[i + 1]?.text ?? '') : ''
      add(l.text || body, BLOCKING.has(l.callout))
      return
    }
    const isLead = l.isHeading || l.isBold || l.isItem || l.text.endsWith(':')
    const hit = FOLLOW_LEAD.exec(l.text)
    if (!isLead || !hit || hit.index > 40 || l.callout !== undefined) return
    const colon = l.text.indexOf(':', hit.index)
    if (colon >= 0) add(l.text.slice(colon + 1).trim(), false)
    // The items under it: deeper than the lead when the lead is an item itself.
    const depth = l.isItem ? l.indent : -1
    for (let j = i + 1; j < lines.length; j++) {
      const m = lines[j]
      if (!m || m.text === '') continue
      if (!m.isItem || m.isHeading || m.indent <= depth) break
      if (m.callout === undefined) add(m.text, false)
    }
  })
  return out
}

// A follow-up reads as a question or a choice (violet) unless it says to act (yellow).
const isAction = (s: string): boolean =>
  !/\?\s*$/.test(s) && !/^(decide|choose|pick|should|which|whether|do|does|is|are|can|could|would)\b/i.test(s)

/**
 * A finished run's summary wrapped to `width`, at most three lines, and up to
 * three one-line follow-ups. The step tool's `summary` and `followUp` win over
 * the report; with neither a report nor a summary the line is `empty`.
 */
export function digestOf(run: Pick<AgentRun, 'report' | 'summary' | 'followUp'>, width: number, empty = 'No report yet'): Digest {
  const w = Math.max(12, Math.floor(width))
  const lines = run.report ? linesOf(run.report) : []
  const summary = run.summary?.trim() ? plain(run.summary) : summaryFrom(lines)
  const ask = run.followUp?.trim() ? plain(run.followUp) : ''
  const follow = ask ? [{ text: ask, isBlocking: isAction(ask) }] : followsFrom(lines)
  const digest: Digest = {
    lines: summary ? wrap(sentences(summary, 2), w, MAX_LINES) : [],
    follow: follow.slice(0, MAX_FOLLOW).map(f => ({ ...f, text: clip(f.text, w - 2) })),
  }
  if ((!run.report && !run.summary?.trim()) || digest.lines.length + digest.follow.length === 0) {
    digest.lines = [empty]
  }
  return digest
}

// The rows an open card adds under its stats, as the pane's height reckons them.
export const digestRows = (run: Pick<AgentRun, 'report' | 'summary' | 'followUp'>): number => {
  const d = digestOf(run, ROWS_WIDTH)
  return d.lines.length + d.follow.length
}
