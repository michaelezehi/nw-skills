// Reads a shell call's result for the lines that say what went wrong: which are errors, which
// of them a head and tail fold would hide, and the last one, which names the failure. Also
// recolours the lines of a card another mod already drew, without redrawing the card.
import { toneOf, type Tone } from './parse'

export type ShellRead = { lines: string[]; exitCode: number | null }
export type Finding = { n: number; text: string; tone: Tone }
export type Summary = {
  errors: number
  /** The last error line, or on a failure with none the last line printed. */
  last: string | null
  /** Error and pointer lines sitting where a fold of the output hides them. */
  hidden: Finding[]
  more: number
}

// What a card keeps of a long stream: skins folds at 8 + 4, and so does this reading.
export const FOLD_HEAD = 8
export const FOLD_TAIL = 4
export const MAX_FINDINGS = 8

const EXIT_LINE = /^Exit code (\d+)\n?/
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g
const linesOf = (text: string): string[] =>
  text
    .replace(ANSI, '')
    .replace(/\r/g, '')
    .replace(/\n+$/, '')
    .split('\n')
    .map(l => l.replace(/\t/g, '  ').trimEnd())
    .filter((l, i, all) => l !== '' || all.length > 1)

/** A shell result as lines, stdout then stderr; null when it is not one this reads. */
export function readShell(output: unknown, isErrored: boolean): ShellRead | null {
  if (typeof output === 'string') {
    const text = output.replace(/<\/?tool_use_error>/g, '')
    const exit = EXIT_LINE.exec(text)
    if (!isErrored && exit === null) return { lines: linesOf(text), exitCode: null }
    return { lines: linesOf(exit ? text.slice(exit[0].length) : text), exitCode: exit ? Number(exit[1]) : null }
  }
  if (typeof output !== 'object' || output === null) return null
  const record = output as { stdout?: unknown; stderr?: unknown; exitCode?: unknown }
  if (typeof record.stdout !== 'string' && typeof record.stderr !== 'string') return null
  let stderr = typeof record.stderr === 'string' ? record.stderr : ''
  const exit = EXIT_LINE.exec(stderr)
  if (exit) stderr = stderr.slice(exit[0].length)
  const stdout = typeof record.stdout === 'string' ? record.stdout : ''
  const exitCode = typeof record.exitCode === 'number' ? record.exitCode : exit ? Number(exit[1]) : null
  return { lines: [...(stdout.trim() ? linesOf(stdout) : []), ...(stderr.trim() ? linesOf(stderr) : [])], exitCode }
}

export function summarize(lines: string[], isErrored: boolean): Summary {
  const tones = lines.map(l => toneOf(l, 'log'))
  const errors = tones.filter(t => t === 'error').length
  const lastError = tones.lastIndexOf('error')
  const lastLine = lines.findLast(l => l.trim() !== '') ?? null
  const isFolded = lines.length > FOLD_HEAD + FOLD_TAIL + 1
  const found: Finding[] = []
  for (const [i, tone] of tones.entries()) {
    const inFold = isFolded && i >= FOLD_HEAD && i < lines.length - FOLD_TAIL
    if (inFold && (tone === 'error' || tone === 'pointer')) found.push({ n: i + 1, text: lines[i] ?? '', tone })
  }
  // A listing of matches (a grep for "error") is not a run that failed.
  const isListing = !isErrored && errors > lines.length / 2
  const hidden = isListing ? [] : found.slice(-MAX_FINDINGS)
  return {
    errors,
    last: lastError >= 0 ? (lines[lastError] ?? null) : isErrored ? lastLine : null,
    hidden,
    more: isListing ? 0 : found.length - hidden.length,
  }
}

export type Node = string | { type: string; props?: Record<string, unknown>; children?: readonly Node[] }

const flat = (node: Node): string => (typeof node === 'string' ? node : (node.children ?? []).map(flat).join(''))

/**
 * A drawn card with its output lines recoloured by what they say. A line that is an error, a
 * warning or a pointer takes that colour; on a failed call the rest lose the all-red and read
 * plain or quiet. Anything that is not a line of this output is handed back as it was.
 */
export function retone(node: Node, lines: string[], colors: Record<Tone, string>, isErrored: boolean): Node {
  const tones = new Map<string, Tone>()
  for (const l of lines) if (l.trim()) tones.set(l, toneOf(l, 'log'))
  const walk = (n: Node): Node => {
    if (typeof n === 'string' || !n.children) return n
    if (n.type !== 'Text') return { ...n, children: n.children.map(walk) }
    const text = flat(n)
    const tone = tones.get(text) ?? tones.get(text.trimEnd())
    if (tone === undefined) return n
    const isLoud = tone === 'error' || tone === 'warn' || tone === 'pointer'
    if (isLoud) return { ...n, props: { ...n.props, color: colors[tone] }, children: [text] }
    const isOneColour = n.children.every(c => typeof c === 'string')
    return isErrored && isOneColour ? { ...n, props: { ...n.props, color: colors[tone] } } : n
  }
  try {
    return walk(node)
  } catch {
    return node
  }
}
