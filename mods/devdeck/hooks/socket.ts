// Where Devdeck listens and how often the mod asks. The loop itself lives in
// register.tsx, since the engine follows `$` only within one file.

export const SOCKET = '.devdeck/devdeck.sock'
export const STATE_URL = 'http://devdeck/state'
export const ERRORS_URL = 'http://devdeck/errors'

export const POLL_MS = 1000
export const RETRY_MS = 10_000
export const FRAME_MS = 250
/** A GET that has not answered by then counts as a failed poll. */
export const FETCH_TIMEOUT_MS = 1500
const MAX_DEPTH = 24

/** Every folder from `dir` up to the root, nearest first. */
export function ancestors(dir: string): string[] {
  const out: string[] = []
  let at = dir.replace(/\/+$/, '') || '/'
  for (let i = 0; i < MAX_DEPTH; i++) {
    out.push(at)
    if (at === '/') break
    const cut = at.lastIndexOf('/')
    at = cut <= 0 ? '/' : at.slice(0, cut)
  }
  return out
}

/** The socket path Devdeck would use with `dir` as the repo root. */
export const socketIn = (dir: string): string => `${dir === '/' ? '' : dir}/${SOCKET}`
