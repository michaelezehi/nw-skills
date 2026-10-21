'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { RunView, WalkthroughPrompt, WalkthroughStory } from './story-types';
import { createLocalDriver } from './local-driver';
import { useWalkthroughLoop } from './useWalkthroughLoop';
import { useStepKeys } from './useStepKeys';
import { useNarration } from './useNarration';
import { useWalkthroughStore } from './walkthrough-store';
import { WalkthroughBar } from './WalkthroughBar';
import { ExplainReader } from './ExplainReader';
import { PromptLayer } from './PromptLayer';
import { SwitchLoader } from './SwitchLoader';
import { FocusLayer } from './FocusLayer';
import { asShown } from './focus-guide';
import { withoutOpeners } from './opener-params';

/**
 * Mount once in the signed-in layout. Renders nothing until a tour starts
 * (`startTour(key)`), then the bar, the reader, the focus light, the step's
 * prompt card and the switch loader. Pass only the stories this viewer may
 * take, keyed by story key (`offerStories` cuts them to the workspace); with
 * more than one, the bar's picker switches between them.
 */
export function Walkthrough({
  stories,
  viewerId,
  focusName = asShown,
}: {
  stories: Record<string, WalkthroughStory>;
  /** Keeps progress per person on a shared machine. */
  viewerId: string;
  /** Turns a focus spec's name into the label on screen. Only for a host that names targets by catalog key. */
  focusName?: (name: string) => string;
}) {
  const key = useWalkthroughStore((st) => st.story);
  const story = key ? stories[key] : undefined;
  if (!story) return null;
  return <Tour key={story.key} story={story} stories={stories} viewerId={viewerId} focusName={focusName} />;
}

/**
 * Start a tour from any "Take the tour" entry. Switching to another story
 * closes the last story's reader first, or the new story would open on it.
 */
export function startTour(storyKey: string): void {
  const { story, setExplanation, setStory } = useWalkthroughStore.getState();
  if (story !== storyKey) setExplanation(null);
  setStory(storyKey);
}

function Tour({
  story,
  stories,
  viewerId,
  focusName,
}: {
  story: WalkthroughStory;
  stories: Record<string, WalkthroughStory>;
  viewerId: string;
  focusName: (name: string) => string;
}) {
  const router = useRouter();
  const [run, setRun] = useState<RunView | null>(null);
  const driver = useMemo(() => createLocalDriver(story, viewerId, setRun), [story, viewerId]);
  // The saved position, on first paint.
  useEffect(() => setRun(driver.current()), [driver]);

  const loop = useWalkthroughLoop({ run, driver });
  // A pop-up a step opened (`OPENER_PARAMS`) closes with the tour, or on a jump to another story.
  useEffect(
    () => () => {
      const closed = withoutOpeners(window.location.search);
      if (closed !== null) router.replace(`${window.location.pathname}${closed}`);
    },
    [router],
  );
  // The narrator: mounted here once, read by the reader and the loop through the store.
  // A director-tier run held by another tab reports `drivenElsewhere`; that tab speaks.
  useNarration(run, run?.drivenElsewhere !== true);

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
      <FocusLayer resolveName={focusName} />
      <ExplainReader resolveName={focusName} />
      <WalkthroughBar run={run} loop={loop} onEnd={end} stories={stories} />
    </>
  );
}
