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

When a new bug turns up in a host, add a row here (and to nw-skills).
