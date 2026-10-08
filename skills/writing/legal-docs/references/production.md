# Producing the document set

Read this before writing documents. The reference implementation is
`x-unframed` — `docs/legal/`, `scripts/legal/`, `apps/web/src/{app/legal,lib/legal,components/sections/legal}`.

Everything in § "Failures already paid for" was found by adversarial review **after** the
work was reported complete, with a green test suite. Assume the same failures are waiting in
the next project.

---

## The shape

```
docs/legal/
  FACTS.md                 source of truth — derived from code, never from memory
  OPEN-QUESTIONS.md        what counsel has not answered. Never published
  README.md                how to work on these
  contracts/               MSA · SLA · AUP · refund policy
  data-protection/         DPA + annexes · sub-processor list · DSR procedure
  trust/                   security overview · residency · model card · accessibility
  <data-subject>-privacy-notice.md
  .build-hashes.json       tracked — drift detection + skip-unchanged
  .pdf-preview/            gitignored — draft PDFs, never served
```

`FACTS.md` needs a **§ "Never assert"** listing every claim the business cannot evidence:
certifications not held, audits not commissioned, insurance not bought, residency not built.
Drafting agents read it as a prohibition list. It is the cheapest defence against the single
most common failure — a confident sentence nobody can back.

## The gate

Draft state is **derived from the document's own banner**, never from a config list that can
drift out of step with the text:

```js
export function isDraft(markdown) { return /^ {0,3}>\s*\*\*Draft for/m.test(markdown); }
```

`{0,3}` is load-bearing, not defensive: **Markdown allows a blockquote to be indented up to
three spaces and renders it identically.** The naive `/^>/` anchor misses an indented banner,
so a document that looks correctly marked as a draft to a human reviewer is invisible to the
gate and publishes. Four or more spaces is a code block and correctly does not count.

Test for **false negatives** specifically, and enumerate the indents. A false positive only
hides a document; a false negative publishes an unreviewed contract.

Three rules the gate must satisfy:

1. **Drafts produce no public asset.** Not an unlinked one — none. Published PDFs go to the
   served directory; draft PDFs go to a gitignored preview directory outside it. A page-level
   "don't render drafts" check is worthless while the PDF sits at a guessable URL.
2. **The manifest is the exposure surface, not the PDF.** If the page renders
   `doc.markdown` from a generated manifest, that manifest *is* the document. Verify it
   against source — see the drift check below.
3. **Publication is removing the banner**, done by a human after counsel signs off. It is
   not a code change, not a flag flip, not a deploy.

## Drift checks that actually hold

Two, and neither is optional:

**Manifest ↔ source.** Rebuild the manifest from the source documents in memory and compare
byte for byte. Render it through *one* function used by both the builder and the checker — a
checker that constructs the string differently is checking the wrong thing. Report the
dangerous cases by name: `A draft is recorded as published: <slugs>`.

**No drafting markers in published copy.** A `[CONFIRM: …]` marker inside a gated draft is a
note to counsel. The same marker in a locale catalog is live text in the signup agreement.
Scan the published copy paths and fail with `file:line`.

**No published document with unresolved markers.** Different check, and the one everybody
misses. Publishing is done by *deleting a banner* and changing nothing else, so a document
still carrying 86 open `[CONFIRM]` notes publishes exactly as easily as a finished one. It
fires on the day counsel signs off — the day nobody is expecting a new failure. Fail the
check when a non-draft document has `openItems > 0`, and say "resolve them, or put the
banner back". Found by attacking the publish path, not by reading the code.

## Page integration

- **Reuse the project's existing page shell.** Open a sibling content page, copy its layout,
  container widths, nav and footer. Legal pages get screenshotted into procurement decks;
  a bespoke style reads as bolted on.
- **One hub, many consumers.** Products link to a single `/legal` hub rather than each
  embedding its own list. One URL to keep in sync, and the hub becomes the registry.
- **Do not put a link registry in a shared UI package** without checking its build. A tsup
  config that stamps `"use client"` on every module will break server-side metadata in every
  consumer.
- **Index the policies that already exist** alongside the new ones. A hub that lists only the
  new markdown documents, omitting the translated terms and privacy policy already live,
  reads as an incomplete list.
- Drafts: excluded from the index, the sitemap and any static-params function, and carrying
  `noindex`.

## Failures already paid for

| # | What happened | The lesson |
|---|---|---|
| 1 | Every draft PDF was publicly served. The page hid drafts; the PDFs sat in `public/` with no auth and no robots rule. `/legal/master-services-agreement.pdf` returned the full unreviewed contract | Gate structurally. A presentational gate is not a gate |
| 2 | Nothing compared the generated manifest to source. Two edited fields put 51,877 characters of unreviewed contract on a public route while the hash check, the document tests and the page tests all passed | The manifest is the document. Verify it |
| 3 | Four `[CONFIRM: …]` drafting notes shipped live in the Terms and Privacy Policy in seven languages — one inside the governing-law clause accepted at signup | Markers are safe only inside the gate |
| 4 | Marketing copy promised in-Kingdom data residency while the residency registry said Frankfurt, "preview" — contradicting a clause in the MSA shipped the same day | Claims must match a machine-readable source of truth, and that source must be named in a comment beside the copy |
| 5 | `README.md` was rendered to a public `/legal/README.pdf` — the walker excluded only `FACTS.md` | Keep an explicit not-a-document list, and skip dotfiles |
| 6 | The PDF cache keyed on document content only, so editing the print stylesheet left every PDF "unchanged" forever | Fold a template version into the cache key |
| 7 | The retracted certification claim survived in the tracked parity baselines and archives after the live copy was fixed | Fix every copy of the claim, including snapshots and restore sources |
| 8 | The build broke *because* the gate worked: Next 16 Cache Components requires `generateStaticParams` to return ≥1 result, and all documents were drafts | Never satisfy a build by prerendering a draft. Drop the prerender |

Also: **CI often does not run `build`.** If it runs lint, typecheck and test only, a build
failure surfaces at deploy. Check before assuming green CI means shippable.

## When the product does something the documents disclaim

Common and important. The audit finds a shipped control — automatic rejection on a score,
a required applicant photo, silent profiling — that a drafted document says does not happen.

**Removing the feature is the owner's decision, not yours.** Present the choice plainly and
implement whichever they pick. If they keep it:

1. **Fix every document that now reads false.** Search for the claim, not the feature name;
   it is usually asserted in three or four places and in the data-subject notice most of all.
2. **State who decides.** In a B2B product the customer is normally the controller and the
   vendor the processor. The vendor supplies the control; the customer switches it on and
   carries the duty. Say exactly that.
3. **Reconcile the contract with the product.** An acceptable-use policy that forbids the
   customer from doing what the product ships a control for is a live contradiction — the
   vendor is selling a feature its own contract bans.
4. **Surface the duties in-product at the moment of enabling**, not in a policy nobody opens.
   Name the jurisdictions and what each requires.
5. **Tell the data subject.** A notice saying "this never happens" when it can is the
   sentence a regulator reads first.

## Deliverables

| Output | Where | Notes |
|---|---|---|
| Document set | `docs/legal/**` | Markdown, one document per file, all drafts |
| Built PDFs | project's served public directory | Published only |
| Manifest | generated TS/JSON | Verified against source on every check |
| `/legal` hub + reader | project's existing layout | Drafts gated out |
| Coverage report | `_legal/LEGAL-COVERAGE.md` | From Steps 1–5 |
| Trust deck | via `/deck` | Verifiable subset only |
