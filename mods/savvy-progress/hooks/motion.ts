// The frame clock: one 125 ms tick that redraws the band and the pane while
// something moves (a worker runs, a finish is celebrated), and no timer at all
// while nothing does. The drawings read the frame from the time, so a frame is
// the same picture on every redraw.
import type { EngineInterface, Timer } from 'claude-code'

import type { AgentRun, Flow } from '../types'

export const FRAME_MS = 125
// How long a finish is celebrated before the crab and the bar settle.
export const CELEBRATE_MS = 3000

export const frameOf = (at: number): number => Math.floor(at / FRAME_MS)

// Frames since `endedAt` while the finish is still celebrated, else null.
export const partyFrame = (endedAt: number | undefined, at: number): number | null =>
  endedAt !== undefined && endedAt > 0 && at >= endedAt && at - endedAt < CELEBRATE_MS ? Math.floor((at - endedAt) / FRAME_MS) : null

// True while anything on screen animates: a worker runs, the flow has work out,
// a run finished or the flow closed under CELEBRATE_MS ago.
export function isMoving(f: Flow | null, list: AgentRun[], at: number, finishedAt: number): boolean {
  if (list.some(a => a.status === 'running')) return true
  if (f && !f.isFinished && f.running > 0) return true
  if (list.some(a => a.status === 'done' && partyFrame(a.endedAt, at) !== null)) return true
  return f?.isFinished === true && partyFrame(finishedAt, at) !== null
}

export type MotionSource = {
  // Read fresh on every frame: what is on screen and when the flow last closed.
  state: () => Promise<{ f: Flow | null; list: AgentRun[]; finishedAt: number }>
  // Draws the frame at `at`, by writing the time the drawings read.
  draw: (at: number) => Promise<void>
}

export type Motion = {
  // Something may have started moving: runs the clock if it is not running.
  kick: () => void
  stop: () => void
}

/**
 * One module load's frame clock. The tick that finds nothing moving still draws
 * its frame, so the settled pose reaches the screen, then cancels itself; the
 * next kick that finds something moving starts a fresh one.
 */
export function startMotion($: EngineInterface, src: MotionSource): Motion {
  let timer: Timer | null = null
  // Set by a kick, so a frame in flight that read the state before it does not
  // stop the clock under the change.
  let isKicked = false
  let isStopped = false

  const frame = async (mine: Timer): Promise<void> => {
    // A tick that resolves after a newer clock started leaves that one alone.
    if (timer !== mine || isStopped) return mine.cancel()
    isKicked = false
    const at = await $.clock.now()
    const { f, list, finishedAt } = await src.state()
    if (timer !== mine || isStopped) return mine.cancel()
    await src.draw(at)
    if (timer === mine && !isKicked && !isMoving(f, list, at, finishedAt)) {
      mine.cancel()
      timer = null
    }
  }

  // Starts a clock only when something moves: an idle kick costs two reads, no timer.
  const kick = (): void => {
    isKicked = true
    if (timer !== null || isStopped) return
    void (async () => {
      const at = await $.clock.now()
      const { f, list, finishedAt } = await src.state()
      if (timer !== null || isStopped || !isMoving(f, list, at, finishedAt)) return
      const t: Timer = $.clock.every(FRAME_MS, () => void frame(t).catch(() => undefined))
      timer = t
    })().catch(() => undefined)
  }

  const stop = (): void => {
    isStopped = true
    timer?.cancel()
    timer = null
  }

  return { kick, stop }
}
