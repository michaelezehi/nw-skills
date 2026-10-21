# Method: research the host, then write the stories

## 1. Investigate before writing a step

Write `INVESTIGATION.md` in the task folder. Every claim cites a file path.

| Find | Where to look | Why it matters |
|---|---|---|
| Roles | the user model's role field, role routing, the sidebar's role switch | one story per role |
| Role home routes | role routing (`/app`, `/coach`, `/vc`) | the nav guide treats a one-segment path as a home and never falls back to it |
| Menu chrome | header, nav and sidebar components, every `href` | "Show me how" only rings links inside `header`, `nav`, `aside` |
| Screens with no menu item | tabs inside a page (`?tab=`), detail pages, modals | each becomes a `REACHED_THROUGH` entry, or the step shows no "Show me how" |
| Real routes | the router's page files | a step route that does not exist breaks the story; check each one |
| State library | Zustand? Redux? Context? | the store template is Zustand; port it if the host uses something else |
| Motion | framer-motion? | the templates use it; without it, swap for CSS transitions |
| Icons | Phosphor? Lucide? | the templates import `@phosphor-icons/react` `*Icon` names |
| Illustration system | an iso set, an icon family, image assets | wire it into `walkthrough-art.tsx` |
| Theme | CSS variables, Tailwind config, dark mode | map onto the `--wt-*` tokens |
| Header height | the app header | set `--wt-header-h` so the reader starts below it |
| Existing loader | a page loader component | render it inside `SwitchLoader` |
| Viewer id | the signed-in user hook | keys progress per person |
| `--director` only | a sandbox or demo data layer, persona model, allowlist | the director tier needs all three; without them, stop and say so |

## 2. One story per role, never mixed

A single long script across roles confused the first viewer ("Beat 4 of 18"
while watching a founder screen). Each role gets its own story:

- 5 to 9 steps. Fewer feels thin; more loses people.
- A member's story never shows admin or partner screens. A partner story may
  show the member side of the same exchange (the member accepting the
  partner's invite), because that is the partner's own journey.
- Progress reads "Founder story · Step 3 of 9". Never "beat", "act", "scene"
  or any script word. Never a global count across stories.

## 3. Write each step

```ts
{
  id: 'report-ready',               // stable, kebab case
  index: 2,
  title: 'Your first report is ready', // what the viewer sees happen, sentence case
  route: '/app/reports',            // a real page
  viewAs: null,                     // director tier only
  holdMs: 8000,                     // when Explain is off: long enough to read the screen
  explain: {
    art: 'folder-open',             // a slug the art adapter knows
    what: 'With both teammates' answers in, the report is built: where you agree, where you differ, and what to talk about first.',
    why: 'Two sets of private answers become one picture the team can act on.',
  },
  prompt: { title: 'Your report is ready', body: 'See where you agree...', ctaLabel: 'Read the report', ctaRoute: '/app/reports' },
}
```

- **Title**: the event, not the screen name. "Sam finishes the setup",
  not "Setup page".
- **What**: one or two sentences, concrete, naming the people and the thing.
- **Why**: the value to this viewer, one or two sentences. If it reads the
  same on any app, rewrite it.
- **Art**: pick the picture that shows the thing (a signed page for signing,
  a gauge for capacity). One picture per step; reuse is fine.
- **Prompt**: only where the real product would send an email or a
  notification. It is that message, in the product's own voice.
- **Order**: the order a real person meets the screens. Start where a new
  user lands.
- **Focus**: name the one control the step is about, so the viewer sees
  where to click. A tab the step is about gets `click: true`; everything
  else is lit only. Never click what runs, sends, saves, publishes, records,
  generates, charges or opens a pop-up. A heading or stat label takes
  `area: true` so its whole card lights. The pass lights only the clicked
  specs, or the first spec when none click, so list the main control first.
  The rest still count for where the reader sits.
- **Routes with pop-ups**: never a full-screen or modal param
  (`?companion=full`, `?jobId=`). A corner pop-up opened by a query is fine
  if its param is in `OPENER_PARAMS`, and its step's focus names the pop-up
  (a selector) so the reader moves clear of it.

### Feature stories

After the role stories, map the product's own standout pages into short
feature stories (3 to 6 steps each): the critical path and what sets the
product apart. Map them with one agent per app, each step citing its route,
its focus keys and any trap (an overlay param, a button that creates
something, a tab hidden on some plans). Get the titles approved, as for role
stories. Each story says who gets it (roles) and what it needs (modules,
menu switches, region); content for one country is gated on the company's
own setup and has a region-neutral sibling.

Show the owner the step titles per role and get a yes before
building. Titles are the cheapest thing to change.

## 4. Timing

| Thing | Value | Why |
|---|---|---|
| Reader countdown | 30 s | enough to read what and why twice; the viewer can pause |
| Countdown while a switch lands | holds | the clock never runs on an empty page |
| Step hold, Explain off | 6 to 10 s | time to look at the screen |
| Prompt card | 8 s, held on hover or focus | WCAG 2.2.1: never time out what someone is reading |
| Spotlight before its click | 1.6 s | long enough to see where the item is |
| Focus light before a tab click | 1.6 s, then a 0.35 s fade | the eye lands before the screen changes |
| Focus pass ceiling | 12 s | a page that never renders the control never stalls the story |
| Reader placement re-measure | every 1 s and on resize | a card that opens late still moves the reader |

## 5. Entry points

- "Take the tour" in the profile or help menu, starting the viewer's role story.
- Optional first-login start: once, remembered per viewer.
- The bar's close ends the tour; progress stays, so "Take the tour" resumes.

## 6. Copy rules (unslop)

No em or en dashes. Sentence case. No "AI". No puffery. The host's own
terminology wins (if the product says "workspace", never "project").
Every string lives in `walkthrough-copy.ts`; step copy lives in the story data.
