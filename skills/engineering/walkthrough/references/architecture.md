# Architecture

## Client (both tiers)

```
Walkthrough (mount once in the signed-in layout)
 └─ Tour (per story)
     ├─ driver: local (browser) or Convex (director tier)
     ├─ useWalkthroughLoop({ run, driver, show? })
     ├─ useStepKeys(enabled)            arrow keys → store.requestStep
     ├─ effect on store.stepRequest     → loop.onBack / loop.onForward
     ├─ SwitchLoader                    store.pending > 0
     ├─ FocusLayer                      store.focusing → light, pop, click a tab
     ├─ PromptLayer                     the step's prompt (local) or wt_prompts (director)
     ├─ ExplainReader                   store.explanation
     │   ├─ ReaderShell (per step)      useReaderPlacement → end | start | bottom
     │   ├─ JourneyList                 current first, done at the bottom
     │   └─ NavSpotlight                findNavTarget(step.route)
     └─ WalkthroughBar                  run + loop handlers
         └─ StoryPicker                 only with more than one story
```

### The store (`walkthrough-store.ts`, Zustand)

| Field | Meaning |
|---|---|
| `story` | the story key in play, or null (nothing renders) |
| `follow` | move the screen with each step (sessionStorage) |
| `explain` | open the reader after each step (sessionStorage, on by default) |
| `explanation` | the open reader; the loop waits while it is set |
| `pending` | screen switches in flight; the loader shows above zero |
| `stepRequest` | `{dir, n}` asked by the reader or keys; the bar's owner acts |
| `focusing` | the step whose focus pass is running; the loop waits while it is set, and clearing it (Back, Next, pause) ends the pass |

Only the loop moves the run. The reader and the keys never call the driver;
they raise `stepRequest`, and one effect in `Tour` calls `onBack` or
`onForward` through `useEffectEvent`. Two owners moving one run was the
source of double steps.

### The run (`RunView`)

`index` counts steps already applied. The step on screen is
`steps[index - 1]`; at 0 nothing has played. Every driver call that moves
the run takes the `expectedIndex` the caller saw and returns the run
unchanged when it is stale, so a doubled click or a second tab cannot skip
a step.

### The loop (`useWalkthroughLoop`)

```
while playing:
  next = driver.advance(view.index)
  if next.index !== view.index + 1: stop      (stale, or another tab moved it)
  show(next.lastStep)                          (route change under the loader, or persona switch)
    same path: take off opener params the step does not set, then move ?tab= in place
    untilFocused(step)                         (the focus pass, never past FOCUS_CEILING_MS 12s)
  holdAfter(next):  Explain on  → open reader, wait until it closes
                    Explain off → wait step.holdMs
```

- `wait` and `untilExplained` are cancellable through `cancelWait`.
- `aliveRef` is set true on EVERY mount (StrictMode mounts twice).
- `showFromLoop` and `runLoop` are effect events, so the loop reads the
  latest `follow` and path without restarting.
- `haltLoop` (used by Back and Start over): set `holdLoop` and `stopLoop`,
  cancel the wait FIRST, then close the reader, pause, and await the loop.
- `onForward`: while playing, close the reader (the story carries on);
  paused or idle, play one step with its reader.
- `onBack`: halt, `driver.back(index)`, show that step, open its reader.
  The run is left paused; Play carries on from there.

### The local driver

Progress per viewer per story in localStorage (`wt-run:<viewer>:<story>`).
A tour left playing reloads paused. Storage that throws means the tour
starts from the top; never block on it.

### The nav guide (`findNavTarget`)

1. Strip the query; map through `REACHED_THROUGH` (screens without a menu item).
2. Consider only `a[href]` inside `header, nav, aside`, never inside
   `[data-walkthrough-ui]`, same origin, visible.
3. Score: exact path `10000 + length`; a parent path scores its length,
   except a role home (one segment), which matches only itself.
4. Best score wins; none means no "Show me how" button.

### Keys (`useStepKeys`)

Left and right arrows, on window in capture phase, only while a story is
under way (`run.status !== 'idle'`). Ignored in inputs, textareas, selects,
sliders, contenteditable, combobox, listbox, option and menu roles, and with
any modifier. `preventDefault` + `stopPropagation` when handled, so the page
does not also move.

### The focus pass (`FocusLayer`, `focus-guide.ts`)

A step names what it talks about in `focus?: FocusSpec[]`:

```ts
type FocusSpec = ({ name: string; role?: 'tab'; area?: true } | { selector: string }) & { click?: true };
```

- `name` is a catalog key, resolved in the viewer's language and matched to a
  control's accessible name (`aria-label`, an input's placeholder, else its
  text), with a count or a dot after it allowed ("Time off 4"). Host
  components need no markup. `selector` is for a control with no stable label.
- `area` lights the card or stat round a label instead of the label: climb
  past pills (rounded and under 48px tall) to the first rounded box, else the
  widest box below a row wider than 70% of the screen.
- `click` is for tabs only. The pass lights it, waits `FOCUS_HOLD_MS` (1.6 s),
  clicks, and fades. A step whose route has `?tab=` and a clicking focus lets
  the viewer watch the click; the query is pushed only if the tab never showed.
- `primaryFocus`: a step lights only what it clicks, one stage at a time, or
  its first spec when it clicks nothing. Stages split at each click, since
  what comes after only exists once the click has changed the screen.
- Skipped: the walkthrough's own UI, `aria-hidden`, and anything faded out
  (opacity under 0.01 on it or a parent). The finder polls for
  `FOCUS_FIND_MS` (2.5 s), then goes on with whatever it found.
- z 65: over the page, under the bar, reader and spotlight. A host scrim just
  under it (a Companion card's at z 60) still closes on a click, so never
  click through one.

### Reader placement (`reader-placement.ts`)

Each step's reader mounts as its own `ReaderShell` (keyed by step id) and
asks `useReaderPlacement(step.focus, t, geometry)` where to sit. It measures
every target the step's focus names (all specs, not only the primary one) and
takes the first place that covers none of them: `end` (the usual side,
mirrored in RTL), `start`, then `bottom`, a shorter panel above the bar with
no picture. When all three cover something it takes the one that covers
least. It measures on mount, every second and on resize, so a card that
opens late still moves it, and glides there with framer `layout`.
`geometry` must match the reader's classes: width, top (header height) and
the bottom gap above the bar.

### Openers (`opener-params.ts`)

`OPENER_PARAMS` lists the query params that open a pop-up in the host
(`companion` for a Companion card on `?companion=1`). The loop takes off any
the next step does not set itself when it stays on the same page, keeping the
other params; a route to another page drops them already. The `Tour` unmount
(end of tour, or a jump to another story) takes them off too. A host whose
pop-ups are not URL driven needs a close hook per opener instead; say so in
the report.

### Several stories per viewer (`StoryPicker`)

A viewer may take a role story plus feature stories. `Walkthrough` gets every
story the viewer may take, keyed by story key; the bar shows a picker when
there is more than one. Picking cuts the narration and calls `startTour(key)`.
Each story keeps its own place (`wt-run:<viewer>:<story>`). The picker is the
host's own design-system combobox, never a raw `<select>`, with each story's
first-step icon and dashed separators matching the journey list.

Which stories a viewer gets is decided once, from their own setup:

- Role (`roles` on the story) and, per step, anything the host can switch
  off (modules, menu switches, white label, plan).
- The company's setup, never the viewer's: `regions` / `notRegions` from the
  company record for country content (a Saudi-only compliance story), with a
  region-neutral sibling for everyone else.
- A story left with fewer than 3 steps after its gates is not offered.

## Director tier (`--director`)

For demos and video: the story writes real demo data and switches persona.

### Gate

`WALKTHROUGH_DIRECTOR_EMAILS` (comma list) on the server, checked against the
REAL signed-in user on every call, even while acting as a persona. Unset on
production keeps the tier inert.

### Acting as a persona

Store `acting_as_user_id` on the director's workspace prefs. The auth
resolver returns the persona only when ALL hold, re-checked on every call:
the real user is a director, the workspace is in sandbox mode, the target is
a persona row owned by this director. Anything else returns the real user.
Leaving the sandbox clears it. Return `{ user, realUser }` so run calls still
check ownership against the real user.

### Run module (`templates/convex/walkthrough_run.ts`)

- `getRun({story})`: null when the run is on another view's story.
- `startRun({story})`: a different story resets first (undo + clear prompts).
- `advanceBeat({runId, expectedIndex, step?, driverId?})`: idempotent on the
  index; refuses (returns `drivenElsewhere`) while another tab's lease holds;
  a paused run moves only with `step: true`; applies the effect through the
  recording ctx; writes prompts; sets the lease to `hold + 15s`.
- `stepBack({runId, expectedIndex})`: undo everything, replay steps
  `0..n-2`, re-raise only the prompts of the step now on screen, pause.
- `pauseRun`: clears the lease so any tab may step.
- `restartRun({story})`: undo, clear prompts, index 0, idle.

### The ledger (`templates/convex/_ledger.ts`)

Effects run against `recordingCtx(ctx, runId)`: every insert, patch, replace
and delete is logged to `wt_writes` with the row before, then passed through.
Its scheduler swallows every call, so a step never sends mail or moves on
its own. Undo walks newest first. Guard every write to sandbox teams and the
director's personas.

Test it the way the reference did: snapshot every table with ids stripped,
play the whole story, restart, compare; and check every id field still
resolves. Counts alone passed while rows pointed at deleted ids.

### Prompts

`wt_prompts` rows, read by `myPrompts` for the user currently in view (the
persona), filtered to the real director's runs. Each carries the step's art
so the card shows the split picture.
