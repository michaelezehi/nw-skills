import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FileTouch, FilesStrip } from '../types'

// File activity at the foot of the agents pane: it opens while Claude reads,
// writes or commits, and closes itself a few seconds after the last one, so
// the filetree mod's Files tab no longer has to cover the agents to show it.

type Kind = FileTouch['kind']

const files = atom({ plugin: 'savvy-progress', key: 'files' } as const, { log: [], lastAt: 0, more: false, dismissedId: 0, tick: 0 } as FilesStrip)

const CLOSE_MS = 8_000
const KEEP = 30
const SHORT = 4
const LONG = 15
const WRITES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const GIT = /\bgit\s+(commit|push|pull|merge|rebase|checkout|switch|stash|reset|tag)\b/
const GLYPH: Record<Kind, [string, string]> = {
  read: ['◦', 'magenta'],
  write: ['✎', 'yellow'],
  git: ['●', 'green'],
  failed: ['✗', 'red'],
}

function relative(path: string, cwd: string): string {
  return cwd && path.startsWith(cwd + '/') ? path.slice(cwd.length + 1) : path
}

async function log($: EngineInterface, kind: Kind, text: string): Promise<void> {
  const at = await $.clock.now()
  await update($, files, f => ({ ...f, lastAt: at, log: [...f.log, { id: (f.log.at(-1)?.id ?? 0) + 1, kind, text, at }].slice(-KEEP) }))
  // Draw once more after the quiet period, so the strip closes itself.
  $.clock.after(CLOSE_MS + 100, () => void update($, files, f => ({ ...f, tick: f.tick + 1 })))
}

// What a finished tool call adds to the strip: reads, writes and git actions.
export async function noteFiles($: EngineInterface, e: { tool: string }, result: { deny?: string; isError?: true }): Promise<void> {
  if (result.deny) return
  const cwd = await $.session.cwd().catch(() => '')
  if (e.tool === 'Bash') {
    const verb = GIT.exec(String((e as { command?: unknown }).command ?? ''))?.[1]
    if (verb) await log($, result.isError ? 'failed' : 'git', result.isError ? `${verb} failed` : `git ${verb}`)
  } else if (!result.isError && (e.tool === 'Read' || WRITES.has(e.tool))) {
    const input = e as { file_path?: unknown; notebook_path?: unknown }
    const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : ''
    if (path) await log($, e.tool === 'Read' ? 'read' : 'write', relative(path, cwd))
  }
}

// True when the filetree mod opens its pane unasked while the agents pane is
// up: that open is swallowed so Files never covers the agents. /filetree asks
// with focus, which still opens it.
export async function keepFilesShut($: EngineInterface, plugin: string, focus: true | undefined, paneId: string): Promise<boolean> {
  if (plugin !== 'filetree' || focus) return false
  return $.ui
    .panes()
    .then(list => list.some(p => p.id === paneId))
    .catch(() => false)
}

// The agents pane's body with the strip under the cards while it is open.
export async function filesUnder(
  $: EngineInterface,
  e: Parameters<EngineInterface['ui']['resolve']>[0],
  body: JSX.Element,
): Promise<JSX.Element> {
  const f = await read($, files)
  const at = await $.clock.now()
  const last = f.log.at(-1)
  if (!last || !(f.more || (last.id > f.dismissedId && at - f.lastAt < CLOSE_MS))) return body

  const { Box, Text, Button } = $.ui.resolve(e) as unknown as {
    Box: (p: Record<string, unknown>) => JSX.Element
    Text: (p: Record<string, unknown>) => JSX.Element
    Button: (p: Record<string, unknown>) => JSX.Element
  }
  const shown = f.log.slice(-(f.more ? LONG : SHORT)).reverse()
  const writes = f.log.filter(t => t.kind === 'write' && t.at > at - 60_000).length
  return (
    <Box flexDirection="column">
      {body}
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor wrap="truncate-end">
            Files{writes ? ` · ${writes} edited` : ''}
          </Text>
          <Box flexDirection="row" gap={1}>
            <Button key="files-more" label={f.more ? 'less' : 'more'} plain onPress={() => update($, files, p => ({ ...p, more: !p.more }))} />
            <Button key="files-hide" label="hide" plain onPress={() => update($, files, p => ({ ...p, more: false, dismissedId: p.log.at(-1)?.id ?? 0 }))} />
          </Box>
        </Box>
        {shown.map(t => (
          <Text key={t.id} wrap="truncate-start" dimColor={t.kind === 'read'}>
            <Text color={GLYPH[t.kind][1]}>{GLYPH[t.kind][0]}</Text> {t.text}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
