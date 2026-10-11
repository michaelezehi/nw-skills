// The devdeck_status tool's text: a compact summary plus every error in full.
import type { Err, Snap } from '../types'

import { ageOf, badgeOf, fmtAge, fmtMem, fmtMs } from './model'

export const NOT_RUNNING = 'Devdeck is not running in this project.'

function errorBlock(snap: Snap, e: Err, clock: number): string {
  const head = `[${e.service}] ${e.title} (${fmtAge(ageOf(snap, e.at, clock))} ago)${e.file ? ` at ${e.file}` : ''}`
  const body = e.body.filter(line => line !== e.title)
  return body.length ? `${head}\n${body.map(line => `    ${line}`).join('\n')}` : head
}

export function summaryText(snap: Snap, errors: Err[], socket: string, clock: number): string {
  const lines: string[] = [`Devdeck at ${snap.root || socket}, ${fmtMem(snap.memMb)} total.`, '', 'Services:']

  for (const s of snap.services) {
    const port = s.port === null ? '' : ` :${s.port}`
    const reload =
      s.reloadAt === null
        ? ''
        : `, last reload ${[s.reloadRoute, fmtMs(s.reloadMs)].filter(Boolean).join(' ')} ${fmtAge(ageOf(snap, s.reloadAt, clock))} ago`
    lines.push(`  ${s.id}${port} ${s.status}, ${fmtMem(s.memMb)}${reload}`)
  }

  if (snap.calls.length) {
    lines.push('', 'Recent Convex calls:')
    for (const c of snap.calls) {
      const fail = c.ok ? '' : ` FAILED${c.error ? `: ${c.error}` : ''}`
      lines.push(`  ${badgeOf(c.type)} ${c.fn} ${fmtMs(c.ms)}${fail}`)
    }
  }

  lines.push('', errors.length ? `Errors (${errors.length}):` : 'Errors: none.')
  for (const e of errors) lines.push(errorBlock(snap, e, clock), '')
  return lines.join('\n').trimEnd()
}
