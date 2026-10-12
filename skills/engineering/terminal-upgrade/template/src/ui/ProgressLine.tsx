/**
 * One row over the log while a command shows how far along it is: a capsule bar and the
 * percent when the output gave a number, the stage it is on, how long it has run and the
 * memory it holds now.
 */
import { Text } from 'ink';
import type { ServiceState } from '../types.ts';
import { capsule, capsuleBar } from './glyphs.ts';
import { cellWidth, formatMb, formatSpan, truncateEnd } from './format.ts';
import { useTone } from './theme.ts';

/** The bar's inner width at `columns`. */
export const progressBarWidth = (columns: number): number => Math.max(6, Math.min(24, Math.floor(columns / 6)));

export function ProgressLine({ service, columns, now }: { service: ServiceState; columns: number; now: number }) {
  const tone = useTone();
  const progress = service.progress;
  if (!progress) return null;
  const inner = progressBarWidth(columns);
  const percent = progress.fraction !== undefined ? Math.round(progress.fraction * 100) : undefined;
  const { filled, empty } = capsuleBar(percent ?? 0, inner);
  const right = [service.startedAt ? formatSpan(now - service.startedAt) : '', service.memMb > 0 ? formatMb(service.memMb) : ''].filter(Boolean).join('  ');
  const head = percent !== undefined ? `${capsule.left}${filled}${empty}${capsule.right} ${String(percent).padStart(3)}%  ` : '';
  const room = columns - 2 - cellWidth(head) - (right ? cellWidth(right) + 2 : 0);
  const label = room > 3 ? truncateEnd(progress.label, room) : '';
  const gap = Math.max(1, columns - 2 - cellWidth(head) - cellWidth(label) - cellWidth(right));
  return (
    <Text wrap="truncate">
      {' '}
      {percent !== undefined ? (
        <>
          <Text color={tone.line}>{capsule.left}</Text>
          <Text color={tone.accent}>{filled}</Text>
          <Text color={tone.line}>{empty}</Text>
          <Text color={tone.line}>{capsule.right}</Text>
          <Text color={tone.text} bold>{` ${String(percent).padStart(3)}%  `}</Text>
        </>
      ) : null}
      <Text color={tone.activity}>{label}</Text>
      <Text>{' '.repeat(gap)}</Text>
      <Text color={tone.muted}>{right}</Text>
    </Text>
  );
}
