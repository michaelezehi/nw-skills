import { describe, expect, test } from 'claude-code/testing'

import { TONES } from '../hooks/register'
import { FOLD_HEAD, MAX_FINDINGS, readShell, retone, summarize, type Node } from '../hooks/shell'

// `pnpm ship` as Bash returns it: the build's error is on stdout, far from both ends.
const STDOUT = [
  '> devdeck@0.4.0 ship /Users/dev/src/devdeck',
  '[INFO] Building image website:5476b34',
  ...Array.from({ length: 20 }, (_, i) => `#14 ${i}.100 Progress: resolved ${i * 21}, reused ${i * 20}`),
  '#14 41.52 ./src/app/api/health/route.ts:14:9',
  "#14 41.52 Type error: Property 'uptime' does not exist on type 'Health'.",
  ...Array.from({ length: 8 }, (_, i) => `#14 42.${i}00 Linting and checking validity of types`),
  ' 190 | >>> RUN pnpm --filter website build',
  ...Array.from({ length: 6 }, (_, i) => `#15 ${i}.000 cleaning up layer ${i}`),
].join('\n')
const STDERR = 'Exit code 1\n[ERROR] Build failed for website\n ELIFECYCLE  Command failed with exit code 1.'
const FAILED = { stdout: STDOUT, stderr: STDERR, interrupted: false }
const mountResult = ($: unknown, output: unknown, isErrored: boolean, extra: object = {}) =>
  ($ as { ui: { mount: (a: never) => Promise<{ find: (q: object) => Promise<{ text?: string; props: Record<string, unknown> } | undefined> }> } }).ui.mount({
    plugin: 'paste-view',
    surface: 'terminal',
    component: 'ToolResult',
    props: { tool_use_id: 't1', tool: 'Bash', output, isErrored, ...extra },
  } as never)
// The card a skin draws beneath: every stdout line in the foreground, every stderr line red.
const skinCard = (e: { props: { output?: unknown } }): Node => {
  const o = e.props.output as typeof FAILED
  const line = (text: string, color: string): Node => ({ type: 'Text', props: { color }, children: [text] })
  const out = o.stdout.split('\n')
  return {
    type: 'Box',
    props: { key: 'skin-card', flexDirection: 'column' },
    children: [...out.slice(0, 8), ...out.slice(-4)].map(l => line(l, '#ffffff')).concat(o.stderr.replace(/^Exit code \d+\n/, '').split('\n').map(l => line(l, '#ff0000'))),
  }
}

describe('reading a shell result', () => {
  test('the record, the exit code on stderr, and a failed call that is only text', () => {
    const r = readShell(FAILED, true)
    expect(r?.exitCode).toBe(1)
    expect(r?.lines.at(-1)).toBe(' ELIFECYCLE  Command failed with exit code 1.')
    expect(r?.lines).not.toContain('Exit code 1')
    expect(readShell('<tool_use_error>Exit code 127\nzsh: command not found: pnpmm</tool_use_error>', true)).toEqual({ lines: ['zsh: command not found: pnpmm'], exitCode: 127 })
    expect(readShell({ filePath: 'a.ts' }, false)).toBeNull()
  })

  test('errors in the middle of stdout are found, with the pointer, and the last error names the failure', () => {
    const r = readShell(FAILED, true)!
    const s = summarize(r.lines, true)
    expect(s.last).toBe(' ELIFECYCLE  Command failed with exit code 1.')
    expect(s.hidden.map(f => f.tone)).toEqual(['error', 'pointer'])
    expect(s.hidden[0]?.text).toContain("Type error: Property 'uptime'")
    expect(s.hidden[0]?.n).toBeGreaterThan(FOLD_HEAD)
    expect(s.more).toBe(0)
  })

  test('a failure that printed no error word still has a last line; a grep for errors is a listing; many errors are capped', () => {
    expect(summarize(['zsh: command not found: pnpmm'], true).last).toBe('zsh: command not found: pnpmm')
    const listing = Array.from({ length: 30 }, (_, i) => `src/a${i}.ts:3: throw new Error("x")`)
    expect(summarize(listing, false).hidden).toHaveLength(0)
    const many = Array.from({ length: 80 }, (_, i) => (i % 3 === 0 ? `[ERROR] step ${i} failed` : `step ${i} ok`))
    const s = summarize(many, true)
    expect(s.hidden).toHaveLength(MAX_FINDINGS)
    expect(s.more).toBeGreaterThan(0)
    expect(s.hidden.at(-1)?.text).toBe('[ERROR] step 75 failed')
  })
})

describe('recolouring a drawn card', () => {
  test('on a failure each line takes its own tone in place of all-red, and other text is left alone', () => {
    const card: Node = {
      type: 'Box',
      children: [
        { type: 'Text', props: { color: '#ff0000' }, children: ['[INFO] retrying in 5s'] },
        { type: 'Text', props: { color: '#ff0000' }, children: ['[ERROR] Build failed for website'] },
        { type: 'Text', props: { color: '#ff0000' }, children: ['npm notice new version'] },
        { type: 'Text', props: { wrap: 'truncate-end' }, children: [{ type: 'Text', props: { color: '#00ff00' }, children: ['[WARN]'] }, ' disk at 91%'] },
        { type: 'Text', props: { color: '#123456' }, children: ['$ pnpm ship'] },
      ],
    }
    const lines = ['[INFO] retrying in 5s', '[ERROR] Build failed for website', 'npm notice new version', '[WARN] disk at 91%']
    const out = retone(card, lines, TONES, true) as unknown as { children: { props: { color?: string }; children: Node[] }[] }
    expect(out.children.map(c => c.props.color)).toEqual([TONES.muted, TONES.error, TONES.plain, TONES.warn, '#123456'])
    expect(out.children[3]?.children).toEqual(['[WARN] disk at 91%'])
    expect(retone(card, lines, TONES, false)).toMatchObject({ children: [{ props: { color: '#ff0000' } }, { props: { color: TONES.error } }, { props: { color: '#ff0000' } }, {}, {}] })
  })
})

describe('draw', () => {
  test('a failed build keeps the card beneath, retoned, under a strip with the exit and the reason', async ($, on) => {
    on('ui.render', (_, e) => skinCard(e as never) as never)
    const ui = await mountResult($, FAILED, true)

    expect((await ui.find({ type: 'Text', text: /^✖ exit 1$/ }))?.props.color).toBe(TONES.error)
    expect(await ui.find({ type: 'Text', text: /^ {2}ELIFECYCLE {2}Command failed with exit code 1\.$/ })).toBeDefined()
    // Lifted out of the fold: the type error and the Dockerfile pointer, numbered.
    expect((await ui.find({ type: 'Text', text: /^#14 41\.52 Type error:/ }))?.props.color).toBe(TONES.error)
    expect((await ui.find({ type: 'Text', text: /^ 190 \| >>> RUN pnpm/ }))?.props.color).toBe(TONES.pointer)
    // The card beneath is still there, its lines no longer one colour.
    expect((await ui.find({ type: 'Text', text: /^\[INFO\] Building image website:5476b34$/ }))?.props.color).toBe(TONES.muted)
    expect((await ui.find({ type: 'Text', text: /^\[ERROR\] Build failed for website$/ }))?.props.color).toBe(TONES.error)
    expect((await ui.find({ type: 'Text', text: /^#15 5\.000 cleaning up layer 5$/ }))?.props.color).toBe(TONES.plain)
  })

  test('ctrl+o shows the status line alone, since every line is on screen', async ($, on) => {
    on('ui.render', (_, e) => skinCard(e as never) as never)
    const ui = await mountResult($, FAILED, true, { isExpanded: true })

    expect(await ui.find({ type: 'Text', text: /^✖ exit 1$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^#14 41\.52 Type error:/ })).toBeUndefined()
  })

  test('a command that passed with an error buried in its output gets the line lifted, and a clean one nothing', async ($, on) => {
    let engineDrew = 0
    on('ui.render', () => (engineDrew++, { type: 'Box', props: { key: 'engine-own' } }))
    const passed = await mountResult($, { stdout: STDOUT, stderr: '', interrupted: false }, false)
    expect(await passed.find({ type: 'Text', text: /^▤ 2 error lines inside the fold$/ })).toBeDefined()
    expect(await passed.find({ type: 'Text', text: /^✖/ })).toBeUndefined()

    const clean = await mountResult($, { stdout: 'ok\nall good', stderr: '', interrupted: false }, false)
    expect(await clean.find({ type: 'Text' })).toBeUndefined()
    expect(engineDrew).toBe(2)
  })

  test('an edit or a read is never touched', async ($, on) => {
    let engineDrew = 0
    on('ui.render', () => (engineDrew++, { type: 'Box', props: { key: 'engine-own' } }))
    const ui = await ($ as never as { ui: { mount: (a: never) => Promise<{ find: (q: object) => Promise<unknown> }> } }).ui.mount({
      plugin: 'paste-view',
      surface: 'terminal',
      component: 'ToolResult',
      props: { tool_use_id: 't2', tool: 'Edit', output: '[ERROR] String to replace not found', isErrored: true },
    } as never)
    expect(await ui.find({ type: 'Text' })).toBeUndefined()
    expect(engineDrew).toBe(1)
  })
})
