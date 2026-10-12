/** The card a waiting command's question sits in, drawn from a plan in promptCard.ts. */
import { Text } from 'ink';
import { Panel } from './Panel.tsx';
import { useTone } from './theme.ts';
import type { PromptLine, PromptPlan } from './promptCard.ts';

function Line({ line }: { line: PromptLine }) {
  const tone = useTone();
  switch (line.kind) {
    case 'question':
      return (
        <Text wrap="truncate" color={tone.text} bold>
          {line.text}
        </Text>
      );
    case 'field':
      return (
        <Text wrap="truncate" color={tone.accent}>
          {line.text}
        </Text>
      );
    case 'option':
      return (
        <Text wrap="truncate" color={line.selected ? tone.accent : tone.text} bold={line.selected}>
          {line.selected ? '❯ ' : '  '}
          {line.text}
        </Text>
      );
    case 'buttons':
      return (
        <Text wrap="truncate">
          {line.buttons.map((b, i) => (
            <Text key={b.index}>
              {i > 0 ? '  ' : ''}
              <Text color={b.filled ? tone.accent : tone.muted} inverse={b.filled} bold={b.filled}>
                {b.label}
              </Text>
            </Text>
          ))}
        </Text>
      );
  }
}

export function PromptCard({ plan, width, label }: { plan: PromptPlan; width: number; label: string }) {
  const tone = useTone();
  return (
    <Panel title={plan.title} right={label} width={width} rows={plan.rows} focused borderColor={tone.activity}>
      {plan.lines.map((line, i) => (
        <Line key={i} line={line} />
      ))}
    </Panel>
  );
}
