/**
 * The header's stats as a row of small outlined tiles beside the clock: the label sits
 * in each tile's rule, the value on its one line, a quieter note right aligned when it
 * fits. Tiles sit flush, outline to outline, the way the service cards below them do,
 * and share out the width so the row has no dead gap; one tile can be named to take
 * all the slack instead.
 */
import { Box, Text } from 'ink';
import { Panel } from './Panel.tsx';
import { useTone } from './theme.ts';
import { cellWidth, truncateStart } from './format.ts';
import { osc8 } from './links.ts';

export interface TileSegment {
  text: string;
  color: string;
  /** Wraps the text in a terminal link to this URL. */
  href?: string;
}

export interface TileSpec {
  label: string;
  left: TileSegment[];
  right?: TileSegment;
  /** Cut the right note from the start to fit, instead of dropping it. */
  shrinkRight?: boolean;
}

/** Rule, sides and one space of padding each side. */
const CHROME = 4;
const NOTE_GAP = 2;
/** Flush, like the cards: `╮╭` between tiles. */
export const TILE_GAP = 0;
/** One content row between the two rules. */
export const TILE_ROWS = 3;

const segWidth = (segments: TileSegment[]): number => segments.reduce((sum, s) => sum + cellWidth(s.text), 0);

function minWidth(spec: TileSpec): number {
  return Math.max(CHROME + segWidth(spec.left), cellWidth(spec.label) + 6);
}

function wantWidth(spec: TileSpec): number {
  return spec.right ? Math.max(minWidth(spec), CHROME + segWidth(spec.left) + NOTE_GAP + cellWidth(spec.right.text)) : minWidth(spec);
}

/**
 * Widths for the tiles that fit `room`, left to right, stopping at the first that does not.
 * Each tile gets its value, then its note, then the leftover goes to `grow` or is shared evenly.
 */
export function fitTiles(specs: TileSpec[], room: number, grow?: string): Array<{ spec: TileSpec; width: number }> {
  const shown: Array<{ spec: TileSpec; width: number }> = [];
  let used = 0;
  for (const spec of specs) {
    const need = (shown.length > 0 ? TILE_GAP : 0) + minWidth(spec);
    if (used + need > room) break;
    shown.push({ spec, width: minWidth(spec) });
    used += need;
  }
  let extra = room - used;
  for (const tile of shown) {
    if (tile.spec.label === grow) continue;
    const add = Math.min(extra, wantWidth(tile.spec) - tile.width);
    tile.width += add;
    extra -= add;
  }
  const grower = shown.find((t) => t.spec.label === grow);
  if (grower) {
    grower.width += extra;
  } else if (shown.length > 0) {
    const each = Math.floor(extra / shown.length);
    shown.forEach((t, i) => (t.width += each + (i < extra - each * shown.length ? 1 : 0)));
  }
  return shown;
}

export function StatTile({ spec, width }: { spec: TileSpec; width: number }) {
  const tone = useTone();
  const inner = width - CHROME;
  const leftWidth = segWidth(spec.left);
  const noteRoom = inner - leftWidth - NOTE_GAP;
  let note = spec.right?.text ?? '';
  if (note && cellWidth(note) > noteRoom) note = spec.shrinkRight && noteRoom >= 6 ? truncateStart(note, noteRoom) : '';
  return (
    <Panel title={spec.label} width={width} rows={TILE_ROWS} titleColor={tone.muted}>
      <Text wrap="truncate">
        {spec.left.map((s, i) => (
          <Text key={i} color={s.color}>
            {s.href ? osc8(s.href, s.text) : s.text}
          </Text>
        ))}
        {note ? (
          <>
            {' '.repeat(inner - leftWidth - cellWidth(note))}
            <Text color={spec.right!.color}>{note}</Text>
          </>
        ) : null}
      </Text>
    </Panel>
  );
}

export function TileRow({ specs, room, grow }: { specs: TileSpec[]; room: number; grow?: string }) {
  const tiles = fitTiles(specs, room, grow);
  return (
    <Box flexDirection="row" width={room} height={TILE_ROWS} overflow="hidden">
      {tiles.map(({ spec, width }, i) => (
        <Box key={spec.label} width={width} marginRight={i < tiles.length - 1 ? TILE_GAP : 0}>
          <StatTile spec={spec} width={width} />
        </Box>
      ))}
    </Box>
  );
}
