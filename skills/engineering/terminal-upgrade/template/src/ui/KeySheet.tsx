/** The `h` help sheet. Keys in text, what they do in muted, two columns when there is room, then the mouse and the terminal's own gestures. */
import { Box, Text } from 'ink';
import { Panel, Row, panelInner } from './Panel.tsx';
import { useTone } from './theme.ts';
import { padEnd } from './format.ts';

export const KEYS: Array<[string, string]> = [
  ['v or /', 'detail or plain view'],
  ['l', 'the logs, then neither, then the feed'],
  ['c', 'fold or open Convex calls'],
  ['t', 'fold or open the timeline'],
  ['← →', 'select a service, or the logged one'],
  ['↑ ↓', 'select a row, or scroll the logs'],
  ['tab / shift-tab', 'move focus between panels'],
  ['enter', 'open the error, the logs, or fold a panel'],
  ['e', 'jump to the errors'],
  ['y', 'copy error or logs'],
  ['Y', 'copy every error'],
  ['r', 'restart the focused service or hog'],
  ['m', 'memory hogs, the full list'],
  ['s twice / S twice', 'stop the hog / every orphan'],
  ['o', 'open its URL in the browser'],
  ['f', 'filter calls: all, Q, M, A, errors'],
  ['p', 'pause the feed'],
  ['C', 'palette'],
  ['pgup / pgdn', 'scroll the logs or an error'],
  ['esc / x', 'close the view, or back to the feed'],
  ['backspace / b', 'back to the previous view'],
  ['h or ?', 'this help'],
  ['q / ctrl-c', 'quit and stop every service'],
];

/** What the Mac terminal itself does over the deck. The deck takes clicks, so selecting text needs option. */
export const TERMINAL_KEYS: Array<[string, string]> = [
  ['option-drag', 'select text, then cmd-c copies it'],
  ['click', 'Stop, Restart and Stop all orphans'],
  ['cmd-click :3000', 'open that server in the browser'],
  ['cmd-click a path', 'open the file in your editor'],
  ['cmd-+ / cmd--', 'bigger or smaller text; the deck refits'],
];

export function KeySheet({ width, rows }: { width: number; rows: number }) {
  const tone = useTone();
  const inner = panelInner(width);
  const twoColumns = inner >= 100;
  const keyWidth = 20;
  const colWidth = twoColumns ? Math.floor(inner / 2) : inner;
  const perColumn = twoColumns ? Math.ceil(KEYS.length / 2) : KEYS.length;
  const columns = twoColumns ? [KEYS.slice(0, perColumn), KEYS.slice(perColumn)] : [KEYS];
  // A short screen gives up the blank lines, then the terminal rows from the end, so
  // nothing is squeezed into the rows above it.
  const budget = Math.max(0, rows - 2);
  const termPerRow = twoColumns ? 2 : 1;
  let lead = 1;
  let gap = 1;
  const termRows = () => Math.max(0, budget - lead - perColumn - gap - 1);
  if (termRows() < Math.ceil(TERMINAL_KEYS.length / termPerRow)) lead = 0;
  if (termRows() < Math.ceil(TERMINAL_KEYS.length / termPerRow)) gap = 0;
  const terminal = TERMINAL_KEYS.slice(0, termRows() * termPerRow);
  return (
    <Panel title="HELP" right="esc close" width={width} rows={rows} focused>
      {lead ? <Text> </Text> : null}
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
      {gap ? <Text> </Text> : null}
      <Row>
        <Text color={tone.accent} bold>
          IN THE TERMINAL
        </Text>
      </Row>
      <Box flexDirection="row" flexWrap="wrap">
        {terminal.map(([key, what]) => (
          <Box key={key} width={colWidth} overflow="hidden">
            <Row>
              <Text color={tone.text} bold>
                {padEnd(key, keyWidth)}
              </Text>
              <Text color={tone.muted}>{what}</Text>
            </Row>
          </Box>
        ))}
      </Box>
    </Panel>
  );
}
