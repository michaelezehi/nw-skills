/** The last row: error summary on the left, key hints on the right. Hints thin out on narrow screens. */
import { Box, Text } from 'ink';
import type { DevError } from '../types.ts';
import { useTone } from './theme.ts';
import { ErrorSummary } from './ErrorTray.tsx';
import type { Mode } from './deckState.ts';
import type { View } from './layout.ts';

export interface FooterProps {
  errors: readonly DevError[];
  columns: number;
  mode: Mode;
  logs: boolean;
  view: View;
}

interface Hint {
  key: string;
  word: string;
  /** Drawn in the accent: the thing this key controls is on. */
  active?: boolean;
}

export function footerHints(mode: Mode, logs: boolean, columns: number, view: View = 'deck'): Hint[] {
  if (view === 'palette') {
    const hints: Hint[] = [{ key: '↑↓', word: 'row' }, { key: '←→', word: 'swatch' }, { key: '#', word: 'hex' }, { key: 'enter', word: 'save' }];
    if (columns >= 90) hints.push({ key: 'r', word: 'brand' });
    hints.push({ key: 'esc', word: 'close' });
    return hints;
  }
  const hints: Hint[] = [{ key: 'v', word: mode === 'plain' ? 'detail' : 'plain' }];
  if (mode === 'verbose' && columns >= 90 && view === 'deck') hints.push({ key: 'c', word: 'calls' }, { key: 't', word: 'timeline' });
  hints.push({ key: 'l', word: 'logs', active: logs }, { key: 'e', word: 'errors' });
  if (view === 'error' || logs) hints.push({ key: 'y', word: 'copy' });
  hints.push({ key: 'h', word: 'help' });
  if (columns >= 120) hints.push({ key: 'C', word: 'palette' }, { key: 'b', word: 'back' }, { key: 'esc', word: 'close' });
  hints.push({ key: 'q', word: 'quit' });
  return hints;
}

export function Footer({ errors, columns, mode, logs, view }: FooterProps) {
  const tone = useTone();
  const hints = footerHints(mode, logs, columns, view);
  const hintWidth = hints.reduce((sum, h) => sum + h.key.length + 1 + h.word.length + 2, 0);
  const left = Math.max(10, columns - hintWidth - 2);
  return (
    <Box flexDirection="row" width={columns} height={1} overflow="hidden">
      <Box width={left} overflow="hidden">
        <ErrorSummary errors={errors} width={left} />
      </Box>
      <Box width={2} />
      <Box flexGrow={1} justifyContent="flex-end" overflow="hidden">
        <Text wrap="truncate">
          {hints.map((h) => (
            <Text key={h.key}>
              <Text color={tone.text}>{h.key}</Text>
              <Text color={h.active ? tone.accent : tone.muted}> {h.word}  </Text>
            </Text>
          ))}
        </Text>
      </Box>
    </Box>
  );
}
