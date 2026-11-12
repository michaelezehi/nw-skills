# Product UI

For app screens, admin views, settings, data tables, tools and anything signed in, where the user is in a task. The Extend track's rules in SKILL.md are the summary; this file is the depth.

Contents: the product test, type, colour, tables, numbers, forms, settings, filters, dense data and dashboards, wizards, states, dark mode, overlays, motion, what product UI may do.

## The product test

Familiarity is a feature here. The test is whether a user fluent in the category trusts the screen at once or pauses at every subtly odd component. Product UI fails through strangeness without purpose: over-decorated buttons, mismatched form controls, display fonts in labels, invented affordances for standard tasks. The bar is earned familiarity, and the tool should disappear into the task.

## Type

- One family usually carries headings, buttons, labels, body and data. No display and body pairing.
- A fixed rem scale with steps of 1.125 to 1.2. Users view at a steady size, so a fluid heading that shrinks in a sidebar looks worse, not better.
- Prose keeps a 65 to 75ch measure. Tables and compact UI can run denser; a 120ch table row is fine.
- In a design-system app the type tokens set the sizes; use them and do not add steps.

## Colour

Restrained is the floor. One surface can earn Committed (a report where one category colour carries the page, a welcome screen in a flow), but the app stays Restrained.

- Standardise the state vocabulary: hover, focus, active, disabled, selected, loading, error, warning, success, info. In a design-system app these are tokens already (`danger`, `warning`, `success`, `info`, each with a soft variant).
- The accent marks the primary action, the current selection and state indicators, never decoration.
- A second neutral layer separates sidebars, toolbars and panels from the content surface.
- Inactive states never carry full-saturation colour.

## Tables

- Figures right-aligned with `tabular-nums` and `white-space: nowrap`. Text left-aligned. Each header aligns the way its column does.
- Long text in a cell truncates with an ellipsis and a `title` with the full value, or wraps, decided per column: identifiers, dates, amounts and statuses never wrap; descriptions may.
- Sticky header on any list long enough to scroll.
- Row height comes from the design system's density setting, not from padding you add.
- At 375 px the table scrolls inside its own wrapper (`overflow-x: auto` on a container); the page never scrolls sideways. Turn rows into cards only when each row is read on its own, not when figures are compared down a column.
- A totals row reads as a total: a top rule and the stronger weight, same alignment as the figures above it.
- Use the system's table component when it has one, with its own sorting and empty state.

## Numbers

- Format money and quantities once, in one helper the project already has; never format inline in a component.
- Negative figures follow the project's convention (a minus sign or brackets) everywhere, and colour is never the only sign of a negative.
- Dates use one format per app. Relative times ("3 hours ago") need the absolute value on hover or in a `title`.
- Mono is for code and identifiers, not as a costume for numbers; `tabular-nums` in the body face aligns figures.

## Forms

- Visible `<label>` above the field; placeholders are examples, never labels.
- Helper text below the field, and the error below that, joined to the input with `aria-describedby`.
- Validate on blur, not on every keystroke (password strength is the exception).
- Group related fields under a short heading; one column of fields reads faster than two.
- Match the sibling's save model. Explicit save puts one primary button where the siblings put it; autosave shows a saved or saving state near the title.
- Disabled means "not now, and here is why" (say why, near the control). Read-only means the value is shown as text with no input chrome, for example a locked period or a filed return.
- The primary action is one button. Secondary actions are quieter, not the same button twice.

## Settings

- Use the system's settings layout when it has one: sections with a heading, a one-line description, and the controls.
- Each control shows its current value. A switch takes effect at once; anything with a cost or a side effect needs a button.
- Dangerous settings sit in their own section at the end, with the consequence written next to the action.

## Filters

- Filters sit above the list they filter, in the order people narrow down.
- Active filters are visible as removable chips or a clear count, with one "Clear filters" action.
- An empty result after filtering says so and offers to clear the filters, which is a different message from an empty list.
- Keep filter state in the URL when the siblings do, so a filtered view can be shared and survives reload.

## Dense data and dashboards

- A dashboard answers the question the user opened it for. Put that figure first, and the rest in order of how often it is acted on.
- Stat tiles: three to four in a row at desktop, each with a label, the figure and, when it exists, the comparison that gives it meaning. In a design-system app use its stat components.
- Charts go through the `dataviz` skill and take their colours from the system's chart tokens.
- Cards only where elevation means something. Group with space and dividers first; never nest cards.

## Wizards

- Any multi-step flow shows step navigation with a progress bar: the step names, which are done, which is current, and the bar.
- Each step has one job. Back never loses what was typed.
- The final step summarises what will happen before the action that does it.
- In a design-system app use its flow or guide component when one fits.

## States

Every data view designs all of these before it ships:

- Loading: a skeleton shaped like the result, not a spinner in the middle of content. A spinner belongs inside the button that started the work.
- Empty: what goes here, why it matters, and the action that fills it. First-use empty and filtered-empty are different messages.
- Error: what happened and the fix, near the thing that failed. Keep what the user typed.
- Permission: what they cannot see, and who can grant it.
- Locked or read-only: say why it is locked and what unlocks it (for example "This period is filed").
- Partial: when some rows load and some fail, show the rows and name the failure.

Use the system's empty, skeleton and status components for these.

## Dark mode

In a design-system app, dark mode comes from the tokens: never write a dark colour, a `dark:` variant or a second palette by hand. Without a system, see [color-and-contrast.md](color-and-contrast.md).

## Overlays

- A modal is rarely the first answer. Try inline editing, a disclosure or a side panel first.
- Overlays escape their container: an absolutely placed dropdown inside an `overflow: hidden` or `overflow: auto` ancestor gets clipped. Use `<dialog>`, the popover API, `position: fixed` or a portal.
- Destructive actions: undo before confirm. When it cannot be undone, confirm in place, name the action and its count ("Delete 5 invoices").

## Motion

- 150 to 250 ms on most transitions; users are in flow.
- Motion conveys state: change, feedback, loading, reveal. Nothing else.
- No orchestrated page-load sequence. The product loads into a task.

## What product UI may do

- System fonts and familiar sans faces.
- Standard navigation: top bar and side nav, breadcrumbs, tabs, a command palette.
- Density: many rows, many labels, when users need them.
- Consistency over surprise. The same visual vocabulary from screen to screen is the point; delight is for moments, not pages.
