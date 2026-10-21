/**
 * Every string the walkthrough shows. Unslop rules apply: no em or en dashes,
 * sentence case, no "beat", "act" or other script words; a person reads
 * "Step 3 of 9".
 */
export const WALKTHROUGH_COPY = {
  barLabel: 'Walkthrough controls',
  play: 'Play',
  resume: 'Resume',
  pause: 'Pause',
  step: 'Next step',
  back: 'Previous step',
  restart: 'Start over',
  keysHint: 'Arrow keys move between steps',
  done: 'You have seen the whole story',
  follow: 'Follow the story',
  explain: 'Explain',
  explainHint: 'Stop after each step and explain what happened',
  sound: 'Sound',
  soundTurnOff: 'Turn sound off',
  soundTurnOn: 'Turn sound on',
  soundHint: 'Narrate each step out loud. Press M to turn sound on or off',
  soundKey: (action: string) => `${action} (M)`,
  explainLabel: 'What just happened',
  explainWhat: 'What happened',
  explainWhy: 'Why it matters',
  explainContinue: 'Continue',
  explainPause: 'Pause the countdown',
  explainResume: 'Resume the countdown',
  explainClose: 'Close',
  journey: 'The journey',
  showMeHow: 'Show me how to get there',
  showMeHowLink: (label: string) => `Open ${label}`,
  showMeHowFallback: 'this page',
  switching: 'Opening the next step',
  promptsLabel: 'Messages',
  promptEyebrow: 'New for you',
  dismiss: 'Dismiss',
  failed: 'That did not work. Try again.',
  startTour: 'Take the tour',
  endTour: 'End the tour',
} as const;

export function stepProgressCopy(n: number, total: number): string {
  return `Step ${n} of ${total}`;
}
