/**
 * The `C` view: presets to pick from, then the six tokens to override. Every row draws in
 * the colours it names, and the deck around the panel already wears the preview.
 */
import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { PRESETS, TOKENS, type Colors } from '../themeFile.ts';
import { Panel, Row, panelInner } from './Panel.tsx';
import { useTone, spaced } from './theme.ts';
import { padEnd } from './format.ts';
import { presetAt, tokenAt, type PaletteState } from './paletteState.ts';

export interface PaletteProps {
  state: PaletteState;
  width: number;
  rows: number;
}

const NAME_W = 10;
/** Below this many columns the preset rows drop their sample text. */
const SAMPLE_MIN_COLS = 80;

function Swatches({ colors, gap = ' ' }: { colors: Colors; gap?: string }) {
  return (
    <>
      {TOKENS.map((token, i) => (
        <Text key={token} color={colors[token]}>
          {i > 0 ? gap : ''}██
        </Text>
      ))}
    </>
  );
}

/** `● ready  ◐ compiling  ↯ 182ms  ◆ error`, each word in the role it names. */
function Sample({ colors }: { colors: Colors }) {
  return (
    <>
      <Text color={colors.accent}>● ready</Text>
      <Text color={colors.activity}>  ◐ compiling</Text>
      <Text color={colors.text}>  ↯ 182ms</Text>
      <Text color={colors.muted}> · 2:43</Text>
      <Text color={colors.error}>  ◆ error</Text>
    </>
  );
}

export function Palette({ state, width, rows }: PaletteProps) {
  const tone = useTone();
  const inner = panelInner(width);
  const sample = inner >= SAMPLE_MIN_COLS;
  const lines: ReactNode[] = [];
  let selectedLine = 0;

  lines.push(
    <Row key="h1" color={tone.muted}>
      {`  ${spaced('presets')}`}
    </Row>,
  );
  PRESETS.forEach((preset, i) => {
    const selected = state.row === i;
    if (selected) selectedLine = lines.length;
    lines.push(
      <Row key={preset.name}>
        <Text color={tone.accent}>{selected ? '  › ' : '    '}</Text>
        <Text color={selected ? tone.accent : tone.text} bold={selected}>
          {padEnd(preset.label, NAME_W)}
        </Text>
        <Swatches colors={preset.colors} />
        {sample ? (
          <>
            <Text>{'   '}</Text>
            <Sample colors={preset.colors} />
          </>
        ) : null}
      </Row>,
    );
  });
  lines.push(<Text key="gap"> </Text>);
  lines.push(
    <Row key="h2" color={tone.muted}>
      {`  ${spaced('customise')}`}
      <Text color={tone.muted}>{state.preview.preset === 'custom' ? '   custom' : `   ${presetAt(PRESETS.findIndex((p) => p.name === state.preview.preset))?.label ?? ''}`}</Text>
    </Row>,
  );
  TOKENS.forEach((token, i) => {
    const row = PRESETS.length + i;
    const selected = state.row === row;
    if (selected) selectedLine = lines.length;
    const value = state.preview.colors[token];
    const edit = selected ? state.edit : undefined;
    lines.push(
      <Row key={token}>
        <Text color={tone.accent}>{selected ? '  › ' : '    '}</Text>
        <Text color={selected ? tone.accent : tone.text} bold={selected}>
          {padEnd(token, NAME_W)}
        </Text>
        <Text color={value}>██</Text>
        {edit ? (
          <Text color={edit.invalid ? tone.error : tone.text}>
            {'  #'}
            {edit.digits}
            {edit.digits.length < 6 ? '_' : ''}
            {edit.invalid ? '  not a hex colour, six digits' : '  enter to set, esc to cancel'}
          </Text>
        ) : (
          <Text color={tone.muted}>{`  ${value}`}</Text>
        )}
      </Row>,
    );
  });

  const visible = Math.max(0, rows - 2);
  const start = Math.max(0, Math.min(selectedLine - visible + 1, lines.length - visible));
  const shown = lines.slice(start, start + visible);
  const currentPreset = PRESETS.find((p) => p.name === state.preview.preset);
  const right = `${currentPreset ? currentPreset.label : 'custom'} · enter save · esc close`;
  const editing = Boolean(tokenAt(state.row) && state.edit);
  return (
    <Panel title="PALETTE" right={editing ? 'typing a hex value' : right} rightColor={editing ? tone.activity : tone.muted} width={width} rows={rows} focused>
      <Box flexDirection="column" height={visible} overflow="hidden">
        {shown}
      </Box>
    </Panel>
  );
}
