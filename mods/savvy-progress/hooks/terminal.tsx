// Terminal drawing: the desktop's look painted in colored cells. A Raster cell
// holds a glyph with a 24-bit foreground and background, so half blocks give two
// square pixels per cell and the crabs, the dithered bar and the pill survive in
// any truecolor terminal, with no image protocol.
import type { Elements } from 'claude-code'

import type { AgentRun, Flow, PlannedTask } from '../types'

import { CLAY, COSTUMES, INK, crabBody } from './sprites'
import type { Fill } from './sprites'

type Ui = Elements['terminal']
type Planned = PlannedTask & { n: number }

export type Look = {
  s: Record<string, string>
  accent: string
  done: string
  tierColor: Record<string, string>
  tierModel: Record<string, string>
  colorOf: (tier: string) => string
  tierOf: (type: string) => string
  costumeOf: (type: string) => string
  modelName: (id: string) => string
  fmtTokens: (n: number) => string
  fmtCost: (usd: number) => string
  fmtTime: (ms: number) => string
  elapsed: (a: AgentRun, at: number) => number
  ctxOf: (a: AgentRun) => number
  progressOf: (a: AgentRun) => number | null
}

const DEFAULT = 0x01000000
const BG = 0x1e1e22
const TRACK = 0x2c2c32
const FAINT = 0x45454c
const WHITE = 0xffffff

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

const rgbOf = (hex: string): number => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h
  return parseInt(full, 16) & 0xffffff
}

const mix = (a: number, b: number, t: number): number => {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

class Grid {
  readonly words: Uint32Array

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    this.words = new Uint32Array(columns * rows * 3)
    for (let i = 0; i < columns * rows; i++) this.words.set([0x20, DEFAULT, DEFAULT], i * 3)
  }

  set(x: number, y: number, glyph: string, fg: number, bg: number): void {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return
    this.words.set([glyph.codePointAt(0) ?? 0x20, fg, bg], (y * this.columns + x) * 3)
  }

  cells(): string {
    return base64(new Uint8Array(this.words.buffer))
  }
}

// Deterministic noise so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return v - Math.floor(v)
}

// --- crabs: hand-drawn minis colored from the shared 30×28 sprites.

const SPRITE_W = 30
const SPRITE_H = 28
const INK_RGB = rgbOf(INK)

function spritePixels(costume: string, tint: string): Int32Array {
  const px = new Int32Array(SPRITE_W * SPRITE_H).fill(-1)
  const fill: Fill = (x, y, w, h, c) => {
    const rgba = /rgba\((\d+),(\d+),(\d+),([.\d]+)\)/.exec(c.replace(/\s/g, ''))
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= SPRITE_W || yy >= SPRITE_H) continue
        const i = yy * SPRITE_W + xx
        if (rgba) {
          const color = (Number(rgba[1]) << 16) | (Number(rgba[2]) << 8) | Number(rgba[3])
          const under = (px[i] ?? -1) < 0 ? BG : (px[i] ?? BG)
          px[i] = mix(under, color, Number(rgba[4]))
        } else {
          px[i] = rgbOf(c)
        }
      }
    }
  }
  const draw = COSTUMES[costume] ?? ((g: Fill) => crabBody(g))
  draw(fill, tint)
  return px
}

// A crab drawn for 6×4 pixels: a shrunk sprite loses its eyes and legs, so
// only the body and hat colors come from the full costume.
const MINI = ['.HHHH.', 'CICCIC', '.CCCC.']
const LEGS = ['.C..C.', 'C.CC.C']

function colorsOf(px: Int32Array): { body: number; hat: number } {
  const tally = (y0: number, y1: number, skip: number[]) => {
    const counts = new Map<number, number>()
    for (let i = y0 * SPRITE_W; i < y1 * SPRITE_W; i++) {
      const c = px[i] ?? -1
      if (c >= 0 && !skip.includes(c)) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return [...counts].sort((x, y) => y[1] - x[1])[0]?.[0]
  }
  const body = tally(12, SPRITE_H, [INK_RGB]) ?? rgbOf(CLAY)
  return { body, hat: tally(0, 10, [INK_RGB, body]) ?? body }
}

function miniPixels(costume: string, tint: string, step: number): Int32Array {
  const { body, hat } = colorsOf(spritePixels(costume, tint))
  const color: Record<string, number> = { H: hat, C: body, I: INK_RGB }
  const rows = [...MINI, LEGS[step % 2] ?? '']
  const out = new Int32Array(CRAB_COLS * rows.length).fill(-1)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (out[y * CRAB_COLS + x] = color[ch] ?? -1)))
  return out
}

function halfBlocks(px: Int32Array, w: number, h: number, dim: boolean): Grid {
  const grid = new Grid(w, Math.ceil(h / 2))
  const tone = (c: number) => (dim ? mix(c, BG, 0.55) : c)
  for (let r = 0; r < grid.rows; r++) {
    for (let x = 0; x < w; x++) {
      const top = px[2 * r * w + x] ?? -1
      const bottom = px[(2 * r + 1) * w + x] ?? -1
      if (top >= 0 && bottom >= 0) grid.set(x, r, '▀', tone(top), tone(bottom))
      else if (top >= 0) grid.set(x, r, '▀', tone(top), DEFAULT)
      else if (bottom >= 0) grid.set(x, r, '▄', tone(bottom), DEFAULT)
    }
  }
  return grid
}

const CRAB_COLS = 6
const CRAB_ROWS = 2

function crabCells(costume: string, tint: string, step: number, dim: boolean): string {
  const px = miniPixels(costume, tint, step)
  return halfBlocks(px, CRAB_COLS, CRAB_ROWS * 2, dim).cells()
}

// A six-pixel crab for the one-row band; the legs swap each tick while busy.
function miniCrabCells(step: number, isWalking: boolean): string {
  const clay = rgbOf(CLAY)
  const top = [1, 1, 1, 1, 1, 1]
  const legs = isWalking && step % 2 === 1 ? [0, 1, 0, 0, 1, 0] : [1, 0, 1, 1, 0, 1]
  const grid = new Grid(6, 1)
  top.forEach((t, x) => {
    const b = legs[x] === 1
    if (t && b) grid.set(x, 0, '█', clay, DEFAULT)
    else if (t) grid.set(x, 0, '▀', clay, DEFAULT)
  })
  grid.set(2, 0, '▀', rgbOf(INK), clay)
  grid.set(3, 0, '▀', rgbOf(INK), clay)
  return grid.cells()
}

// --- the band's bar: a rounded track, dithered fill, faint running layer, the pill.

function barCells(f: Flow, width: number, label: string, ratio: number, accent: number): string {
  const grid = new Grid(width, 1)
  const inner = width - 2
  const fill = Math.round(inner * ratio)
  const run = f.total ? Math.round((inner * Math.min(f.total, f.done + f.running)) / f.total) : 0

  grid.set(0, 0, '▐', TRACK, DEFAULT)
  grid.set(width - 1, 0, '▌', TRACK, DEFAULT)
  const dots = ['▪', '▘', '▝', '▖', '▗', '▚', '▞', '·']
  for (let i = 0; i < inner; i++) {
    const x = i + 1
    if (i < fill) {
      const density = 0.35 + 0.6 * Math.pow(i / Math.max(1, fill), 1.2)
      const shade = mix(accent, WHITE, noise(i, 3) * 0.35)
      if (noise(i, 1) < density) grid.set(x, 0, dots[Math.floor(noise(1, i) * dots.length)] ?? '·', shade, TRACK)
      else grid.set(x, 0, ' ', TRACK, TRACK)
    } else if (i < run) {
      grid.set(x, 0, noise(i + 7, 3) < 0.4 ? '·' : ' ', mix(accent, TRACK, 0.55), TRACK)
    } else {
      grid.set(x, 0, ' ', TRACK, TRACK)
    }
  }
  for (let t = 1; t < f.total; t++) {
    const x = 1 + Math.round((inner * t) / f.total)
    if (x > fill + 2 && x < width - 1) grid.set(x, 0, '╎', FAINT, TRACK)
  }

  const text = ` ${label} `
  const pillW = Math.min(inner, [...text].length)
  const pillX = 1 + Math.max(0, Math.min(inner - pillW, fill - pillW))
  ;[...text].slice(0, pillW).forEach((ch, k) => grid.set(pillX + k, 0, ch, WHITE, accent))
  grid.set(pillX - 1, 0, '▐', accent, pillX - 1 === 0 ? DEFAULT : TRACK)
  if (pillX + pillW < width) grid.set(pillX + pillW, 0, '▌', accent, pillX + pillW === width - 1 ? DEFAULT : TRACK)
  return grid.cells()
}

function lineCells(width: number, ratio: number | null, ctx: number, color: number): string {
  const grid = new Grid(width, 1)
  const filled = Math.round(width * (ratio ?? ctx / 100))
  const fg = ratio === null ? 0x6a6a72 : color
  for (let x = 0; x < width; x++) grid.set(x, 0, '━', x < filled ? fg : 0x38383e, DEFAULT)
  return grid.cells()
}

// --- the band above the prompt.

export type BandProps = {
  f: Flow
  label: string
  ratio: number
  percent: string
  isWorking: boolean
  step: number
  columns: number
  crewButton: JSX.Element
  dismiss: JSX.Element
  look: Look
}

export function terminalBand(ui: Ui, p: BandProps): JSX.Element {
  const { Box, Text, Raster } = ui
  const color = p.f.isFinished ? p.look.done : p.look.accent
  const titleW = Math.max(8, Math.min(28, p.f.title.length + 1, Math.floor(p.columns / 3)))
  const barW = Math.max(10, p.columns - titleW - 26)

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={color}>●</Text>
      <Box width={titleW} flexShrink={0}>
        <Text bold wrap="truncate-end">
          {p.f.title}
        </Text>
      </Box>
      <Raster key="savvy-bar" columns={barW} rows={1} cells={barCells(p.f, barW, p.label, p.ratio, rgbOf(color))} />
      <Text dimColor>{p.percent.padStart(4)}</Text>
      <Raster key="savvy-mini" columns={6} rows={1} cells={miniCrabCells(p.step, p.isWorking)} />
      {p.crewButton}
      {p.dismiss}
    </Box>
  )
}

// --- the agents pane.

export type PaneProps = {
  title: string
  running: AgentRun[]
  finished: AgentRun[]
  planned: Planned[]
  totals: { cost: number; tokens: number; time: number }
  at: number
  step: number
  columns: number
  isCompact: boolean
  isDoneCollapsed: boolean
  toggleCompact: JSX.Element
  toggleDone: JSX.Element
  look: Look
}

const STATUS: Record<string, { glyph: string; color: string }> = {
  running: { glyph: '●', color: '#5fbf8f' },
  done: { glyph: '✓', color: '#3B9C5F' },
  failed: { glyph: '✗', color: '#D0453F' },
}

function tile(ui: Ui, key: string, label: string, value: string): JSX.Element {
  const { Box, Text } = ui
  return (
    <Box key={key} flexDirection="column" flexGrow={1} borderStyle="round" borderColor="#3d3d44" paddingX={1}>
      <Text dimColor>{label}</Text>
      <Text bold>{value}</Text>
    </Box>
  )
}

function agentCard(ui: Ui, p: PaneProps, a: AgentRun): JSX.Element {
  const { Box, Text, Raster } = ui
  const { look } = p
  const tier = look.tierOf(a.type)
  const costume = look.costumeOf(a.type)
  const tint = look.colorOf(tier === 'other' && costume === 'explore' ? 'medium' : tier)
  const status = STATUS[a.status] ?? STATUS.running!
  const model = a.effort ? `${look.modelName(a.model)} · ${a.effort}` : look.modelName(a.model)
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stats = `ctx ${look.ctxOf(a)}% · ${look.fmtTokens(a.contextTokens)} ≈${look.fmtCost(a.costUsd)} ${look.fmtTime(look.elapsed(a, p.at))}`
  const lineW = Math.max(10, p.columns - CRAB_COLS - 5)
  const isWalking = a.status === 'running'

  return (
    <Box key={a.id} flexDirection="row" gap={2} marginBottom={1}>
      <Raster key={`crab-${a.id}`} columns={CRAB_COLS} rows={CRAB_ROWS} cells={crabCells(costume, tint, isWalking ? p.step : 0, false)} />
      <Box flexDirection="column" flexGrow={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {a.description || a.type}
          </Text>
          <Text color={status.color}>{status.glyph}</Text>
        </Box>
        <Text wrap="truncate-end">
          <Text color={tint}>{tier === 'other' ? a.type : tier}</Text>
          <Text dimColor> {model}</Text>
        </Text>
        <Box flexDirection="row" justifyContent="space-between">
          <Text wrap="truncate-end">{steps}</Text>
          <Text dimColor>{stats}</Text>
        </Box>
        <Raster key={`line-${a.id}`} columns={lineW} rows={1} cells={lineCells(lineW, look.progressOf(a), look.ctxOf(a), rgbOf(tint))} />
      </Box>
    </Box>
  )
}

function plannedCard(ui: Ui, p: PaneProps, pl: Planned): JSX.Element {
  const { Box, Text, Raster } = ui
  const { look } = p
  const tier = pl.tier in look.tierColor ? pl.tier : 'other'
  const tint = look.colorOf(tier)

  return (
    <Box key={`plan-${pl.n}`} flexDirection="row" gap={2} marginBottom={1}>
      <Raster key={`crab-plan-${pl.n}`} columns={CRAB_COLS} rows={CRAB_ROWS} cells={crabCells(tier, tint, 0, true)} />
      <Box flexDirection="column" flexGrow={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold dimColor wrap="truncate-end">
            {pl.n}. {pl.title}
          </Text>
          <Text dimColor>◷</Text>
        </Box>
        <Text wrap="truncate-end">
          <Text color={tint}>{tier}</Text>
          <Text dimColor>
            {' '}
            {look.tierModel[tier] ?? ''}
            {pl.after.length ? ` · ${look.s.after} ${pl.after.join(', ')}` : ''}
          </Text>
        </Text>
      </Box>
    </Box>
  )
}

export function terminalPane(ui: Ui, p: PaneProps): JSX.Element {
  const { Box, Text } = ui
  const { look } = p
  const s = look.s
  const isEmpty = p.running.length + p.finished.length + p.planned.length === 0

  const header = (
    <Box flexDirection="column">
      {p.title !== '' && <Text bold>{p.title}</Text>}
      <Box flexDirection="row" gap={1}>
        {tile(ui, 'cost', s.cost ?? 'Cost', `≈${look.fmtCost(p.totals.cost)}`)}
        {tile(ui, 'tokens', s.tokens ?? 'Tokens', look.fmtTokens(p.totals.tokens))}
        {tile(ui, 'time', s.time ?? 'Time', look.fmtTime(p.totals.time))}
      </Box>
      {p.toggleCompact}
    </Box>
  )

  if (p.isCompact) {
    return (
      <Box flexDirection="column">
        {header}
        <Text wrap="truncate-end">
          {[...p.running, ...p.finished].map(a => (
            <Text key={a.id} color={look.colorOf(look.tierOf(a.type))}>
              {(STATUS[a.status] ?? STATUS.running!).glyph}{' '}
            </Text>
          ))}
          {p.planned.map(pl => (
            <Text key={`plan-${pl.n}`} dimColor>
              ◷{' '}
            </Text>
          ))}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {header}
      <Box flexDirection="column" marginTop={1}>
        {isEmpty && <Text dimColor>{s.empty}</Text>}
        {p.running.length > 0 && <Text dimColor>{s.running} · {p.running.length}</Text>}
        {p.running.map(a => agentCard(ui, p, a))}
        {p.finished.length > 0 && p.toggleDone}
        {!p.isDoneCollapsed && p.finished.map(a => agentCard(ui, p, a))}
        {p.planned.length > 0 && <Text dimColor>{s.planned} · {p.planned.length}</Text>}
        {p.planned.map(pl => plannedCard(ui, p, pl))}
      </Box>
    </Box>
  )
}
