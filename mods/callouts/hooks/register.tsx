// callouts: what a reply marks for the person stands out. `> [!ACTION]` and `> [!SECRET]`
// draw as yellow cards, `> [!ASK]` and `> [!INPUT]` as violet ones, `> [!REVIEW]` as a violet
// outline, and all stay listed above the prompt, each with its answer, until answered or
// dismissed; a key typed into a SECRET goes straight into its .env file. `> [!DONE]` draws
// as a finished banner.
// Every function that takes `$` lives in this file: the engine follows `$` across no import.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Callout } from '../types'

import { band, calloutBlock } from './draw'
import { DEFAULT_PALETTE, parsePalette, themePath } from './palette'
import { openOf, parseCallouts, upsertEnv } from './parse'

const openAtom = atom({ plugin: 'callouts', key: 'open' } as const, [])
const paletteAtom = atom({ plugin: 'callouts', key: 'palette' } as const, DEFAULT_PALETTE)
const typedAtom = atom({ plugin: 'callouts', key: 'typed' } as const, {})

/**
 * What the person has typed into each SECRET field, by item key. Module memory only: never
 * in $.state, the transcript or a message, and dropped once saved or dismissed.
 */
const secrets = new Map<string, string>()
const keyOf = (c: Callout): string => `${c.kind}:${c.title}`

/** The field's text after an edit, from the masked value the field now holds. */
export function nextSecret(current: string, fieldValue: string): string {
  const dots = (fieldValue.match(/•/g) ?? []).length
  return current.slice(0, dots) + fieldValue.replace(/•/g, '')
}

/** Read the Devdeck theme, so the cards share the palette the person picked. */
async function loadPalette($: EngineInterface): Promise<void> {
  const xdg = await $.env.get('XDG_CONFIG_HOME').catch(() => undefined)
  const home = await $.env.get('HOME').catch(() => undefined)
  const path = themePath(xdg, home)
  const text = path === null ? null : await $.fs.read(path).then(out => (typeof out === 'string' ? out : null), () => null)
  await update($, paletteAtom, () => parsePalette(text))
}

/** Drop item `c`, and anything typed into it. */
async function drop($: EngineInterface, c: Callout): Promise<void> {
  secrets.delete(keyOf(c))
  await update($, typedAtom, typed => Object.fromEntries(Object.entries(typed).filter(([k]) => k !== keyOf(c))))
  await update($, openAtom, list => list.filter(x => keyOf(x) !== keyOf(c)))
}

/** Write the typed key into its .env file and tell the chat where it went, without the value. */
async function saveSecret($: EngineInterface, c: Callout): Promise<void> {
  const value = secrets.get(keyOf(c)) ?? ''
  if (!c.secret || !value || /[\r\n]/.test(value)) {
    $.ui.toast(value ? 'A key cannot hold a line break.' : 'Paste the key first.')
    return
  }
  const { name } = c.secret
  // Anchored to the session's folder, so the key lands in this repo whatever the process cwd.
  const cwd = await $.session.cwd()
  if (!cwd.startsWith('/')) throw new Error('no working directory')
  const path = `${cwd.replace(/\/+$/, '')}/${c.secret.path}`
  const before = await $.fs.read(path).then(out => (typeof out === 'string' ? out : ''), () => '')
  await $.fs.write(path, upsertEnv(before, name, value))
  await drop($, c)
  await $.prompt.submit({ text: `Saved ${name} to ${c.secret.path} (${value.length} characters; the value is not in this chat).` })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    secrets.clear()
    await update($, openAtom, () => [])
    await update($, typedAtom, () => ({}))
    await loadPalette($).catch(() => undefined)
    return started
  })

  // A reply that marks something replaces the list; a reply that marks nothing leaves it, so
  // an open question survives an unrelated command. The theme is read again with it.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    // A subagent's turn is not the reply the person reads.
    if (e.agentId === undefined && !e.isAborted) {
      const open = openOf(parseCallouts(e.answer))
      if (open.length > 0) {
        secrets.clear()
        await update($, typedAtom, () => ({}))
        await update($, openAtom, () => open)
      }
      await loadPalette($).catch(() => undefined)
    }
    return done
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const segments = parseCallouts(e.props.text)
    if (!segments.some(s => s.kind === 'callout')) return next(e)
    const ui = $.ui.resolve(e)
    const palette = await read($, paletteAtom)
    const parts: JSX.Element[] = []
    for (const [i, s] of segments.entries()) {
      // Markdown between the cards keeps the engine's own drawing: tables, code, lists.
      if (s.kind === 'markdown') parts.push(<ui.Box key={`md-${i}`}>{await next({ ...e, props: { ...e.props, text: s.text } })}</ui.Box>)
      else parts.push(calloutBlock(ui, s.callout, palette, `callout-${i}`))
    }
    return (
      <ui.Box key="callouts-message" flexDirection="column">
        {parts}
      </ui.Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const open = await read($, openAtom)
    if (open.length === 0 || e.props.hasSurvey) return next(e)
    const ui = $.ui.resolve(e)
    const palette = await read($, paletteAtom)
    const typed = await read($, typedAtom)
    const at = (index: number): Callout | undefined => open[index]
    const mine = band({
      ui,
      open,
      palette,
      columns: e.props.bodyColumns,
      masked: Object.fromEntries(open.map((c, i) => [i, typed[keyOf(c)] ?? 0])),
      answer: (index, text) => {
        const c = at(index)
        if (!c) return
        void drop($, c)
          .then(() => $.prompt.submit({ text }))
          .catch(() => undefined)
      },
      dismiss: index => {
        const c = at(index)
        if (c) void drop($, c).catch(() => undefined)
      },
      secretInput: (index, value) => {
        const c = at(index)
        if (!c) return
        const typedNow = nextSecret(secrets.get(keyOf(c)) ?? '', value)
        secrets.set(keyOf(c), typedNow)
        void update($, typedAtom, t => ({ ...t, [keyOf(c)]: typedNow.length })).catch(() => undefined)
      },
      secretSubmit: index => {
        const c = at(index)
        if (c) void saveSecret($, c).catch(() => $.ui.toast('The key could not be saved.'))
      },
    })
    if (mine === null) return next(e)
    return (
      <ui.Box key="callouts-above" flexDirection="column">
        {mine}
        {await next(e)}
      </ui.Box>
    )
  })
}
