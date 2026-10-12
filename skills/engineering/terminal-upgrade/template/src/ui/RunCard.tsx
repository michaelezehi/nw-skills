/**
 * A run deck's one command, as a labelled card: how far along it is, the step it is on,
 * then a thin rule and the facts in a row, STARTED, ELAPSED (or EXIT), MEMORY, PEAK and
 * CPU, each pair split by a bar. Two rows inside fold progress and step onto one line
 * and drop the rule. It takes the place of the service card, whose memory bar compares
 * a lone command with itself, and of the progress row over the log.
 */
import { Text } from 'ink';
import type { DeckMeta, ServiceState } from '../types.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { useTone, type Tone } from './theme.ts';
import { capsule, capsuleBar } from './glyphs.ts';
import { cellWidth, formatClock, formatMb, padEnd, truncateEnd } from './format.ts';
import { glyph, statusLook } from './sprites.ts';
import { useSecond } from './useFrame.ts';

/** A run deck: `devdeck run` named a mode, and there is one command on it. */
export function isRunDeck(meta: Pick<DeckMeta, 'mode'>, apps: readonly ServiceState[]): boolean {
  return meta.mode !== undefined && apps.length === 1;
}

/** The run card takes a strip of cards at least two rows inside; pills keep the old look. */
export function showsRunCard(meta: Pick<DeckMeta, 'mode'>, apps: readonly ServiceState[], strip: { cardWidth: number; services: number; grid?: unknown }): boolean {
  return isRunDeck(meta, apps) && strip.cardWidth > 0 && !strip.grid && strip.services >= 4;
}

/** 1m 13s, 40s, 2h 05m: elapsed time that moves each second. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

interface State {
  glyph: string;
  word: string;
  color: string;
}

function runState(service: ServiceState, frame: number, spinning: boolean, tone: Tone): State {
  if (service.prompt) return { glyph: '⚑', word: 'needs you', color: tone.accent };
  if (service.pid !== undefined) {
    const look = statusLook(service.status === 'starting' ? 'compiling' : service.status, frame, spinning, tone);
    return { glyph: look.glyph, word: 'running', color: tone.activity };
  }
  if (service.exitCode === 0) return { glyph: '✓', word: 'done', color: tone.accent };
  if (service.status === 'stopped' && service.exitCode === undefined) return { glyph: glyph.sleep, word: 'stopped', color: tone.muted };
  return { glyph: glyph.crack, word: `failed · exit ${service.exitCode ?? '?'}`, color: tone.error };
}

interface Fact {
  label: string;
  value: string;
  color: string;
}

const LABEL = 10;
const SEP = '   │   ';

/** The facts that fit `inner`, dropped from the end. */
export function fitFacts<T extends { label: string; value: string }>(facts: readonly T[], inner: number): T[] {
  const widthOf = (list: readonly T[]) => list.reduce((sum, f) => sum + cellWidth(f.label) + 2 + cellWidth(f.value), 0) + cellWidth(SEP) * Math.max(0, list.length - 1);
  let shown = [...facts];
  while (shown.length > 1 && widthOf(shown) > inner) shown = shown.slice(0, -1);
  return shown;
}

export interface RunCardProps {
  service: ServiceState;
  width: number;
  rows: number;
  frame: number;
  spinning: boolean;
}

export function RunCard({ service, width, rows, frame, spinning }: RunCardProps) {
  const tone = useTone();
  useSecond();
  const now = Date.now();
  const inner = panelInner(width);
  const state = runState(service, frame, spinning, tone);
  const finished = service.pid === undefined;
  const progress = service.progress;
  const percent = progress?.fraction !== undefined ? Math.round(progress.fraction * 100) : finished && service.exitCode === 0 ? 100 : undefined;
  const step = progress?.label ?? (finished ? '' : 'waiting for a step count in the output');
  const roomy = rows - 2 >= 4;

  const barInner = Math.max(6, Math.min(40, Math.floor((inner - LABEL) / 3)));
  const bar = capsuleBar(percent ?? 0, barInner);
  const peak = service.memHistory.reduce((max, mb) => Math.max(max, mb), service.memMb);
  const facts: Fact[] = [
    ...(service.startedAt ? [{ label: 'STARTED', value: formatClock(service.startedAt), color: tone.text }] : []),
    finished
      ? { label: 'EXIT', value: String(service.exitCode ?? '?'), color: service.exitCode === 0 ? tone.text : tone.error }
      : { label: 'ELAPSED', value: service.startedAt ? formatElapsed(now - service.startedAt) : '…', color: tone.text },
    { label: 'MEMORY', value: service.memMb > 0 ? formatMb(service.memMb) : '…', color: tone.text },
    ...(peak > service.memMb ? [{ label: 'PEAK', value: formatMb(peak), color: tone.muted }] : []),
    { label: 'CPU', value: `${Math.round(service.cpu)}%`, color: tone.text },
  ];
  const shown = fitFacts(facts, inner);

  const label = (text: string) => <Text color={tone.muted}>{padEnd(text, LABEL)}</Text>;
  const barRow = (
    <>
      <Text color={tone.line}>{capsule.left}</Text>
      <Text color={finished && service.exitCode !== 0 ? tone.error : tone.accent}>{bar.filled}</Text>
      <Text color={tone.line}>{bar.empty}</Text>
      <Text color={tone.line}>{capsule.right}</Text>
      <Text color={tone.text} bold>{percent !== undefined ? ` ${String(percent).padStart(3)}%` : '    –'}</Text>
    </>
  );
  const barWidth = barInner + 2 + 5;
  const stepRoom = roomy ? inner - LABEL : inner - LABEL - barWidth - 3;
  const stepText = step && stepRoom > 3 ? truncateEnd(step, stepRoom) : '';
  const factsRow = (
    <Row>
      {shown.map((f, i) => (
        <Text key={f.label}>
          {i > 0 ? <Text color={tone.line}>{SEP}</Text> : null}
          <Text color={tone.muted}>{f.label}  </Text>
          <Text color={f.color} bold={f.label === 'ELAPSED'}>
            {f.value}
          </Text>
        </Text>
      ))}
    </Row>
  );

  return (
    <Panel title={service.label.toUpperCase()} right={`${state.glyph} ${state.word}`} rightColor={state.color} width={width} rows={rows} titleColor={tone.accent}>
      {roomy ? (
        <>
          <Row>
            {label('PROGRESS')}
            {barRow}
          </Row>
          <Row>
            {label('STEP')}
            <Text color={progress ? tone.activity : tone.muted}>{stepText}</Text>
          </Row>
          <Row color={tone.line}>{'┈'.repeat(inner)}</Row>
          {factsRow}
        </>
      ) : (
        <>
          <Row>
            {label('PROGRESS')}
            {barRow}
            {stepText ? <Text color={progress ? tone.activity : tone.muted}>{`   ${stepText}`}</Text> : null}
          </Row>
          {factsRow}
        </>
      )}
    </Panel>
  );
}
