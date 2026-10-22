/** The last row: error summary on the left, key hints on the right. Hints thin out on narrow screens. */
import { Box, Text } from 'ink';
import type { DevError } from '../types.ts';
import { useTone } from './theme.ts';
import { chipEnd, ErrorSummary, planSummary } from './ErrorTray.tsx';
import type { HitRegion } from './hogPlan.ts';
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

export function footerHints(mode: Mode, activity: Activity, columns: number, view: View = 'deck', hogs = 0, hogsHidden = false, typeHint = false, errors = 0): Hint[] {
  if (view === 'hogs') {
    const hints: Hint[] = [{ key: '↑↓', word: 'row' }, { key: 's', word: 'stop' }, { key: 'r', word: 'restart' }];
    if (columns >= 90) hints.push({ key: 'S', word: 'orphans' });
    if (columns >= 100) hints.push({ key: 'A', word: 'idle' });
    hints.push({ key: 'esc', word: 'close' });
    return hints;
  }
  if (view === 'scripts') return [{ key: '↑↓', word: 'pick' }, { key: 'enter', word: 'run' }, { key: 'esc', word: 'close' }];
  if (view === 'palette') {
    const hints: Hint[] = [{ key: '↑↓', word: 'row' }, { key: '←→', word: 'swatch' }, { key: '#', word: 'hex' }, { key: 'enter', word: 'save' }];
    if (columns >= 90) hints.push({ key: 'r', word: 'brand' });
    hints.push({ key: 'esc', word: 'close' });
    return hints;
  }
  const hints: Hint[] = [{ key: 'v', word: mode === 'plain' ? 'detail' : 'plain' }];
  if (mode === 'verbose' && columns >= 90 && view === 'deck' && activity === 'feed') hints.push({ key: 'c', word: 'calls' }, { key: 't', word: 'timeline' });
  hints.push({ key: 'l', word: activityHint(activity), active: activity !== 'feed' }, { key: 'e', word: 'errors' });
  if (errors > 0 && columns >= 100 && view === 'deck') hints.push({ key: 'Y', word: 'copy all' });
  if (view === 'error') hints.push({ key: '↑↓', word: 'scroll' }, { key: 'y', word: 'copy' });
  if (view === 'deck' && activity === 'logs') hints.push({ key: 'y', word: 'copy' });
  if (hogs > 0 && columns >= 100 && view === 'deck') {
    if (columns >= 120 && !hogsHidden) hints.push({ key: 'm', word: 'hogs' });
    hints.push({ key: 'M', word: hogsHidden ? 'show hogs' : 'hide hogs', active: hogsHidden });
  }
  if (typeHint && view === 'deck') hints.push({ key: 'i', word: 'type' });
  if (columns >= 100 && view === 'deck') hints.push({ key: ':', word: 'run' });
  hints.push({ key: 'h', word: 'help' });
  if (columns >= 120) hints.push({ key: 'C', word: 'palette' }, { key: 'b', word: 'back' }, { key: 'esc', word: 'close' });
  hints.push({ key: 'q', word: 'quit' });
  // The Copy all chip says the same thing; the hint gives way when both do not fit.
  const y = hints.findIndex((h) => h.key === 'Y');
  if (y >= 0 && summaryWidth(columns, hints) < chipEnd(errors)) hints.splice(y, 1);
  return hints;
}

/** Cells the error summary gets at the left; a click there opens the newest error. */
export function summaryWidth(columns: number, hints: readonly Hint[]): number {
  const hintWidth = hints.reduce((sum, h) => sum + h.key.length + 1 + h.word.length + 2, 0);
  return Math.max(10, columns - hintWidth - 2);
}

/** The footer's clickable cells on screen row `y`: the Copy all chip first, so it wins over the summary that opens the newest error. */
export function footerRegions(errors: readonly DevError[], width: number, y: number): HitRegion[] {
  if (errors.length === 0) return [];
  const { chip } = planSummary(errors, width);
  const out: HitRegion[] = chip ? [{ y, x0: chip.x0, x1: chip.x1, hit: { kind: 'copyAll' } }] : [];
  out.push({ y, x0: 0, x1: width, hit: { kind: 'error' } });
  return out;
}

export function Footer({ errors, columns, mode, activity, view, hogs = 0, hogsHidden = false, inputHints, typeHint = false }: FooterProps) {
  const tone = useTone();
  const hints = inputHints ?? footerHints(mode, activity, columns, view, hogs, hogsHidden, typeHint, errors.length);
  const left = summaryWidth(columns, hints);
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
