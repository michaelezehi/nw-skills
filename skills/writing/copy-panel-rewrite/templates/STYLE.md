# Plain-language style guide for <product> <surface>

<Owner's brief, quoted, with the date.> Every word a person sees or hears
here must be something they understand on first read. Short sentences, our
own voice. If anything is narrated, the same words must sound right spoken.

## Who is reading

<Who, on what device, in what state of mind, first language. Reading age to
aim for (about 12 is a good default). How we address them ("you"). What we
call the other people in the product.>

## Length

| Thing | Limit |
|---|---|
| Question text | 20 words |
| Answer option | 12 words |
| Intro | 2 sentences, 40 words |
| Recap headline | 8 words |
| Recap body | 3 sentences, 60 words |
| Help text | 1 sentence, 25 words |

If you are over, split the idea or cut it. Never squeeze with semicolons.

## Words

- Say the behaviour, not the concept.
- Banned in user copy: <the domain's jargon, found in Step 1>.
- Allowed because readers use them every day: <terms of the trade>.
- <Spelling: one variety, one spelling of key terms.>
- <Project naming rules from CLAUDE.md, verbatim.>
- Numbers as digits in options, words in prose when under ten.

## Sound (when narrated)

- No slashes ("title/role" becomes "title or role"), no parentheses, no
  "e.g.", "i.e.", "etc.", "vs".
- No lists longer than three inside a sentence.
- A question that ends in a colon before its options is fine.

## Unslop and humanizer

Every string passes `~/.claude/skills/unslop/SKILL.md` and
`~/.claude/skills/humanizer/SKILL.md`: no em or en dashes or spaced hyphen as
a dash, straight quotes, no "not X but Y", no forced threes, no puffery, no
one-line closers.

## Invariants (break one and something breaks)

- <How options are scored: position, letter, keyword. Same count, same order,
  same meaning per option.>
- <Keywords a scorer matches in option text, which must stay.>
- <Whether answers are stored as text, and what that means for shipping.>
- Never touch: <identifier fields: slug, type, order, mapping keys, tags,
  validation, scoring notes>.
- Scale anchors keep their direction.
- <Names that are identifiers (section names as lookup keys, audio folders).
  Propose a new display name as a `call` row; do not edit the identifier.>

## Glossary (same words across every area)

| Old | New |
|---|---|
| <term> | <plain phrase> |

Add rows in your proposals file when you coin a new rendering; the driver
merges glossaries.

## What you hand back

1. Edits in place in the files you own, committed by path once the area's
   typecheck and tests pass.
2. `proposals/<area>.json`: `[{ "id", "path", "field", "old", "new", "note" }]`,
   one per changed string, in reading order. String contents only, never
   the surrounding code.
3. A short list of anything you were unsure kept its meaning.
