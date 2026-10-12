import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

import { answerText, openOf, parseCallouts, secretTarget, upsertEnv } from '../hooks/parse'
import { nextSecret } from '../hooks/register'
import { wrapText } from '../hooks/draw'

const HOME = '/home/me'
const THEME = `${HOME}/.config/devdeck/theme.json`
const BAND: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 10 }, view: {},
}
const REPLY = [
  'The staging ship is on its i18n gate.',
  '',
  '| Change | Impact |',
  '|---|---|',
  '| MUI removed | None |',
  '',
  '> [!ACTION] Start pnpm dev and tell me after about 4 minutes.',
  '> I need the dev-memory reading.',
  '',
  '> [!DONE] The work is done.',
  '> Pushed and tagged.',
].join('\n')

function world(on: On, theme?: string) {
  mock.clock(on, { now: 1000 })
  mock.env(on, { HOME })
  const sent: string[] = []
  // The text each engine drawing was asked for, in order.
  const drawn: string[] = []
  const files = new Map<string, string>()
  if (theme) files.set(THEME, theme)
  const toasts: string[] = []
  on('fs.read', ($, e) => (files.has(e.path) ? { value: files.get(e.path) } : { deny: 'ENOENT' }))
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: null }
  })
  on('ui.toast', ($, e) => {
    toasts.push(String(e.text))
    return { value: null }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('ui.render', ($, e) => {
    const text = (e.props as { text?: string }).text
    if (text !== undefined) drawn.push(text)
    return { type: 'Box', props: { key: 'engine-own' } }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('turn.complete', () => ({ text: '' }))
  return { sent, drawn, files, toasts }
}

const turn = (answer: string) => ({ answer, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' }) as never

describe('parse', () => {
  test('splits a reply into markdown and callouts in order', () => {
    const segs = parseCallouts(REPLY)
    expect(segs.map(s => s.kind)).toEqual(['markdown', 'callout', 'callout'])
    expect(segs[1]).toEqual({ kind: 'callout', callout: { kind: 'action', title: 'Start pnpm dev and tell me after about 4 minutes.', body: ['I need the dev-memory reading.'], options: [] } })
    expect(openOf(segs).map(c => c.kind)).toEqual(['action'])
  })

  test('reads an ASK with its options, an INPUT, and a title on the next line', () => {
    const segs = parseCallouts('> [!ASK] Which environment?\n> - staging\n> - production\n\n> [!input]\n> Paste the deploy tag.')
    expect(openOf(segs)).toEqual([
      { kind: 'ask', title: 'Which environment?', body: [], options: ['staging', 'production'] },
      { kind: 'input', title: 'Paste the deploy tag.', body: [], options: [] },
    ])
    expect(answerText(openOf(segs)[0]!, 'staging')).toBe('staging')
  })

  test('leaves a plain quote and a reply without callouts alone', () => {
    expect(parseCallouts('> just a quote\n\ntext')).toEqual([{ kind: 'markdown', text: '> just a quote\n\ntext' }])
  })
})

describe('transcript', () => {
  test('draws a yellow card for the action and a banner for done, markdown left to the engine', async ($, on) => {
    const { drawn } = world(on, JSON.stringify({ colors: { accent: '#facc15' } }))
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    const msg = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } })
    expect(drawn).toEqual(['The staging ship is on its i18n gate.\n\n| Change | Impact |\n|---|---|\n| MUI removed | None |'])
    expect(await msg.find({ key: 'engine-own' })).toBeDefined()
    const card = await msg.find({ key: 'callout-1' })
    expect(card?.props.backgroundColor).toBe('#facc15')
    expect(await msg.find({ type: 'Text', text: '⚑  N E E D S   Y O U' })).toBeDefined()
    expect(await msg.find({ type: 'Text', text: 'Start pnpm dev and tell me after about 4 minutes.' })).toBeDefined()
    expect(await msg.find({ type: 'Text', text: '✓  D O N E' })).toBeDefined()
    expect(await msg.find({ type: 'Text', text: 'The work is done.' })).toBeDefined()
  })

  test('a reply with no callouts is the engine drawing alone', async ($, on) => {
    world(on)
    const msg = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AssistantMessage', props: { text: 'hello', isFirstOfReply: true } })
    expect(await msg.find({ key: 'callouts-message' })).toBeUndefined()
    expect(await msg.find({ key: 'engine-own' })).toBeDefined()
  })
})

describe('band', () => {
  test('pins the open action above the prompt, Done sends the answer and clears it', async ($, on) => {
    const { sent } = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turn(REPLY))
    const row = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    const head = await row.find({ key: 'callout-head' })
    expect(head?.props.backgroundColor).toBe('#fde047')
    expect(await row.find({ type: 'Text', text: '⚑  1 THING NEEDS YOU' })).toBeDefined()
    expect(await row.find({ type: 'Text', text: 'Start pnpm dev and tell me after about 4 minutes.' })).toBeDefined()
    expect(await row.find({ key: 'engine-own' })).toBeDefined()
    await row.press({ key: 'done-0' })
    expect(sent).toEqual(['Done: Start pnpm dev and tell me after about 4 minutes.'])
    const after = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await after.find({ key: 'callouts-band' })).toBeUndefined()
  })

  test('an ASK offers its options as buttons; Not now drops it without sending', async ($, on) => {
    const { sent } = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turn('> [!ASK] Ship to?\n> - staging\n> - production'))
    const row = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ key: 'opt-0-1' })).toBeDefined()
    await row.press({ key: 'later-0' })
    expect(sent).toEqual([])
    const after = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await after.find({ key: 'callouts-band' })).toBeUndefined()
  })

  test('a long question and long options wrap onto stacked rows, never cut', async ($, on) => {
    const { sent } = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    const question = 'Should the Time and pay tab replace the Attendance tab on the profile, or sit beside it?'
    const option = 'Replace it, old ?tab=attendance links open the new tab (recommended)'
    await $.turn.complete(turn(`> [!ASK] ${question}\n> - ${option}\n> - Keep both tabs`))
    const narrow = { ...BAND, bodyColumns: 40 }
    const row = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: narrow })
    const lines = wrapText(question, 36)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe(question)
    for (const line of lines) expect(await row.find({ type: 'Text', text: line })).toBeDefined()
    const optionLines = wrapText(option, 33)
    expect(optionLines.join(' ')).toBe(option)
    for (const line of optionLines) expect(await row.find({ type: 'Text', text: line })).toBeDefined()
    await row.press({ key: 'opt-btn-0-0' })
    expect(sent).toEqual([option])
  })

  test('wrapText keeps every word and splits one longer than the width', () => {
    expect(wrapText('one two three', 8)).toEqual(['one two', 'three'])
    expect(wrapText('abcdefghijkl', 8)).toEqual(['abcdefgh', 'ijkl'])
  })

  test('an unrelated prompt keeps the band; the next reply with callouts replaces it', async ($, on) => {
    world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turn('> [!INPUT] Release tag?\n\n> [!ACTION] Approve the copy.'))
    await $.prompt.submit({ text: '/own-goal' } as never)
    await $.turn.complete(turn('Working on it.'))
    const row = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ type: 'Text', text: '⚑  2 THINGS NEED YOU' })).toBeDefined()
    expect(await row.find({ key: 'input-0' })).toBeDefined()
    await $.turn.complete(turn('> [!ACTION] Restart the app.'))
    const after = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await after.find({ type: 'Text', text: '⚑  1 THING NEEDS YOU' })).toBeDefined()
    expect(await after.find({ key: 'input-0' })).toBeUndefined()
  })
})

describe('secrets', () => {
  test('a SECRET names only a .env file inside the repo', () => {
    expect(secretTarget('OPENROUTER_API_KEY in apps/web/.env.local')).toEqual({ name: 'OPENROUTER_API_KEY', path: 'apps/web/.env.local' })
    expect(secretTarget('`RESEND_API_KEY` in `.env`')).toEqual({ name: 'RESEND_API_KEY', path: '.env' })
    expect(secretTarget('KEY in ../other/.env')).toBeUndefined()
    expect(secretTarget('KEY in /etc/.env')).toBeUndefined()
    expect(secretTarget('KEY in ~/.zshrc')).toBeUndefined()
    expect(secretTarget('KEY in apps/web/config.ts')).toBeUndefined()
    expect(secretTarget('Paste your key')).toBeUndefined()
  })

  test('upsertEnv replaces the line, appends a new one, and quotes what a shell would split', () => {
    expect(upsertEnv('A=1\nKEY=old\n', 'KEY', 'new')).toBe('A=1\nKEY=new\n')
    expect(upsertEnv('A=1\n', 'KEY', 'sk-123')).toBe('A=1\nKEY=sk-123\n')
    expect(upsertEnv('', 'KEY', 'a b#c')).toBe('KEY="a b#c"\n')
  })

  test('the masked field keeps the real characters through typing, paste and backspace', () => {
    expect(nextSecret('', 's')).toBe('s')
    expect(nextSecret('s', '•k-12')).toBe('sk-12')
    expect(nextSecret('sk-12', '••••')).toBe('sk-1')
  })

  test('a pasted key goes into its .env file, is shown as dots, and never reaches the chat', async ($, on) => {
    const { sent, files, toasts } = world(on)
    files.set('/repo/apps/web/.env.local', 'NEXT_PUBLIC_URL=http://localhost:3000\n')
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turn('> [!SECRET] OPENROUTER_API_KEY in apps/web/.env.local'))
    const row = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    await row.input({ key: 'secret-0', text: 'sk-or-v1-abc', kind: 'change' } as never)
    const typed = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await typed.find({ key: 'secret-0' }))?.props.value).toBe('••••••••••••')
    expect(JSON.stringify(await typed.drawn())).not.toContain('sk-or')
    await typed.input({ key: 'secret-0', text: '••••••••••••', kind: 'submit' } as never)
    // The save runs after the press returns: wait for the message it ends with.
    for (let i = 0; i < 100 && sent.length === 0; i++) await new Promise(r => setTimeout(r, 5))
    expect(toasts).toEqual([])
    expect(files.get('/repo/apps/web/.env.local')).toBe('NEXT_PUBLIC_URL=http://localhost:3000\nOPENROUTER_API_KEY=sk-or-v1-abc\n')
    expect(sent).toEqual(['Saved OPENROUTER_API_KEY to apps/web/.env.local (12 characters; the value is not in this chat).'])
    expect(sent.join(' ')).not.toContain('sk-or')
  })
})
