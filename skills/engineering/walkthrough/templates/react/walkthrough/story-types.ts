/**
 * The walkthrough's data shapes. A story is one role's journey through the
 * app; a step is one screen in it. Stories never mix roles: a viewer who
 * picks the coach tour only ever sees coach steps.
 */

/** One step as the screens read it: copy already filled in for this viewer. */
export interface WalkthroughStep {
  id: string;
  /** 0-based position in its story. */
  index: number;
  /** "Your first report is ready". Sentence case, no jargon, no step number. */
  title: string;
  /** The screen this step shows. The guide finds the menu item that opens it. */
  route: string;
  /**
   * Director tier only: the persona to show this step as, or null for the
   * viewer themselves. A plain user walkthrough leaves it null.
   */
  viewAs: string | null;
  /** How long the step holds when Explain is off. */
  holdMs: number;
  explain: {
    /** A slug for `WalkthroughArt`. Unknown slugs fall back to the default picture. */
    art: string;
    /** What just happened, in one or two sentences. */
    what: string;
    /** Why it matters to this viewer, in one or two sentences. */
    why: string;
  };
  /**
   * A card the step raises, in place of the email or notification the real
   * flow would send. Optional; most steps have none.
   */
  prompt?: { title: string; body: string; ctaLabel?: string; ctaRoute?: string };
  /**
   * What the narrator says. `lead` plays as the step lands; `detail` plays
   * once the reader opens on it. Clips are generated ahead of time and one
   * clip serves every viewer, so never put a viewer's name, a date or any
   * other filled-in value here. Optional: a step without it is silent and
   * keeps its plain timing.
   */
  narration?: { lead: string; detail: string };
  /**
   * The controls the step talks about. When the step lands they pop and get
   * a ring while the page dims around them; a `click` target (a tab) is then
   * clicked for the viewer. Absent: the step has no focus pass.
   */
  focus?: FocusSpec[];
  /**
   * The host feature this step's page belongs to, when a workspace can turn
   * it off. `filterStory` drops the step where it is off, so every step lands
   * on a page this viewer can open. Absent for pages every viewer can open.
   */
  module?: string;
}

/**
 * One control to light up. `name` is its label as the viewer reads it: its
 * `aria-label`, an input's placeholder, else its text. A host with a
 * translation catalog writes the catalog key here and passes `focusName` to
 * `Walkthrough` to resolve it. `selector` is for a control with no stable
 * label. A name that matches several controls lights them all. `role: 'tab'`
 * keeps a tab apart from a menu link with the same words; `area` rings the
 * card or stat round a heading or label. A `click` target ends a stage: the
 * specs after it are looked for once the click has changed the screen.
 */
export type FocusSpec = ({ name: string; role?: 'tab'; area?: true } | { selector: string }) & { click?: true };

export interface WalkthroughStory {
  /** One story per role: 'founder', 'coach', 'investor', 'admin'... */
  key: string;
  /** "Founder story". Shown as the reader's eyebrow and in the bar. */
  label: string;
  steps: WalkthroughStep[];
}

export type RunStatus = 'idle' | 'playing' | 'paused' | 'done';

/**
 * Where a story run stands. `index` counts the steps already shown, so the
 * step on screen is `steps[index - 1]` and step one has not played at 0.
 */
export interface RunView {
  story: string;
  storyLabel: string;
  /** Every step's title, in order, for the journey list. */
  steps: string[];
  /** Every step's picture slug, in order, for the journey icons. A run without them draws the default. */
  arts?: string[];
  index: number;
  total: number;
  status: RunStatus;
  /** The step on screen, or null before step one. */
  lastStep: WalkthroughStep | null;
  /** Director tier: another tab holds the run. Always false for the local driver. */
  drivenElsewhere: boolean;
}

/**
 * Whatever holds the run. The local driver keeps it in the browser; the
 * director tier keeps it on the server so data writes can be undone.
 * Every call that moves the run takes the index the caller saw, so a stale
 * or doubled call changes nothing.
 */
export interface WalkthroughDriver {
  start(): Promise<RunView>;
  advance(expectedIndex: number, opts: { step: boolean }): Promise<RunView>;
  back(expectedIndex: number): Promise<RunView>;
  pause(): Promise<RunView>;
  restart(): Promise<RunView>;
}

/** A message that stands in for an email or notification during the story. */
export interface WalkthroughPrompt {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaRoute: string | null;
  /** The picture of the step that raised it. */
  art: string | null;
}
