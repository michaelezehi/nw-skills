/**
 * An outlined panel with its title set into the top rule, the way the reference
 * cards carry their caps label. Width and height are exact: the top rule is drawn by
 * hand, the sides and bottom come from Ink, and the body clips anything that overflows.
 * A collapsed panel is the rule alone.
 */
import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { box } from './glyphs.ts';
import { useTone } from './theme.ts';
import { cellWidth, truncateEnd } from './format.ts';

export interface RuleProps {
  title: string;
  /** Secondary text set into the right end of the rule. */
  right?: string;
  rightColor?: string;
  width: number;
  focused?: boolean;
  /** Title colour when not focused. */
  titleColor?: string;
}

export interface PanelProps extends RuleProps {
  /** Total rows including both rules. */
  rows: number;
  children?: ReactNode;
}

/** Cells available to a row inside a panel of `width`. */
export function panelInner(width: number): number {
  return Math.max(0, width - 4);
}

/** `╭ TITLE ─────── right ╮`, exactly `width` cells. */
export function Rule({ title, right, rightColor, width, focused = false, titleColor }: RuleProps) {
  const tone = useTone();
  const titleTone = focused ? tone.accent : (titleColor ?? tone.text);
  const label = truncateEnd(title, Math.max(1, width - 6));
  let rightLabel = right ?? '';
  const fixed = 2 + cellWidth(label) + 1 + 1; // "╭ " + title + " " + "╮"
  const roomForRight = width - fixed - 2; // keep " right " padding
  if (rightLabel && cellWidth(rightLabel) > roomForRight) rightLabel = roomForRight > 2 ? truncateEnd(rightLabel, roomForRight) : '';
  const fillWidth = width - fixed - (rightLabel ? cellWidth(rightLabel) + 2 : 0);
  const fill = box.h.repeat(Math.max(0, fillWidth));
  return (
    <Text wrap="truncate">
      <Text color={tone.line}>{box.tl} </Text>
      <Text color={titleTone} bold={focused}>{label}</Text>
      <Text color={tone.line}> {fill}</Text>
      {rightLabel ? (
        <>
          <Text color={tone.line}> </Text>
          <Text color={rightColor ?? tone.muted}>{rightLabel}</Text>
          <Text color={tone.line}> </Text>
        </>
      ) : null}
      <Text color={tone.line}>{box.tr}</Text>
    </Text>
  );
}

export function Panel({ rows, children, ...rule }: PanelProps) {
  const tone = useTone();
  const { width } = rule;
  if (rows < 1 || width < 6) return null;
  if (rows === 1) return <Rule {...rule} />;

  return (
    <Box flexDirection="column" width={width} height={rows} overflow="hidden">
      <Rule {...rule} />
      <Box
        flexDirection="column"
        width={width}
        height={rows - 1}
        borderStyle="round"
        borderTop={false}
        borderColor={tone.line}
        paddingX={1}
        overflow="hidden"
      >
        {children}
      </Box>
    </Box>
  );
}

/** One truncated row of panel content. Keeps every line a single line. */
export function Row({ children, color }: { children?: ReactNode; color?: string }) {
  return (
    <Text wrap="truncate" color={color}>
      {children}
    </Text>
  );
}

/** A quiet, centred empty state: `◌ waiting for first call`. */
export function EmptyRow({ width, glyph, glyphColor, text }: { width: number; glyph: string; glyphColor: string; text: string }) {
  const tone = useTone();
  const total = cellWidth(glyph) + 1 + cellWidth(text);
  const pad = Math.max(0, Math.floor((width - total) / 2));
  return (
    <Text wrap="truncate">
      {' '.repeat(pad)}
      <Text color={glyphColor}>{glyph}</Text>
      <Text color={tone.muted}> {text}</Text>
    </Text>
  );
}

/** Fills `count` blank rows so a panel body keeps its height. */
export function Blank({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Text key={i}> </Text>
      ))}
    </>
  );
}
