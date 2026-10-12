// callouts: what a reply marks for the person stands out. `> [!ACTION]`, `> [!ASK]` and
// `> [!INPUT]` blocks draw as yellow cards in the transcript and stay pinned above the
// prompt, with buttons or a field, until answered; `> [!DONE]` draws as a finished banner.
// Every function that takes `$` lives in this file: the engine follows `$` across no import.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { band, calloutBlock } from './draw'
import { DEFAULT_PALETTE, parsePalette, themePath } from './palette'
import { openOf, parseCallouts } from './parse'

const openAtom = atom({ plugin: 'callouts', key: 'open' } as const, [])
const paletteAtom = atom({ plugin: 'callouts', key: 'palette' } as const, DEFAULT_PALETTE)

/** Read the Devdeck theme, so the cards share the palette the person picked. */
async function loadPalette($: EngineInterface): Promise<void> {
  const xdg = await $.env.get('XDG_CONFIG_HOME').catch(() => undefined)
  const home = await $.env.get('HOME').catch(() => undefined)
  const path = themePath(xdg, home)
  const text = path === null ? null : await $.fs.read(path).then(out => (typeof out === 'string' ? out : null), () => null)
  await update($, paletteAtom, () => parsePalette(text))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await update($, openAtom, () => [])
    await loadPalette($).catch(() => undefined)
    return started
  })

  // The reply's open callouts become the band; the theme is read again with it.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    // A subagent's turn is not the reply the person reads.
    if (e.agentId === undefined && !e.isAborted) {
      await update($, openAtom, () => openOf(parseCallouts(e.answer)))
      await loadPalette($).catch(() => undefined)
    }
    return done
  })

  // Anything the person sends answers what was open.
  on('prompt.submit', async ($, e, next) => {
    if ((await read($, openAtom)).length > 0) await update($, openAtom, () => [])
    return next(e)
  }).catch(($, e, next) => next(e)) // never stands between the person and their message

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
    const drop = (index: number): void => void update($, openAtom, list => list.filter((_, i) => i !== index)).catch(() => undefined)
    const mine = band({
      ui,
      open,
      palette,
      columns: e.props.bodyColumns,
      maxRows: e.props.maxRows,
      answer: (index, text) => {
        drop(index)
        void $.prompt.submit({ text }).catch(() => undefined)
      },
      dismiss: drop,
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
