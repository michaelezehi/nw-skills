/** The script palette: a filter line, then the repo's scripts with their command lines. */
import { Text } from 'ink';
import type { ScriptEntry } from '../types.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { cellWidth, truncateEnd } from './format.ts';
import { useTone } from './theme.ts';

export interface ScriptListProps {
  entries: readonly ScriptEntry[];
  query: string;
  /** Index into `entries` of the highlighted script. */
  index: number;
  width: number;
  rows: number;
}

export function ScriptList({ entries, query, index, width, rows }: ScriptListProps) {
  const tone = useTone();
  const inner = panelInner(width);
  // Rules and the filter line take three rows; the list scrolls to keep the pick in view.
  const room = Math.max(0, rows - 3);
  const start = Math.max(0, Math.min(index - room + 1, entries.length - room));
  const shown = entries.slice(start, start + room);
  const nameWidth = Math.min(24, Math.max(4, ...entries.map((e) => cellWidth(e.name)))) + 2;
  return (
    <Panel title="RUN A SCRIPT" right={`${entries.length} ${entries.length === 1 ? 'script' : 'scripts'}`} width={width} rows={rows} focused>
      <Row>
        <Text color={tone.accent}>› {query}▌</Text>
        {query ? null : <Text color={tone.muted}> type to filter</Text>}
      </Row>
      {shown.length === 0 ? (
        <Row color={tone.muted}>no script matches</Row>
      ) : (
        shown.map((entry, i) => {
          const selected = start + i === index;
          const name = truncateEnd(entry.name, nameWidth - 2);
          return (
            <Row key={entry.name}>
              <Text color={selected ? tone.accent : tone.text} bold={selected}>
                {selected ? '❯ ' : '  '}
                {name.padEnd(nameWidth)}
              </Text>
              <Text color={tone.muted}>{truncateEnd(entry.command, Math.max(1, inner - nameWidth - 2))}</Text>
            </Row>
          );
        })
      )}
    </Panel>
  );
}
