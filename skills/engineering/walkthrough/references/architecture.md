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
     ├─ PromptLayer                     the step's prompt (local) or wt_prompts (director)
     ├─ ExplainReader                   store.explanation
     │   └─ NavSpotlight                findNavTarget(step.route)
     └─ WalkthroughBar                  run + loop handlers
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
sliders, contenteditable, and with any modifier. `preventDefault` +
`stopPropagation` when handled, so the page does not also move.

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
