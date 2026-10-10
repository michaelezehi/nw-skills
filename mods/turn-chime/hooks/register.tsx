import type { Register } from 'claude-code'

const LONG_TURN_MS = 60_000

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.reason === 'answer' && e.durationMs >= LONG_TURN_MS) {
      const seconds = Math.round(e.durationMs / 1000)
      $.ui.toast(`Done after ${seconds}s`)
      void $.audio.play({ asset: 'sounds/done.aiff' }).catch(() => undefined)
    }

    return result
  })
}
