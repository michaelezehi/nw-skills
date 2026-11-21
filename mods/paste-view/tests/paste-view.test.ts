import { describe, expect, test } from 'claude-code/testing'

import { HEAD, TAIL, kindOf, parsePrompt, planRows, segmentsOf, toneOf, wrapWords } from '../hooks/parse'
import { ACCENT, FG, LINK, MUTED, TONES } from '../hooks/register'

// A Docker build of a pnpm workspace that dies in `next build`, as `pnpm ship` prints it.
const NOISE = Array.from({ length: 60 }, (_, i) => `#14 ${(12 + i * 0.4).toFixed(3)} Progress: resolved ${i * 21}, reused ${i * 20}, downloaded 0, added ${i * 9}`)
const LOG = [
  '> devdeck@0.4.0 ship /Users/dev/src/devdeck',
  '> bash scripts/deploy-app.sh website --prod',
  '',
  '[INFO] Building image registry.example.com/devdeck/website:5476b34',
  '#1 [internal] load build definition from Dockerfile',
  '#1 transferring dockerfile: 4.21kB done',
  '#1 DONE 0.0s',
  '#12 [builder 6/9] COPY . .',
  '#12 CACHED',
  '#14 [builder 8/9] RUN pnpm --filter website build',
  ...NOISE,
  '#14 38.11 [WARN] Using edge runtime on a page disables static generation for that page',
  '#14 41.52 ./src/app/api/health/route.ts:14:9',
  "#14 41.52 Type error: Property 'uptime' does not exist on type 'Health'.",
  '#14 41.53 ',
  '#14 41.60  ELIFECYCLE  Command failed with exit code 1.',
  '#14 ERROR: process "/bin/sh -c pnpm --filter website build" did not complete successfully: exit code: 1',
  '------',
  ' > [builder 8/9] RUN pnpm --filter website build:',
  '------',
  'Dockerfile:190',
  '--------------------',
  ' 188 |     COPY . .',
  ' 189 |     ENV NEXT_TELEMETRY_DISABLED=1',
  ' 190 | >>> RUN pnpm --filter website build',
  ' 191 |     ',
  ' 192 |     FROM node:22-alpine AS runner',
  '--------------------',
  '[ERROR] failed to solve: process "/bin/sh -c pnpm --filter website build" did not complete successfully: exit code: 1',
  '[ERROR] Build failed for website',
  ' ELIFECYCLE  Command failed with exit code 1.',
]
const QUESTION = 'both ship and ship:staging are failing help me fix'
const PROMPT = `<pasted_content id="0d14">\n${LOG.join('\n')}\n</pasted_content id="0d14">\n\n${QUESTION}`

describe('detection', () => {
  test('the Docker failure is a log, with the tags gone and the question kept apart', () => {
    const p = parsePrompt(PROMPT)
    expect(p.pastes).toHaveLength(1)
    expect(p.pastes[0]?.kind).toBe('log')
    expect(p.pastes[0]?.id).toBe('0d14')
    expect(p.pastes[0]?.lines).toHaveLength(LOG.length)
    expect(p.words).toBe(QUESTION)
    expect(JSON.stringify(p)).not.toContain('pasted_content')
  })

  test('each kind is named', () => {
    expect(kindOf(['{', '  "name": "devdeck",', '  "version": "0.4.0"', '}'])).toBe('JSON')
    expect(kindOf(['diff --git a/a.ts b/a.ts', '@@ -1,2 +1,2 @@', '-const a = 1', '+const a = 2'])).toBe('diff')
    expect(
      kindOf(["TypeError: Cannot read properties of undefined (reading 'id')", '    at getUser (/app/src/user.ts:12:18)', '    at async handler (/app/src/route.ts:30:5)']),
    ).toBe('stack trace')
    expect(kindOf(['export function add(a: number, b: number): number {', '  return a + b', '}', 'const x = add(1, 2);'])).toBe('code')
    expect(kindOf(['just a note I copied', 'from somewhere else'])).toBe('text')
  })

  test('a closing tag without an id, a missing closing tag and two pastes all parse', () => {
    expect(parsePrompt('<pasted_content id="a1">\n[ERROR] one\n[INFO] two\n</pasted_content>\nwhy').words).toBe('why')
    expect(parsePrompt('look\n<pasted_content id="a1">\n[ERROR] one').pastes[0]?.lines).toEqual(['[ERROR] one'])
    const two = parsePrompt('<pasted_content id="a">\n{"a":1}\n</pasted_content id="a">\nand\n<pasted_content id="b">\n[ERROR] x\n[INFO] y\n</pasted_content id="b">\ncompare')
    expect(two.pastes.map(x => x.kind)).toEqual(['JSON', 'log'])
    expect(two.words).toBe('and\n\ncompare')
  })

  test('image marks leave the words and come back as numbers', () => {
    const p = parsePrompt('[Image #2] why is this card clipped [Image #3]')
    expect(p.images).toEqual([2, 3])
    expect(p.words).toBe('why is this card clipped')
  })
})

describe('colouring', () => {
  test('failures read as errors, warnings as warnings, the Dockerfile pointer as a pointer, noise as quiet', () => {
    expect(toneOf(' ELIFECYCLE  Command failed with exit code 1.', 'log')).toBe('error')
    expect(toneOf('[ERROR] Build failed for website', 'log')).toBe('error')
    expect(toneOf("#14 41.52 Type error: Property 'uptime' does not exist on type 'Health'.", 'log')).toBe('error')
    expect(toneOf('#14 38.11 [WARN] Using edge runtime on a page', 'log')).toBe('warn')
    expect(toneOf(' 190 | >>> RUN pnpm --filter website build', 'log')).toBe('pointer')
    expect(toneOf(' 189 |     ENV NEXT_TELEMETRY_DISABLED=1', 'log')).toBe('plain')
    expect(toneOf('[INFO] Building image', 'log')).toBe('muted')
    expect(toneOf('#1 DONE 0.0s', 'log')).toBe('muted')
    expect(toneOf('Found 0 errors. Watching for file changes.', 'log')).toBe('plain')
  })

  test('a diff is read by its signs, and code is never read for trouble', () => {
    expect(toneOf('+const a = 2', 'diff')).toBe('add')
    expect(toneOf('-const a = 1', 'diff')).toBe('del')
    expect(toneOf('@@ -1,2 +1,2 @@', 'diff')).toBe('hunk')
    expect(toneOf('throw new Error("failed")', 'code')).toBe('plain')
  })

  test('paths and URLs are cut out of a line', () => {
    const s = segmentsOf('#14 41.52 ./src/app/api/health/route.ts:14:9 see https://nextjs.org/docs/messages/x')
    expect(s.filter(x => x.isLink).map(x => x.text)).toEqual(['./src/app/api/health/route.ts:14:9', 'https://nextjs.org/docs/messages/x'])
    expect(s.map(x => x.text).join('')).toBe('#14 41.52 ./src/app/api/health/route.ts:14:9 see https://nextjs.org/docs/messages/x')
  })
})

describe('collapsing', () => {
  const paste = parsePrompt(PROMPT).pastes[0]!

  test('a long log keeps its head, its tail, every error and the pointer, and counts the rest', () => {
    const rows = planRows(paste)
    const shown = rows.flatMap(r => (r.type === 'line' ? [r] : []))
    const gaps = rows.flatMap(r => (r.type === 'gap' ? [r] : []))
    expect(shown.slice(0, HEAD).map(r => r.n)).toEqual([1, 2, 3, 4])
    expect(shown.at(-1)?.n).toBe(LOG.length)
    expect(shown.length).toBeLessThan(HEAD + TAIL + 8)
    const errors = paste.lines.flatMap((l, i) => (toneOf(l, 'log') === 'error' ? [i + 1] : []))
    for (const n of errors) expect(shown.map(r => r.n)).toContain(n)
    expect(shown.some(r => r.tone === 'pointer')).toBe(true)
    expect(shown.length + gaps.reduce((sum, g) => sum + g.hidden, 0)).toBe(LOG.length)
    expect(gaps.every(g => g.errors === 0)).toBe(true)
    expect(gaps[0]?.hidden).toBeGreaterThan(60)
  })

  test('a short paste and the ctrl+o view show every line', () => {
    expect(planRows({ id: '', kind: 'log', lines: LOG.slice(-10) }).every(r => r.type === 'line')).toBe(true)
    expect(planRows(paste, true)).toHaveLength(LOG.length)
  })

  test('prose wraps at word ends', () => {
    expect(wrapWords('both ship and ship:staging are failing', 14)).toEqual(['both ship and', 'ship:staging', 'are failing'])
  })
})

describe('draw', () => {
  const mount = (
    $: { ui: { mount: (args: never) => Promise<{ find: (q: object) => Promise<{ text?: string; props: Record<string, unknown> } | undefined> }> } },
    text: string,
    kind = 'composer',
  ) => $.ui.mount({ plugin: 'paste-view', surface: 'terminal', component: 'UserMessage', props: { text, origin: { kind }, isExpanded: false } } as never)

  test('the prompt draws a log card and the question as a chat line, no tags anywhere', async ($, on) => {
    let engineDrew = 0
    on('ui.render', () => (engineDrew++, { type: 'Box', props: { key: 'engine-own' } }))
    const ui = await mount($ as never, PROMPT)

    expect((await ui.find({ type: 'Text', text: /^▤ log $/ }))?.props.color).toBe(ACCENT)
    expect(await ui.find({ type: 'Text', text: new RegExp(`^· ${LOG.length} lines$`) })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ · \d+ errors$/ }))?.props.color).toBe(TONES.error)
    expect(await ui.find({ type: 'Text', text: /^\d+ lines hidden$/ })).toBeDefined()

    expect((await ui.find({ type: 'Text', text: /^ ELIFECYCLE {2}Command failed with exit code 1\.$/ }))?.props.color).toBe(TONES.error)
    expect((await ui.find({ type: 'Text', text: /^ 190 \| >>> RUN pnpm --filter website build$/ }))?.props.color).toBe(TONES.pointer)
    expect((await ui.find({ type: 'Text', text: /^\[INFO\] Building image $/ }))?.props.color).toBe(MUTED)
    expect((await ui.find({ type: 'Text', text: /^\/Users\/dev\/src\/devdeck$/ }))?.props.color).toBe(LINK)

    expect((await ui.find({ type: 'Text', text: new RegExp(`^${QUESTION}$`) }))?.props.color).toBe(FG)
    expect((await ui.find({ type: 'Text', text: /^you$/ }))?.props.color).toBe(MUTED)
    expect((await ui.find({ type: 'Text', text: /^▎ $/ }))?.props.color).toBe(ACCENT)
    expect(await ui.find({ type: 'Text', text: /pasted_content/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Progress: resolved 420,/ })).toBeUndefined()
    expect(engineDrew).toBe(0)
  })

  test('a short log shows whole, its warning in amber', async ($, on) => {
    on('ui.render', () => ({ type: 'Box', props: { key: 'engine-own' } }))
    const ui = await mount($ as never, `<pasted_content id="9f">\n${LOG.slice(70, 76).join('\n')}\n</pasted_content id="9f">`)

    expect((await ui.find({ type: 'Text', text: /^#14 38\.11 \[WARN\]/ }))?.props.color).toBe(TONES.warn)
    expect(await ui.find({ type: 'Text', text: /hidden$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^you$/ })).toBeUndefined()
  })

  test('a prompt with no paste is a chat line alone, its images as chips', async ($, on) => {
    on('ui.render', () => ({ type: 'Box', props: { key: 'engine-own' } }))
    const ui = await mount($ as never, 'ship it to staging [Image #2]')

    expect((await ui.find({ type: 'Text', text: /^ship it to staging$/ }))?.props.color).toBe(FG)
    expect((await ui.find({ type: 'Text', text: /^▎ $/ }))?.props.color).toBe(ACCENT)
    expect(await ui.find({ type: 'Text', text: /^you$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^▣ image 2$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /lines?$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /\[Image/ })).toBeUndefined()
  })

  test('a row nobody wrote, such as an automatic continuation, stays the engine own', async ($, on) => {
    let engineDrew = 0
    on('ui.render', () => (engineDrew++, { type: 'Box', props: { key: 'engine-own' } }))
    const ui = await mount($ as never, 'Continue from where you left off.', 'auto-continuation')

    expect(await ui.find({ type: 'Text', text: /^you$/ })).toBeUndefined()
    expect(engineDrew).toBe(1)
  })
})
