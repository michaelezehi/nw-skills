// The one-line band above the prompt: sprite, DEV, a dot per service, the
// latest reload or Convex call, the open error count, total memory.
import type { Elements } from 'claude-code'

import type { Activity, Palette, Snap } from '../types'

import { ANIMATE_MS, DIAMOND, DOT, bandServices, fmtMem, latestOf, statusColor } from './model'
import { SPRITE_COLS, spriteCells } from './sprite'

type Table = Elements['terminal'] | Elements['desktop'] | Elements['vscode'] | Elements['mobile']

export type BandInput = {
  ui: Table
  /** The terminal's Raster, null on a surface that has none. */
  Raster: Elements['terminal']['Raster'] | null
  snap: Snap
  clock: number
  frame: number
  activity: Activity | null
  palette: Palette
  columns: number
}

const LABEL = 'DEV'
const MIN_ACTIVITY = 8

export function band(p: BandInput): JSX.Element {
  const { Box, Text } = p.ui
  const colors = p.palette
  const services = bandServices(p.snap)
  const latest = latestOf(p.snap, p.clock, colors)
  const errors = p.snap.errorCount
  const errText = `${DIAMOND} ${errors}`
  const mem = fmtMem(p.snap.memMb)

  // Fixed pieces in the order they give way when the line is too narrow.
  let showMem = true
  let showSprite = p.Raster !== null
  const dotsW = Math.max(1, services.length * 2 - 1)
  const fixed = (): number => {
    const widths = [LABEL.length, dotsW]
    if (showSprite) widths.push(SPRITE_COLS)
    if (errors > 0) widths.push(errText.length)
    if (showMem) widths.push(mem.length)
    return widths.reduce((a, b) => a + b, 0) + widths.length - 1
  }
  let room = p.columns - fixed() - 1
  if (room < MIN_ACTIVITY && showMem) showMem = false
  room = p.columns - fixed() - 1
  if (room < MIN_ACTIVITY && showSprite) showSprite = false
  room = p.columns - fixed() - 1
  const showActivity = latest !== null && room >= MIN_ACTIVITY

  const isAnimating = p.activity !== null && p.clock - p.activity.at < ANIMATE_MS
  const Raster = p.Raster
  const sprite =
    showSprite && Raster ? (
      <Raster
        key="devdeck-sprite"
        columns={SPRITE_COLS}
        rows={1}
        cells={spriteCells(p.activity?.kind ?? null, isAnimating ? p.frame : 0, colors)}
      />
    ) : null

  return (
    <Box key="devdeck-band" flexDirection="row" gap={1} overflow="hidden">
      {sprite}
      <Box flexShrink={0}>
        <Text bold color={colors.accent}>
          {LABEL}
        </Text>
      </Box>
      <Box key="devdeck-dots" flexDirection="row" gap={1} flexShrink={0}>
        {services.map(s => (
          <Box key={`dot-${s.id}`}>
            <Text color={statusColor(s.status, colors)} dimColor={s.status === 'stopped'}>
              {DOT}
            </Text>
          </Box>
        ))}
      </Box>
      {showActivity && latest && (
        <Box key="devdeck-latest" width={Math.min(room, latest.text.length)} flexShrink={1}>
          <Text color={latest.color} wrap="truncate-end">
            {latest.text}
          </Text>
        </Box>
      )}
      {errors > 0 && (
        <Box key="devdeck-errors" flexShrink={0}>
          <Text color={colors.error}>{errText}</Text>
        </Box>
      )}
      {showMem && (
        <Box key="devdeck-mem" flexShrink={0}>
          <Text color={colors.muted}>{mem}</Text>
        </Box>
      )}
    </Box>
  )
}
