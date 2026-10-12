/**
 * The memory hogs at the bottom of the deck. With rows to spare it is a card like the
 * service cards: the title and total set into the top rule, one row per hog with its
 * scope colour, an orphan badge, a memory bar scaled to the largest hog, a hint for
 * what to do, and Stop, Restart and Clear cache buttons. Without the rows it is one strip line.
 * Geometry comes from hogPlan.ts, which the mouse hit test reads too.
 */
import { memo } from 'react';
import { Box, Text } from 'ink';
import type { Hog, HogScope } from '../types.ts';
import { box, capsule, capsuleBar } from './glyphs.ts';
import { labelOn, useTone, type Tone } from './theme.ts';
import { cellWidth, formatMb, padEnd, padStart } from './format.ts';
import {
  BAR_W,
  CLEAR_LABEL,
  ORPHAN_BADGE,
  RESTART_LABEL,
  STRIP_KEY,
  STRIP_LEAD,
  STRIP_SEP,
  STRIP_WORD,
  formatAge,
  formatCpu,
  planHogStrip,
  type HogPanelPlan,
  type HogRowPlan,
} from './hogPlan.ts';

/** One colour per scope: the run in the accent, platform in the activity colour, system in a third hue. */
export function scopeColor(tone: Tone, scope: HogScope): string {
  if (scope === 'run') return tone.accent;
  if (scope === 'platform') return tone.activity;
  return tone.hues?.[1] ?? tone.text;
}

export interface HogPanelProps {
  plan: HogPanelPlan;
  width: number;
  rows: number;
  focused: boolean;
  selectedPid?: number;
}

export const HogPanel = memo(function HogPanel({ plan, width, rows, focused, selectedPid }: HogPanelProps) {
  const tone = useTone();
  if (rows < 1) return null;
  const maxMemMb = plan.rows.reduce((max, r) => Math.max(max, r.hog.memMb), 0);
  const [label, ...rest] = plan.rule.title.split(' · ');
  const armedOrphans = plan.rule.right.endsWith('? ]');
  return (
    <Box flexDirection="column" width={width} height={rows} overflow="hidden">
      <Text wrap="truncate">
        <Text color={tone.line}>{box.tl} </Text>
        <Text color={focused ? tone.accent : tone.activity} bold>
          {label}
        </Text>
        {rest.length > 0 ? <Text color={armedOrphans ? tone.error : tone.muted}>{` · ${rest.join(' · ')}`}</Text> : null}
        <Text color={tone.line}> {box.h.repeat(plan.rule.fill)}</Text>
        {plan.rule.right ? (
          <>
            <Text color={tone.line}> </Text>
            {armedOrphans ? (
              <Text backgroundColor={tone.error} color={labelOn(tone.error)} bold>
                {plan.rule.right}
              </Text>
            ) : (
              <Text color={tone.error} bold>
                {plan.rule.right}
              </Text>
            )}
            <Text color={tone.line}> </Text>
          </>
        ) : null}
        <Text color={tone.line}>{box.tr}</Text>
      </Text>
      {rows > 1 ? (
        <Box flexDirection="column" width={width} height={rows - 1} borderStyle="round" borderTop={false} borderColor={tone.line} paddingX={1} overflow="hidden">
          {plan.rows.map((row, i) => (
            <Box key={row.hog.pid} flexDirection="column">
              {plan.ruled && i > 0 ? (
                <Text wrap="truncate" color={tone.line}>
                  {'┈'.repeat(Math.max(0, width - 4))}
                </Text>
              ) : null}
              <HogLine row={row} plan={plan} maxMemMb={maxMemMb} selected={focused && row.hog.pid === selectedPid} />
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
});

function HogLine({ row, plan, maxMemMb, selected }: { row: HogRowPlan; plan: HogPanelPlan; maxMemMb: number; selected: boolean }) {
  const tone = useTone();
  const { hog, label } = row;
  const { cols } = plan;
  const hue = scopeColor(tone, hog.scope);
  const bar = capsuleBar(maxMemMb > 0 ? (hog.memMb / maxMemMb) * 100 : 0, BAR_W);
  return (
    <Text wrap="truncate">
      <Text color={hue}>{selected ? '› ' : '● '}</Text>
      <Text color={hue} bold={selected}>
        {padEnd(label, cols.nameW)}
      </Text>
      <Text> </Text>
      {cols.badge ? (
        <>
          {hog.orphan ? (
            <Text backgroundColor={tone.error} color={labelOn(tone.error)} bold>
              {ORPHAN_BADGE}
            </Text>
          ) : (
            <Text>{' '.repeat(cellWidth(ORPHAN_BADGE))}</Text>
          )}
          <Text> </Text>
        </>
      ) : null}
      {cols.bar ? (
        <>
          <Text color={tone.line}>{capsule.left}</Text>
          <Text color={hue}>{bar.filled}</Text>
          <Text color={tone.line}>
            {bar.empty}
            {capsule.right}{' '}
          </Text>
        </>
      ) : null}
      <Text color={tone.text} bold>
        {padStart(formatMb(hog.memMb), 7)}
      </Text>
      {cols.cpu ? <Text color={hog.cpu >= 80 ? tone.activity : tone.muted}>{padStart(formatCpu(hog.cpu), 6)}</Text> : null}
      {cols.age ? <Text color={tone.muted}>{padStart(formatAge(hog.ageSec), 8)}</Text> : null}
      <Text>{'  '}</Text>
      <Text color={row.confirming ? tone.error : tone.muted}>{padEnd(row.hint, cols.hintW)}</Text>
      <Text> </Text>
      {cols.clear ? (
        <>
          {row.clearX !== undefined ? <Text color={tone.accent}>{CLEAR_LABEL}</Text> : <Text>{' '.repeat(cellWidth(CLEAR_LABEL))}</Text>}
          <Text> </Text>
        </>
      ) : null}
      {cols.restart ? (
        <>
          {row.restartX !== undefined ? <Text color={tone.accent}>{RESTART_LABEL}</Text> : <Text>{' '.repeat(cellWidth(RESTART_LABEL))}</Text>}
          <Text> </Text>
        </>
      ) : null}
      {row.stopX === undefined ? null : row.confirming ? (
        <Text backgroundColor={tone.error} color={labelOn(tone.error)} bold>
          {row.stopLabel}
        </Text>
      ) : (
        <Text color={tone.error}>{row.stopLabel}</Text>
      )}
    </Text>
  );
}

/** `hogs  Brave Browser 3.4 GB · vitest orphan 1.7 GB          m list`, exactly one row. */
export const HogStrip = memo(function HogStrip({ hogs, width }: { hogs: readonly Hog[]; width: number }) {
  const tone = useTone();
  const plan = planHogStrip(hogs, width);
  const used =
    (plan.lead ? cellWidth(STRIP_LEAD) : 0) +
    plan.items.reduce((sum, item, i) => sum + (i > 0 ? STRIP_SEP.length : 0) + cellWidth(item.name) + (item.hog.orphan ? 7 : 0) + 1 + cellWidth(item.mem), 0);
  const tail = cellWidth(STRIP_KEY + STRIP_WORD);
  const gap = plan.key ? Math.max(0, width - used - tail) : 0;
  return (
    <Box width={width} height={1} overflow="hidden">
      <Text wrap="truncate">
        {plan.lead ? <Text color={tone.activity} bold>{STRIP_LEAD}</Text> : null}
        {plan.items.map((item, i) => (
          <Text key={item.hog.pid}>
            {i > 0 ? <Text color={tone.line}>{STRIP_SEP}</Text> : null}
            <Text color={scopeColor(tone, item.hog.scope)}>{item.name}</Text>
            {item.hog.orphan ? <Text color={tone.error} bold>{' orphan'}</Text> : null}
            <Text color={tone.text}> {item.mem}</Text>
          </Text>
        ))}
        {plan.key ? (
          <>
            <Text>{' '.repeat(gap)}</Text>
            <Text color={tone.text}>{STRIP_KEY}</Text>
            <Text color={tone.muted}>{STRIP_WORD}</Text>
          </>
        ) : null}
      </Text>
    </Box>
  );
});
