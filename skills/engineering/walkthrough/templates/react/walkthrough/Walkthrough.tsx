'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { RunView, WalkthroughPrompt, WalkthroughStory } from './story-types';
import { createLocalDriver } from './local-driver';
import { useWalkthroughLoop } from './useWalkthroughLoop';
import { useStepKeys } from './useStepKeys';
import { useWalkthroughStore } from './walkthrough-store';
import { WalkthroughBar } from './WalkthroughBar';
import { ExplainReader } from './ExplainReader';
import { PromptLayer } from './PromptLayer';
import { SwitchLoader } from './SwitchLoader';

/**
 * Mount once in the signed-in layout. Renders nothing until a tour starts
 * (`startTour(key)`), then the bar, the reader, the step's prompt card and
 * the switch loader. One story per role: pass only the stories this viewer
 * may take, keyed by story key.
 */
export function Walkthrough({
  stories,
  viewerId,
}: {
  stories: Record<string, WalkthroughStory>;
  /** Keeps progress per person on a shared machine. */
  viewerId: string;
}) {
  const key = useWalkthroughStore((st) => st.story);
  const story = key ? stories[key] : undefined;
  if (!story) return null;
  return <Tour key={story.key} story={story} viewerId={viewerId} />;
}

/** Start a tour from any "Take the tour" entry. */
export function startTour(storyKey: string): void {
  useWalkthroughStore.getState().setStory(storyKey);
}

function Tour({ story, viewerId }: { story: WalkthroughStory; viewerId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<RunView | null>(null);
  const driver = useMemo(() => createLocalDriver(story, viewerId, setRun), [story, viewerId]);
  // The saved position, on first paint.
  useEffect(() => setRun(driver.current()), [driver]);

  const loop = useWalkthroughLoop({ run, driver });

  // Back and Next from the reader and the arrow keys come through the store.
  const stepRequest = useWalkthroughStore((st) => st.stepRequest);
  const onRequest = useEffectEvent((dir: 'back' | 'forward') =>
    void (dir === 'back' ? loop.onBack() : loop.onForward()),
  );
  useEffect(() => {
    if (stepRequest) onRequest(stepRequest.dir);
  }, [stepRequest]);
  useStepKeys(run !== null && run.status !== 'idle');

  // The step on screen raises its card once; a dismissed card stays gone.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const step = run?.lastStep;
  const prompts: WalkthroughPrompt[] =
    step?.prompt && !dismissed.has(step.id)
      ? [
          {
            id: step.id,
            title: step.prompt.title,
            body: step.prompt.body,
            ctaLabel: step.prompt.ctaLabel ?? null,
            ctaRoute: step.prompt.ctaRoute ?? null,
            art: step.explain.art,
          },
        ]
      : [];
  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  const end = () => {
    void loop.onPause();
    useWalkthroughStore.getState().setExplanation(null);
    useWalkthroughStore.getState().setStory(null);
  };

  if (!run) return null;
  return (
    <>
      <SwitchLoader />
      <PromptLayer
        prompts={prompts}
        onDismiss={dismiss}
        onAct={(p) => {
          dismiss(p.id);
          if (p.ctaRoute) router.push(p.ctaRoute);
        }}
      />
      <ExplainReader />
      <WalkthroughBar run={run} loop={loop} onEnd={end} />
    </>
  );
}
