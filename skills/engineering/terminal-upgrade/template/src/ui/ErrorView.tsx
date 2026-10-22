/**
 * The full-screen error, opened with `e`, enter on the tray, or a click on an error. The
 * headline reads whole in red, boxed buttons copy the block or every open error, and the
 * body below wraps every line to the width, scrolling with the arrows. Geometry lives in
 * errorView.ts.
 */
import { Box, Text } from 'ink';
import { Panel, Row } from './Panel.tsx';
import { box } from './glyphs.ts';
import { useTone, type Tone } from './theme.ts';
import { padEnd } from './format.ts';
import { BUTTON_GAP, BUTTON_W, COPIED_LABEL, COPY_LABEL, type ErrorViewPlan, type Role, type Span } from './errorView.ts';

export interface ErrorViewProps {
  plan: ErrorViewPlan;
  service: string;
  width: number;
  rows: number;
  /** Errors open in all; the hint offers `Y` when there is more than one. */
  total: number;
  /** The last copy landed: the button says so. */
  copied: boolean;
  /** The last copy was every error: the Copy all button says so instead. */
  copiedAll?: boolean;
  /** Wraps every `file:line:col` reference in a terminal hyperlink; identity when omitted. */
  link?: (text: string) => string;
}

function color(tone: Tone, role: Role): string {
  if (role === 'ref') return tone.activity;
  if (role === 'string') return tone.accent;
  if (role === 'error') return tone.error;
  if (role === 'muted') return tone.muted;
  return tone.text;
}

function Spans({ spans, link }: { spans: Span[]; link?: (text: string) => string }) {
  const tone = useTone();
  return (
    <Row>
      {spans.map((span, i) => (
        <Text key={i} color={color(tone, span.role)} bold={span.bold}>
          {span.role === 'ref' && link ? link(span.text) : span.text}
        </Text>
      ))}
    </Row>
  );
}

interface ButtonFace {
  label: string;
  edge: string;
  /** Cells between the box sides. */
  inner: number;
}

/** Copy error, then Copy all when the plan has room for it, each in its own box or brackets. */
function CopyButtons({ rows, copied, copiedAll, total, all }: { rows: number; copied: boolean; copiedAll: boolean; total: number; all: ErrorViewPlan['copyAll'] }) {
  const tone = useTone();
  const faces: ButtonFace[] = [{ label: copied && !copiedAll ? COPIED_LABEL : COPY_LABEL, edge: copied && !copiedAll ? tone.accent : tone.activity, inner: BUTTON_W - 2 }];
  if (all) faces.push({ label: copied && copiedAll ? COPIED_LABEL : all.label, edge: copied && copiedAll ? tone.accent : tone.activity, inner: all.x1 - all.x0 - 2 });
  const gap = ' '.repeat(BUTTON_GAP);
  const hint = total > 1 ? `  y copies this   ·   Y copies all ${total}` : '  or press y';
  if (rows === 1) {
    return (
      <Row>
        {faces.map((f, i) => (
          <Text key={i}>
            {i > 0 ? gap : ''}
            <Text color={f.edge} bold>{`[${padEnd(f.label, f.inner)}]`}</Text>
          </Text>
        ))}
        <Text color={tone.muted}>{hint}</Text>
      </Row>
    );
  }
  const rule = (left: string, right: string) => (
    <Row>
      {faces.map((f, i) => (
        <Text key={i} color={f.edge}>
          {(i > 0 ? gap : '') + left + box.h.repeat(f.inner) + right}
        </Text>
      ))}
    </Row>
  );
  return (
    <Box flexDirection="column">
      {rule(box.tl, box.tr)}
      <Row>
        {faces.map((f, i) => (
          <Text key={i}>
            {i > 0 ? gap : ''}
            <Text color={f.edge}>{box.v}</Text>
            <Text color={f.edge} bold>
              {padEnd(f.label, f.inner)}
            </Text>
            <Text color={f.edge}>{box.v}</Text>
          </Text>
        ))}
        <Text color={tone.muted}>{hint}</Text>
      </Row>
      {rule(box.bl, box.br)}
    </Box>
  );
}

export function ErrorView({ plan, service, width, rows, total, copied, copiedAll = false, link }: ErrorViewProps) {
  const tone = useTone();
  const right = plan.more > 0 ? `↓ ${plan.more} more line${plan.more === 1 ? '' : 's'}` : plan.maxOffset > 0 ? 'end' : undefined;
  return (
    <Panel title={`ERROR · ${service.toUpperCase()}`} right={right} rightColor={tone.activity} width={width} rows={rows} borderColor={tone.error} focused>
      <Row color={tone.muted}>{plan.meta}</Row>
      {plan.title.map((line, i) => (
        <Row key={`t${i}`} color={tone.error}>
          <Text bold>{line}</Text>
        </Row>
      ))}
      <CopyButtons rows={plan.buttonRows} copied={copied} copiedAll={copiedAll} total={total} all={plan.copyAll} />
      <Row color={tone.line}>{box.h.repeat(Math.max(0, width - 4))}</Row>
      {plan.body.map((line, i) => (
        <Spans key={i} spans={line.spans} link={link} />
      ))}
    </Panel>
  );
}
