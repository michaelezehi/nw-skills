// The run, restart and wait tools: their socket routes and the text Claude reads back.
// Pure, so every answer shape is tested without an engine.

export const RUN_URL = 'http://devdeck/run'
export const RESTART_URL = 'http://devdeck/restart'
export const waitUrl = (id: string, until: 'exit' | 'ready', timeoutMs: number): string =>
  `http://devdeck/wait?id=${encodeURIComponent(id)}&until=${until}&timeoutMs=${timeoutMs}`

/** How long a tool waits by default, and at most; the socket caps its own wait at 10 min. */
export const DEFAULT_WAIT_S = 120
export const MAX_WAIT_S = 600

/** Seconds from a tool argument, clamped; the default when it is missing or not a number. */
export function waitSeconds(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_WAIT_S, Math.round(n)) : DEFAULT_WAIT_S
}

interface Prompt {
  kind: string
  question: string
  options?: string[]
}

interface Result {
  id: string
  label: string
  status: string
  running: boolean
  exitCode?: number | null
  ranMs?: number
  progress?: { fraction?: number; label: string }
  prompt?: Prompt
  errors: { title: string; body: string[]; file?: string }[]
  tail: string[]
}

const secs = (ms: number | undefined): string => (ms === undefined ? '' : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`)

function promptLine(label: string, p: Prompt): string {
  const choices = p.kind === 'confirm' ? ' (yes/no)' : p.options ? ` (one of: ${p.options.join(', ')})` : p.kind === 'secret' ? ' (a password)' : ''
  return `${label} is waiting for input: "${p.question}"${choices}. Only a person can answer it, in the Devdeck terminal: ask the user to answer there, then call devdeck_wait.`
}

/** The tool's answer for one result, with why the wait ended when there was one. */
export function resultText(raw: string, reason?: string): string {
  let r: Result
  try {
    r = JSON.parse(raw) as Result
  } catch {
    return 'Devdeck answered with something that is not a result.'
  }
  const lines: string[] = []
  if (r.prompt) lines.push(promptLine(r.label, r.prompt))
  else if (reason === 'timeout') lines.push(`${r.label} is still running after the wait (${secs(r.ranMs)} so far). Call devdeck_wait again to keep waiting.`)
  else if (!r.running) lines.push(`${r.label} ${r.exitCode === 0 ? 'finished' : `failed with exit code ${r.exitCode ?? '?'}`} in ${secs(r.ranMs)}.`)
  else if (reason === 'ready') lines.push(`${r.label} is ${r.status}.`)
  else lines.push(`${r.label} is ${r.status}${r.ranMs !== undefined ? `, running ${secs(r.ranMs)}` : ''}. Its card is id "${r.id}".`)
  if (r.progress) lines.push(`Progress: ${r.progress.fraction !== undefined ? `${Math.round(r.progress.fraction * 100)}% ` : ''}${r.progress.label}`)
  if (r.errors.length) {
    lines.push('', `Errors (${r.errors.length}):`)
    for (const e of r.errors) lines.push(`${e.title}${e.file ? ` at ${e.file}` : ''}`, ...e.body.filter(b => b !== e.title).map(b => `    ${b}`))
  }
  if (r.tail.length) lines.push('', `Last ${r.tail.length} lines:`, ...r.tail)
  return lines.join('\n')
}

/** The wait route's answer: `{ reason, result }`. */
export function waitText(raw: string): string {
  try {
    const { reason, result } = JSON.parse(raw) as { reason?: string; result?: unknown }
    if (!result) return 'Devdeck has no card with that id.'
    return resultText(JSON.stringify(result), reason)
  } catch {
    return 'Devdeck answered with something that is not a result.'
  }
}

/** A 404 from /run or /restart, naming what does exist. */
export function refusedText(raw: string): string {
  try {
    const { error, scripts, services } = JSON.parse(raw) as { error?: string; scripts?: string[]; services?: string[] }
    const known = scripts ? ` Scripts: ${scripts.join(', ')}.` : services ? ` Services: ${services.join(', ')}.` : ''
    return `${error ?? 'Devdeck refused it.'}.${known}`.replace('..', '.')
  } catch {
    return 'Devdeck refused it.'
  }
}
