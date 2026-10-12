# Pitfalls: every bug the reference build hit, as rules

| # | Symptom | Cause | Rule |
|---|---|---|---|
| 1 | "Beat 4 of 18" on a founder screen confused the viewer | one script across every role, script jargon in the UI | one story per role; "Step n of N"; no script words |
| 2 | Blank screen while the story switched persona or page | the frame paused with nothing in it; only user-picked switches showed a loader | every switch runs under `withSwitch`, and the loader always renders |
| 3 | The reader's picture spilled over the title | art sized at `72%` grows with the panel's width, not its 150px height | art at a fixed pixel size inside an `overflow-hidden` box |
| 4 | "Show me how" always rang Home | the role home (`/app`) is a parent of every route, so the longest-parent fallback found it | a one-segment home matches only itself; `REACHED_THROUGH` maps tab screens to their menu item; no match, no button |
| 5 | The spotlight never clicked, or clicked late | its timer effect depended on the `onDone` prop, so every parent render restarted it | `useEffectEvent` for the click, effect keyed on the target only |
| 6 | Back made the story jump forward | closing the reader resolved `untilExplained`, and the loop advanced before it saw the stop flag | in `haltLoop`, cancel the wait BEFORE clearing the explanation |
| 7 | The loop never started in development | StrictMode unmount set the alive flag false and the remount never set it back | set `aliveRef.current = true` in the mount effect, every mount |
| 8 | The countdown ran out while the next screen was still loading | it ticked through the switch | the countdown holds while `pending > 0`, while paused, and while the spotlight shows |
| 9 | Two open tabs played the story at double speed | both ran the loop | `expectedIndex` idempotency plus a per-tab driver lease (director tier) |
| 10 | Prompt cards hid under the reader | both pinned top right | the prompt stack moves left by the reader width + 32px while it is open |
| 11 | Switching to another role's story left the last story's data behind | the run row was reused | starting a different story undoes the previous one's writes first |
| 12 | Arrow keys hijacked the page's own arrow navigation | a global listener | listen only while a story is under way; skip editable targets and modifiers; say so in the report |
| 13 | A restart test passed with dangling references | it compared row counts | compare content with ids stripped, and check every id resolves |
| 14 | Effects emailed a persona | a shared helper scheduled a send | the recording ctx swallows the scheduler; persona emails are on an unroutable domain that throws |
| 15 | A step that only changes `?tab=` stayed on the old tab | the loop compared paths without the query and returned early | same path, different query: `router.push` the step route in place, no loader |
| 16 | The last step never opened its reader while playing | the loop broke on any status but `playing`, and the last advance returns `done` | on `done`, open the last step's reader, then stop |
| 17 | "Show me how" found nothing for menu destinations | dropdown links render into a portal only while the menu is open | mark the trigger and its menu container with `data-walkthrough-menu`; ring and click the trigger, wait for the menu, then ring the link |
| 18 | Homes that are not one segment (`/{org}/{company}/overview`, `/me/overview`) caught every route | the one-segment home rule assumes flat homes | hosts with scoped homes pass an explicit homes list that matches only itself |
| 19 | The spotlight ring hid under an open dropdown | the menu's own z (9999+) is above the ring's 120 | lift the ring above the menu only while it rings a link inside a marked menu |

When a new bug turns up in a host, add a row here (and to nw-skills).
