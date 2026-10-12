import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

import { answerText, openOf, parseCallouts } from '../hooks/parse'

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
  on('fs.read', ($, e) => (e.path === THEME && theme ? { value: theme } : { deny: 'ENOENT' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
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
  return { sent, drawn }
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
    expect(await row.find({ type: 'Text', text: '⚑ NEEDS YOU  ·  Start pnpm dev and tell me after about 4 minutes.' })).toBeDefined()
    expect(await row.find({ key: 'engine-own' })).toBeDefined()
    await row.press({ key: 'callout-done' })
    expect(sent).toEqual(['Done: Start pnpm dev and tell me after about 4 minutes.'])
    const after = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await after.find({ key: 'callouts-band' })).toBeUndefined()
  })

  test('an ASK offers its options as buttons; Not now drops it without sending', async ($, on) => {
    const { sent } = world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turn('> [!ASK] Ship to?\n> - staging\n> - production'))
    const row = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await row.find({ key: 'callout-opt-1' })).toBeDefined()
    await row.press({ key: 'callout-later' })
    expect(sent).toEqual([])
    const after = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await after.find({ key: 'callouts-band' })).toBeUndefined()
  })

  test('anything the person sends clears the band', async ($, on) => {
    world(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turn('> [!INPUT] Paste the deploy tag.'))
    expect(await (await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })).find({ key: 'callout-input' })).toBeDefined()
    await $.prompt.submit({ text: 'v2.1' } as never)
    const after = await $.ui.mount({ plugin: 'callouts', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await after.find({ key: 'callouts-band' })).toBeUndefined()
  })
})
