import { describe, expect, test } from 'claude-code/testing'

import { parseReadouts, summaryOf, toneOf } from '../hooks/parse'
import { NEON, ZINC } from '../hooks/register'

const REPLY = [
  'Six projects now run next 16.4.6.',
  '',
  '**perspiva, crush-crm:** typecheck passes for all except founder-x (below).',
  '**crush-crm:** convex 1.51 changed the client method types, so `src/lib/client.ts`',
  'needed a fix to match.',
  '**Not changed:** optic-qa-ai was already on 16.4.6.',
  '**Not shipped:** crush-crm has a live session open.',
  '',
  'Ship the others?',
].join('\n')

describe('parse', () => {
  test('a run of labelled lines becomes one readout, wrapped lines joined to their row', () => {
    const s = parseReadouts(REPLY)
    expect(s.map(x => x.kind)).toEqual(['markdown', 'readout', 'markdown'])
    const rows = s[1]?.kind === 'readout' ? s[1].rows : []
    expect(rows.map(r => r.label)).toEqual(['perspiva, crush-crm', 'crush-crm', 'Not changed', 'Not shipped'])
    expect(rows[1]?.text).toBe('convex 1.51 changed the client method types, so `src/lib/client.ts` needed a fix to match.')
  })

  test('bullets and a colon outside the bold count; one lone row, a list item or a fence do not', () => {
    expect(parseReadouts('- **a**: one\n- **b**: two')[0]?.kind).toBe('readout')
    expect(parseReadouts('**Only:** one row\n\nthen prose').map(x => x.kind)).toEqual(['markdown'])
    expect(parseReadouts('```\n**a:** x\n**b:** y\n```').map(x => x.kind)).toEqual(['markdown'])
    const s = parseReadouts('**a:** one\n- a list item\n**b:** two')
    expect(s.some(x => x.kind === 'readout')).toBe(false)
  })

  test('misses read red, skips read quiet', () => {
    expect(toneOf('Not shipped')).toBe('error')
    expect(toneOf('Not changed')).toBe('muted')
    expect(toneOf('crush-crm')).toBeNull()
  })
})

describe('draw', () => {
  const mount = ($: Parameters<Parameters<typeof test>[1]>[0], on: Parameters<Parameters<typeof test>[1]>[1]) => {
    const drawn: string[] = []
    on('ui.render', ($, e) => {
      const text = (e.props as { text?: string }).text
      if (text !== undefined) drawn.push(text)
      return { type: 'Box', props: { key: 'engine-own' } }
    })
    return { drawn, msg: $.ui.mount({ plugin: 'readout', surface: 'terminal', component: 'AssistantMessage', props: { text: REPLY, isFirstOfReply: true } } as never) }
  }

  test('rows draw as folded cards: chip, one-line summary, the rest hidden until opened', async ($, on) => {
    const { drawn, msg: m } = mount($, on)
    const msg = await m
    expect((await msg.find({ type: 'Text', text: /^ crush-crm $/ }))?.props.backgroundColor).toBe(NEON[1])
    expect(await msg.find({ key: 'fold-1-1' })).toBeUndefined()
    expect(await msg.find({ type: 'Button', label: /^convex 1\.51 changed the client method types, so src\/lib\/client\.ts needed a fix to match\.$/ })).toBeUndefined()
    expect(drawn).toContain('Six projects now run next 16.4.6.')
    expect(drawn).not.toContain('optic-qa-ai was already on 16.4.6.')
  })

  test('a failure label gets a warning icon and a red border', async ($, on) => {
    const msg = await mount($, on).msg
    expect(await msg.find({ type: 'Text', text: '⚠' })).toBeDefined()
    expect(await msg.find({ key: 'card-1-3' })).toBeDefined()
  })

  test('opening a card draws its text and quiets the others in zinc', async ($, on) => {
    const reply = '**a:** First line. More detail here.\n**b:** Second one. And more.'
    const drawn: string[] = []
    on('ui.render', ($, e) => {
      const text = (e.props as { text?: string }).text
      if (text !== undefined) drawn.push(text)
      return { type: 'Box', props: { key: 'engine-own' } }
    })
    const msg = await $.ui.mount({ plugin: 'readout', surface: 'terminal', component: 'AssistantMessage', requestId: 'm1', props: { text: reply, isFirstOfReply: true } } as never)
    await msg.press({ key: 'fold-0-0' })
    expect(drawn).toContain('First line. More detail here.')
    expect((await msg.find({ type: 'Text', text: ' b ' }))?.props.backgroundColor).toBe(ZINC.line)
  })
})
