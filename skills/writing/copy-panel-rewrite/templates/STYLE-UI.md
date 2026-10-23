# Screen copy addendum to STYLE.md

<Owner's example of a string that is too technical, quoted.>

## What a screen string should do

- Say what the person gets or does, in their words.
- One idea per sentence. A description is at most 2 sentences and 30 words.
  Headlines at most 10 words, no full stop.
- Buttons are a verb and an object, 1 to 3 words.
- No positioning lines inside the product. Cut them or say the plain fact.
- Empty states say what is missing and the one thing to do next.
- Errors say what went wrong and how to fix it. No apologies, no "Oops".

## Names we keep

<Product and feature names, capitalised. When a name is not self-explanatory,
say what it is the first time on a screen.>

## Do not touch

- Identifiers, routes, query keys, analytics names, enum values, CSS classes,
  test ids, `aria-*` values tests select on (update the test if visible text
  it pins changes), and any string compared in logic.
- Prices and anything from the price source of truth.
- Products or surfaces with their own naming authority: <list>.
- Legal pages beyond fixing dashes.
- Files outside your brief. List strings you need changed elsewhere.
- Paths already modified in `git status --porcelain` at your start.

## What you hand back

Edits in place, committed by path per folder once typecheck and the area's
tests pass: `copy(<area>): plain language for <what>`. Plus
`proposals/ui-<area>.json` in the STYLE.md shape, `id` = `path:line`.
