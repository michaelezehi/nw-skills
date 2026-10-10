import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Call } from '../types'

const PANE = 'session-pane'
const files = atom({ plugin: 'session-pane', key: 'files' } as const, [])
const calls = atom({ plugin: 'session-pane', key: 'calls' } as const, [])

const WRITERS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

function labelOf(input: Record<string, unknown>): string {
  const raw = input.file_path ?? input.notebook_path ?? input.command ?? input.pattern ?? input.description ?? ''
  return String(raw).replace(/\s+/g, ' ').slice(0, 60)
}

function relative(path: string, cwd: string): string {
  return path.startsWith(cwd + '/') ? path.slice(cwd.length + 1) : path
}

// Groups paths by folder so the pane reads as a tree, folders sorted.
function treeRows(paths: string[]): Array<{ text: string; isFolder: boolean }> {
  const byFolder = new Map<string, string[]>()

  for (const path of paths) {
    const cut = path.lastIndexOf('/')
    const folder = cut === -1 ? '.' : path.slice(0, cut)
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), path.slice(cut + 1)])
  }

  return [...byFolder.keys()].sort().flatMap(folder => [
    { text: `${folder}/`, isFolder: true },
    ...byFolder.get(folder)!.sort().map(name => ({ text: `  ${name}`, isFolder: false })),
  ])
}

export const register: Register = on => {
  let cwd = ''

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({
      name: 'session-pane',
      description: 'Show files changed this session and the latest tool calls',
    })

    return next(e)
  })

  on('command.run', { command: 'session-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Session' })

    return { text: 'Session pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const call: Call = { id: e.tool_use_id, tool: e.tool, label: labelOf(input), isDone: false, isError: false }
    await update($, calls, list => [...list, call].slice(-50))

    const ran = await next(e)
    const isError = ran.deny !== undefined || ran.isError === true
    await update($, calls, list =>
      list.map(one => (one.id === call.id ? { ...one, isDone: true, isError } : one)),
    )

    const path = input.file_path ?? input.notebook_path

    if (WRITERS.has(e.tool) && !isError && typeof path === 'string') {
      const shown = relative(path, cwd)
      await update($, files, list => (list.includes(shown) ? list : [...list, shown]))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const changed = await read($, files)
    const recent = await read($, calls)
    const rows = Math.max(6, (e.viewport?.rows ?? 24) - 6)
    const callRoom = Math.min(10, Math.floor(rows / 2))
    const fileRows = treeRows(changed).slice(0, rows - callRoom)

    return (
      <Box flexDirection="column">
        <Text bold>Changed ({changed.length})</Text>
        {changed.length === 0 && <Text dimColor>No edits yet.</Text>}
        {fileRows.map(row => (
          <Text color={row.isFolder ? 'cyan' : undefined} dimColor={row.isFolder}>
            {row.text}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>Latest tool calls</Text>
        {recent.length === 0 && <Text dimColor>None yet.</Text>}
        {recent.slice(-callRoom).map(call => (
          <Text color={call.isError ? 'red' : call.isDone ? undefined : 'yellow'} dimColor={call.isDone && !call.isError}>
            {call.tool} {call.label}
          </Text>
        ))}
      </Box>
    )
  })
}
