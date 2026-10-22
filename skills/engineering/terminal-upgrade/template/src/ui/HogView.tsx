/**
 * The `m` view: every hog in full. Each one gets its scope, name, pid, memory, cpu,
 * age and orphan flag on one line, the hint (or the stop confirmation) under it, then
 * its whole command, wrapped, never cut. The window scrolls to keep the selected hog
 * whole on screen.
 */
import { Box, Text } from 'ink';
import type { Hog } from '../types.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { labelOn, useTone } from './theme.ts';
import { cellWidth, formatAge, formatMb } from './format.ts';
import { confirmLines, hogHint, hogLabel, hogTotal } from './hogCopy.ts';
import { formatCpu, IDLE_BADGE, ORPHAN_BADGE } from './hogPlan.ts';
import { scopeColor } from './HogPanel.tsx';

const INDENT = '    ';
const SCOPES = ['run', 'platform', 'system', 'agent'] as const;
/** `● run   ● platform   ● system   `. */
const LEGEND_W = SCOPES.reduce((sum, s) => sum + 2 + s.length + 3, 0);

/** Split `text` into lines of at most `width` cells, at spaces where it can, mid-word only when a word is wider than a line. */
export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];
  const lines: string[] = [];
  let line = '';
  const push = () => {
    lines.push(line);
    line = '';
  };
  for (const word of text.split(' ')) {
    let rest = word;
    while (cellWidth(rest) > width) {
      if (line) push();
      let head = '';
      for (const ch of rest) {
        if (cellWidth(head + ch) > width) break;
        head += ch;
      }
      lines.push(head);
      rest = rest.slice(head.length);
    }
    const next = line ? `${line} ${rest}` : rest;
    if (cellWidth(next) <= width) line = next;
    else {
      push();
      line = rest;
    }
  }
  if (line || lines.length === 0) push();
  return lines;
}

interface Block {
  hog: Hog;
  head: string[];
  hint: string;
  command: string[];
}

/** The facts after the name, dropped from the end while the line is too wide. */
function headParts(hog: Hog, inner: number): string[] {
  const parts = [hog.scope, `pid ${hog.pid}`, formatMb(hog.memMb), formatCpu(hog.cpu), formatAge(hog.ageSec)];
  if (hog.idleSec !== undefined) parts.push(`idle ${formatAge(hog.idleSec)}`);
  const fixed = 2 + cellWidth(hogLabel(hog)) + (hog.orphan || hog.stale ? 2 + cellWidth(ORPHAN_BADGE) : 0);
  const width = (list: string[]) => fixed + list.reduce((sum, p) => sum + 2 + cellWidth(p), 0);
  while (parts.length > 0 && width(parts) > inner) parts.pop();
  return parts;
}

export function HogView({ hogs, width, rows, selectedPid, armedPid, armedOrphans = false, armedIdle = false }: { hogs: readonly Hog[]; width: number; rows: number; selectedPid?: number; armedPid?: number; armedOrphans?: boolean; armedIdle?: boolean }) {
  const tone = useTone();
  const inner = panelInner(width);
  const body = Math.max(0, rows - 2);
  const textWidth = Math.max(1, inner - INDENT.length);
  const blocks: Block[] = hogs.map((hog) => {
    // No Stop button here to click again, so the confirmation names only the key.
    const hint = armedPid === hog.pid ? (confirmLines(hog).slice(1).find((t) => cellWidth(t) <= textWidth) ?? '') : hogHint(hog);
    return { hog, head: headParts(hog, inner), hint, command: wrapText(hog.command, textWidth) };
  });
  const heightOf = (b: Block) => 1 + (b.hint ? 1 : 0) + b.command.length + 1;
  const selected = Math.max(0, hogs.findIndex((h) => h.pid === selectedPid));
  // Start at the top; move down only until the selected block fits whole under the legend.
  let start = 0;
  const fitsFrom = (from: number) => blocks.slice(from, selected + 1).reduce((sum, b) => sum + heightOf(b), 1) - 1 <= body;
  while (start < selected && !fitsFrom(start)) start += 1;

  const shown: Block[] = [];
  let used = 1;
  for (const block of blocks.slice(start)) {
    // The last block may leave out its blank spacer line.
    if (used + heightOf(block) - 1 > body && shown.length > 0) break;
    shown.push(block);
    used += heightOf(block);
  }
  const orphans = hogs.filter((h) => h.orphan).length;
  const idle = hogs.filter((h) => h.stale).length;
  const legend =
    armedOrphans && orphans > 0
      ? `press S again to stop ${orphans} ${orphans === 1 ? 'orphan' : 'orphans'}`
      : armedIdle && idle > 0
        ? `press A again to stop ${idle} idle ${idle === 1 ? 'session' : 'sessions'}`
        : hogTotal(hogs);
  const armedAll = (armedOrphans && orphans > 0) || (armedIdle && idle > 0);

  return (
    <Panel title="MEMORY HOGS" right="esc close" width={width} rows={rows} focused>
      <Row>
        {SCOPES.map((scope) => (
          <Text key={scope}>
            <Text color={scopeColor(tone, scope)}>● </Text>
            <Text color={tone.muted}>{scope}   </Text>
          </Text>
        ))}
        {hogs.length > 0 && LEGEND_W + cellWidth(legend) <= inner ? <Text color={armedAll ? tone.error : tone.text}>{legend}</Text> : null}
      </Row>
      {hogs.length === 0 ? (
        <Row color={tone.muted}>Nothing over 500 MB or 80% cpu right now.</Row>
      ) : (
        shown.map((block) => {
          const { hog } = block;
          const hue = scopeColor(tone, hog.scope);
          const chosen = hog.pid === selectedPid || (selectedPid === undefined && hog === hogs[0]);
          return (
            <Box key={hog.pid} flexDirection="column" flexShrink={0}>
              <Row>
                <Text color={hue}>{chosen ? '› ' : '● '}</Text>
                <Text color={hue} bold>
                  {hogLabel(hog)}
                </Text>
                {hog.orphan ? (
                  <>
                    <Text>{'  '}</Text>
                    <Text backgroundColor={tone.error} color={labelOn(tone.error)} bold>
                      {ORPHAN_BADGE}
                    </Text>
                  </>
                ) : hog.stale ? (
                  <>
                    <Text>{'  '}</Text>
                    <Text backgroundColor={tone.activity} color={labelOn(tone.activity)} bold>
                      {IDLE_BADGE}
                    </Text>
                  </>
                ) : null}
                {block.head.map((part, i) => (
                  <Text key={i} color={i === 2 ? tone.text : i === 0 ? hue : tone.muted}>{`  ${part}`}</Text>
                ))}
              </Row>
              {block.hint ? <Row color={armedPid === hog.pid ? tone.error : tone.text}>{`${INDENT}${block.hint}`}</Row> : null}
              {block.command.map((line, i) => (
                <Row key={i} color={tone.muted}>{`${INDENT}${line}`}</Row>
              ))}
              <Text> </Text>
            </Box>
          );
        })
      )}
    </Panel>
  );
}
