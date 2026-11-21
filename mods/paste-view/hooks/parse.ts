// Splits a prompt into its pastes and the words typed around them, names what each paste is,
// and decides which of its lines a collapsed card shows. Pure: no engine, no drawing.

export type Kind = 'log' | 'stack trace' | 'diff' | 'JSON' | 'code' | 'text'
export type Tone = 'error' | 'warn' | 'muted' | 'pointer' | 'add' | 'del' | 'hunk' | 'plain'

export type Paste = { id: string; kind: Kind; lines: string[] }
export type Prompt = {
  pastes: Paste[]
  /** What the person typed, pastes and image marks taken out. */
  words: string
  /** The numbers of the `[Image #n]` marks, in order. */
  images: number[]
  /** `[Pasted text #n +m lines]` marks the engine left folded. */
  folded: string[]
}

export type Row =
  | { type: 'line'; n: number; text: string; tone: Tone }
  | { type: 'gap'; hidden: number; errors: number }

export const HEAD = 4
export const TAIL = 12
/** A paste this short is shown whole. */
export const WHOLE = HEAD + TAIL + 4
const MAX_EXTRA = 24

const PASTE = /<pasted_content(?:\s+id="([^"]*)")?\s*>\n?([\s\S]*?)(?:<\/pasted_content(?:\s+id="[^"]*")?\s*>|$)/g
const IMAGE = /\[Image #(\d+)\]/g
const FOLDED = /\[Pasted text #\d+(?: \+\d+ lines)?\]/g
// Colour codes a terminal copy carries along.
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g

export function parsePrompt(text: string): Prompt {
  const pastes: Paste[] = []
  const rest = text.replace(PASTE, (_, id: string | undefined, body: string) => {
    const lines = clean(body)
    if (lines.length > 0) pastes.push({ id: id ?? '', kind: kindOf(lines), lines })
    return '\n\n'
  })
  const images: number[] = []
  const folded: string[] = []
  const words = rest
    .replace(IMAGE, (_, n: string) => (images.push(Number(n)), ''))
    .replace(FOLDED, m => (folded.push(m.slice(1, -1)), ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { pastes, words, images, folded }
}

function clean(body: string): string[] {
  const lines = body.replace(ANSI, '').replace(/\r/g, '').replace(/\t/g, '  ').split('\n')
  while (lines.length > 0 && !(lines[0] ?? '').trim()) lines.shift()
  while (lines.length > 0 && !(lines.at(-1) ?? '').trim()) lines.pop()
  return lines.map(l => l.trimEnd())
}

const FRAME = /^\s+at\s.+|^\s*File ".+", line \d+|^Traceback \(most recent call last\)|^\s+\.\.\. \d+ more/
const LOGGY =
  /\[(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\]|\b(ERROR|WARN|INFO|DEBUG)\b|^\s*#\d+\s|^\d{4}-\d\d-\d\d[T ]\d\d:\d\d|^\[?\d\d:\d\d:\d\d|ELIFECYCLE|ERR_|ERR!|exit code \d+|^\s*\d+\s*\|\s|^[>$]\s+\S/
const CODEY = /[{};]\s*$|^\s*(import|export|const|let|var|function|class|def|return|if|for|while|public|private|fn|func|package|from|#include)\b|=>/

export function kindOf(lines: string[]): Kind {
  const body = lines.join('\n').trim()
  if (/^[[{]/.test(body) && /[\]}]$/.test(body)) {
    try {
      JSON.parse(body)
      return 'JSON'
    } catch {
      // Not JSON after all; the checks below name it.
    }
  }
  const count = (re: RegExp): number => lines.filter(l => re.test(l)).length
  if (lines.some(l => /^diff --git |^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/.test(l))) return 'diff'
  const frames = count(FRAME)
  const loggy = count(LOGGY)
  if (frames >= 2 && frames >= loggy) return 'stack trace'
  if (loggy >= 2 || (loggy >= 1 && lines.length <= 3)) return 'log'
  if (frames >= 2) return 'stack trace'
  if (count(CODEY) >= Math.max(2, lines.length / 4)) return 'code'
  return 'text'
}

const CLEAN_RUN = /\b(0|no) (errors?|failed|failures?|warnings?)\b/i
const ERROR_WORD =
  /\[ERROR\]|\b(error|errors|failed|failure|fatal|panic|exception|denied|refused)\b|exit(ed with)? code:? [1-9]|exit status [1-9]|did not complete successfully|^Traceback/i
// Codes are read as written: without the case, `dockerfile:` would pass for an errno.
const ERROR_CODE = /\bFAIL\b|ERR!|ERR_[A-Z_]+|ELIFECYCLE|\bE[A-Z]{4,}:|✖|✗/
const WARN = /\[WARN(ING)?\]|\bwarn(ing|ings)?\b|\bdeprecated\b|⚠/i
const POINTER = /^\s*\d+\s*\|\s*>>>|^\s*>\s*\d+\s*\||^\s*-->\s|^\s*\|?\s*\^+\s*$/
const QUIET =
  /\[(INFO|DEBUG|TRACE)\]|\b(INFO|DEBUG)\b|\bCACHED\b|\bDONE \d|\bDone in \d|^\s*#\d+\s+(sha256:|extracting|transferring|resolve|naming to|exporting|writing|load )|^Progress: |^\s*$/

/** What a line says about itself; only a log, a trace or loose text is read for trouble. */
export function toneOf(line: string, kind: Kind): Tone {
  if (kind === 'diff') {
    if (/^@@/.test(line)) return 'hunk'
    if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) return 'muted'
    if (line.startsWith('+')) return 'add'
    if (line.startsWith('-')) return 'del'
    return 'plain'
  }
  if (kind === 'JSON' || kind === 'code') return 'plain'
  if (POINTER.test(line)) return 'pointer'
  if (ERROR_CODE.test(line) || (ERROR_WORD.test(line) && !CLEAN_RUN.test(line))) return 'error'
  if (WARN.test(line) && !CLEAN_RUN.test(line)) return 'warn'
  if (QUIET.test(line)) return 'muted'
  return 'plain'
}

export function errorCount(paste: Paste): number {
  return paste.lines.filter(l => toneOf(l, paste.kind) === 'error').length
}

/**
 * The rows a card draws. A long paste keeps its first lines, its last ones, every error and
 * every pointer line, and says how many it left out between them.
 */
export function planRows(paste: Paste, showAll = false): Row[] {
  const { lines, kind } = paste
  const tones = lines.map(l => toneOf(l, kind))
  const keep = new Set<number>()
  if (showAll || lines.length <= WHOLE) {
    lines.forEach((_, i) => keep.add(i))
  } else {
    for (let i = 0; i < HEAD; i++) keep.add(i)
    for (let i = lines.length - TAIL; i < lines.length; i++) keep.add(i)
    let extra = 0
    for (const [i, t] of tones.entries()) {
      if ((t !== 'error' && t !== 'pointer') || keep.has(i)) continue
      if (extra++ >= MAX_EXTRA) break
      keep.add(i)
    }
  }
  const rows: Row[] = []
  let hidden = 0
  let errors = 0
  const flush = (): void => {
    if (hidden > 0) rows.push({ type: 'gap', hidden, errors })
    hidden = 0
    errors = 0
  }
  for (const [i, text] of lines.entries()) {
    if (!keep.has(i)) {
      hidden++
      if (tones[i] === 'error') errors++
      continue
    }
    flush()
    rows.push({ type: 'line', n: i + 1, text, tone: tones[i] ?? 'plain' })
  }
  flush()
  return rows
}

const LINK = /https?:\/\/[^\s)'"<>]+|(?:~|\.{1,2})?\/?(?:[\w@.+-]+\/)+[\w@.+-]+(?::\d+(?::\d+)?)?/g

/** A line cut into plain text and the paths and URLs in it. */
export function segmentsOf(text: string): { text: string; isLink: boolean }[] {
  const out: { text: string; isLink: boolean }[] = []
  let at = 0
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0
    if (start > at) out.push({ text: text.slice(at, start), isLink: false })
    out.push({ text: m[0], isLink: true })
    at = start + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at), isLink: false })
  return out
}

/** Cuts a line to the room it has, with an ellipsis when it ran over. */
export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`
}

/** Wraps prose at word ends so each row can carry the bar beside it. */
export function wrapWords(text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word
      while (w.length > width) {
        if (line) out.push(line)
        line = ''
        out.push(w.slice(0, width))
        w = w.slice(width)
      }
      if (!line) line = w
      else if (line.length + 1 + w.length <= width) line = `${line} ${w}`
      else {
        out.push(line)
        line = w
      }
    }
    out.push(line)
  }
  return out
}
