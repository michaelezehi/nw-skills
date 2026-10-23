# Report spec

The page template in `scripts/render-report.mjs` is the house template. Every report uses it as it is: never restyle it inside a run. Only the cover is designed per report (`references/cover.md`). Template changes are their own task.

`scripts/render-report.mjs` turns one JSON file into the black-and-white report page. Every text field accepts three inline marks: `**bold**`, `` `code` ``, and a link written `[label](https://url)` or `[label](other-report.html)` for a sibling page. Everything else is escaped.

## Top level

```json
{
  "skill": "pricing",
  "title": "What we should charge",
  "subtitle": "One sentence on what this page answers.",
  "project": "Acme",
  "date": "22 Oct 2026",
  "aside": "Optional one-line takeaway under the title.",
  "icon": "discount-tag",
  "assumptions": ["the buyer pays from a company card"],
  "summary": { "label": "Recommendation", "score": "€39", "out_of": "", "headline": "Compass at €39 a month per team.", "text": "Why, in two sentences." },
  "steps": ["Read facts.md and competitor-matrix.md", "Checked 4 competitor prices on the web", "Scored 6 pricing models"],
  "sections": [ { "heading": "Pricing model analysis", "icon": "control-sliders", "blocks": [] } ],
  "next": ["Run `/gtm plan` to turn these prices into a launch plan"],
  "sources": [ { "label": "Paired on the App Store", "url": "https://...", "checked": "22 Oct 2026" } ],
  "footer": "optional",
  "cover": "pricing-strategy.cover.html",
  "parts": ["validate-idea.report.json", "pricing-strategy.report.json"]
}
```

- `skill` picks the header icon (see the table below) unless `icon` names a different icon.
- `summary` renders as the verdict block with `score` set large. Use it for the single most important answer: a score (`19` out of `35`), a price, a verdict word.
- `steps` renders as "What I did": what was read, searched, scored and saved. 3 to 7 items.
- `assumptions` print under the title, each prefixed "Assumption:".
- `cover` names an HTML fragment (relative to the JSON) for page one, designed per `references/cover.md`. Leave it out for a plain black cover drawn from the title and summary; set it to `false` for no cover.
- `parts` bundles other report JSONs after this one, each starting on a new page, into one document and one PDF. Sibling links like `[validate](validate-idea.html)` become in-document links. `/gtm on` uses this for the index.
- Every page carries a sticky "Download PDF" button. With `--pdf` it downloads that file; without it, it opens the browser's save-as-PDF. Always render with `--pdf` so the button hands over the real file.
- Add `--pdf <file>` to the render command for a PDF (A4, headless Chrome; set `CHROME_PATH` if Chrome lives elsewhere).

## Blocks

| `type` | Fields | Use for |
|---|---|---|
| `p` | `text` | A paragraph |
| `list` | `items[]` | Ticked points |
| `steps` | `items[]` | A numbered sequence |
| `note` | `text` | A short muted aside, one line |
| `callout` | `label`, `text` | One boxed point that matters |
| `verdict` | `label`, `score`, `out_of`, `headline`, `text` | A second scored result inside a section |
| `stats` | `items[{value,label}]` | 2 to 6 headline numbers |
| `table` | `head[]`, `rows[[]]`, `highlight[]` (row indexes) | Scorecards, matrices, comparisons |
| `cards` | `items[{tag,title,price,meta,points[],foot,target}]` | Tiers, personas, options. `target: true` inverts one card |
| `bars` | `title`, `unit`, `items[{label,value,display,kind,low,note}]` | Any price comparison. One scale per chart; `value` is a number in `unit`, `display` is the printed price. `kind`: `them` (competitor, grey), `now` (our price today, outline), `suggest` (the price we recommend, solid black). `low` draws a range. Order: competitors high to low, then `now`, then `suggest` last |

## Prices are drawn, not written

A reader must see what we charge against what buyers pay today without reading a paragraph. Wherever a section compares prices (competitors, fatal questions, pricing context, a feature's cost):

1. Open with a short answer `table`: `Offer | They pay today | We charge now | We suggest`, one row per offer. Highlight the offer the run is about.
2. Then one `bars` chart per offer, on a unit the buyer thinks in: "a year for a 5-recruiter agency", "one person a month", "a year for a company that makes 6 hires". Work the competitor totals out (price x users x 12) so every bar is the same unit.
3. Any remaining questions go in a `table` of `Question | Short answer | What it means for us`, not in paragraphs.
4. Links move to `sources`; a `note` under the chart names which figures are third-party or estimates.

Keep table cells short, about 30 characters. The renderer turns a table whose cells run past 60 to 90 characters into stacked prose entries, which is the wall of words this rule exists to stop.


## Icons

Header icon names by sub-command (used when `NW_ICONS_DIR` holds icons by these names):

| Sub-command | Icon |
|---|---|
| validate | `insight-bulb` |
| feature | `skill-puzzle` |
| brief | `doc-stack` |
| competitors | `radar` |
| personas | `people-search` |
| interviews | `interview` |
| mvp | `goal-target` |
| pricing | `discount-tag` |
| plan | `launch-rocket` |
| metrics | `metrics-bars` |
| fundraise | `investor` |
| deck | `screencast` |

Point `NW_ICONS_DIR` at a folder of SVG icons whose groups carry the ids `face`, `shade`, `accent` and `ink`; the renderer paints them in black and white. Section icons can be any file name in that folder. Without the variable, or for a name that does not exist, the renderer draws a plain glyph instead.
