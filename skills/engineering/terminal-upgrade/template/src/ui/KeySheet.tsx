/** The `?` sheet. Keys in text, what they do in muted, two columns when there is room. */
import { Box, Text } from 'ink';
import { Panel, Row, panelInner } from './Panel.tsx';
import { useTone } from './theme.ts';
import { padEnd } from './format.ts';

export const KEYS: Array<[string, string]> = [
  ['v or /', 'detail or plain view'],
  ['l', 'show or hide the logs'],
  ['c', 'fold or open Convex calls'],
  ['t', 'fold or open the timeline'],
  ['← →', 'select a service, or the logged one'],
  ['↑ ↓', 'select a row, or scroll the logs'],
  ['tab / shift-tab', 'move focus between panels'],
  ['enter', 'open the error, the logs, or fold a panel'],
  ['e', 'jump to the errors'],
  ['y', 'copy error or logs'],
  ['Y', 'copy every error'],
  ['r', 'restart the focused service'],
  ['o', 'open its URL in the browser'],
  ['f', 'filter calls: all, Q, M, A, errors'],
  ['p', 'pause the feed'],
  ['C', 'palette'],
  ['pgup / pgdn', 'scroll the logs or an error'],
  ['esc / x', 'close the view, or hide the logs'],
  ['backspace / b', 'back to the previous view'],
  ['?', 'this sheet'],
  ['q / ctrl-c', 'quit and stop every service'],
];

export function KeySheet({ width, rows }: { width: number; rows: number }) {
  const tone = useTone();
  const inner = panelInner(width);
  const twoColumns = inner >= 100;
  const keyWidth = 20;
  const colWidth = twoColumns ? Math.floor(inner / 2) : inner;
  const perColumn = twoColumns ? Math.ceil(KEYS.length / 2) : KEYS.length;
  const columns = twoColumns ? [KEYS.slice(0, perColumn), KEYS.slice(perColumn)] : [KEYS];
  return (
    <Panel title="KEYS" right="esc close" width={width} rows={rows} focused>
      <Text> </Text>
      <Box flexDirection="row">
        {columns.map((column, c) => (
          <Box key={c} flexDirection="column" width={colWidth} overflow="hidden">
            {column.map(([key, what]) => (
              <Row key={key}>
                <Text color={tone.text} bold>
                  {padEnd(key, keyWidth)}
                </Text>
                <Text color={tone.muted}>{what}</Text>
              </Row>
            ))}
          </Box>
        ))}
      </Box>
    </Panel>
  );
}
