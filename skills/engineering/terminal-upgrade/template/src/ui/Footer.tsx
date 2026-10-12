/** The last row: error summary on the left, key hints on the right. Hints thin out on narrow screens. */
import { Box, Text } from 'ink';
import type { DevError } from '../types.ts';
import { useTone } from './theme.ts';
import { ErrorSummary } from './ErrorTray.tsx';
import { nextActivity, type Activity, type Mode } from './deckState.ts';
import type { View } from './layout.ts';

export interface FooterProps {
  errors: readonly DevError[];
  columns: number;
  mode: Mode;
  activity: Activity;
  view: View;
  /** Hogs in the store; the `m` hint shows when there are any. */
  hogs?: number;
  /** The hogs block is hidden; the hint offers to show it. */
  hogsHidden?: boolean;
  /** A prompt card or an attached keyboard has the keys: its hints replace the deck's. */
  inputHints?: Hint[];
  /** A run deck: `i` types into the command. */
  typeHint?: boolean;
}

export interface Hint {
  key: string;
  word: string;
  /** Drawn in the accent: the thing this key controls is on. */
  active?: boolean;
}

/** What `l` does next: show the logs, hide them and the feed, or bring the feed back. */
export function activityHint(activity: Activity): string {
  const next = nextActivity(activity);
  return next === 'logs' ? 'logs' : next === 'quiet' ? 'hide' : 'feed';
}

export function footerHints(mode: Mode, activity: Activity, columns: number, view: View = 'deck', hogs = 0, hogsHidden = false, typeHint = false): Hint[] {
  if (view === 'hogs') {
    const hints: Hint[] = [{ key: '↑↓', word: 'row' }, { key: 's', word: 'stop' }, { key: 'r', word: 'restart' }];
    if (columns >= 90) hints.push({ key: 'S', word: 'orphans' });
    hints.push({ key: 'esc', word: 'close' });
    return hints;
  }
  if (view === 'palette') {
    const hints: Hint[] = [{ key: '↑↓', word: 'row' }, { key: '←→', word: 'swatch' }, { key: '#', word: 'hex' }, { key: 'enter', word: 'save' }];
    if (columns >= 90) hints.push({ key: 'r', word: 'brand' });
    hints.push({ key: 'esc', word: 'close' });
    return hints;
  }
  const hints: Hint[] = [{ key: 'v', word: mode === 'plain' ? 'detail' : 'plain' }];
  if (mode === 'verbose' && columns >= 90 && view === 'deck' && activity === 'feed') hints.push({ key: 'c', word: 'calls' }, { key: 't', word: 'timeline' });
  hints.push({ key: 'l', word: activityHint(activity), active: activity !== 'feed' }, { key: 'e', word: 'errors' });
  if (view === 'error' || (view === 'deck' && activity === 'logs')) hints.push({ key: 'y', word: 'copy' });
  if (hogs > 0 && columns >= 100 && view === 'deck') {
    if (columns >= 120 && !hogsHidden) hints.push({ key: 'm', word: 'hogs' });
    hints.push({ key: 'M', word: hogsHidden ? 'show hogs' : 'hide hogs', active: hogsHidden });
  }
  if (typeHint && view === 'deck') hints.push({ key: 'i', word: 'type' });
  hints.push({ key: 'h', word: 'help' });
  if (columns >= 120) hints.push({ key: 'C', word: 'palette' }, { key: 'b', word: 'back' }, { key: 'esc', word: 'close' });
  hints.push({ key: 'q', word: 'quit' });
  return hints;
}

export function Footer({ errors, columns, mode, activity, view, hogs = 0, hogsHidden = false, inputHints, typeHint = false }: FooterProps) {
  const tone = useTone();
  const hints = inputHints ?? footerHints(mode, activity, columns, view, hogs, hogsHidden, typeHint);
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
