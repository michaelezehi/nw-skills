# Data models — the three archetypes

Plain-JS shapes (the page embeds them as a `DATA` object in an inline
`<script>`). Field names are inherited from the proven founder-x pages — keep
them so future pages stay mutually legible.

## Shared

```js
// rnd/index.html — one per artifact
ENTRIES = [{ href, title, summary, status /* live|in-progress|planned */, updated }]
```

## Consensus

```js
PEOPLE = [{ id, codename, role }]            // participants; drives the identity gate
GROUPS = [{ id, label }]                      // page clusters for the nav

PAGES = [{
  id, group, area, title,
  priority,                                   // 'must' | 'should' | 'nice' | 'new'
  sources: [personId],                        // who raised it
  current: { lead?, points: [] },             // what it is today
  planned: { lead?, points: [] },             // what we agreed to change
  quote?: { who, text },                      // verbatim participant quote
  architect: ''                               // the technical note
}]

DOCS = [{ id, title, short, source,           // the uploaded brief, sectioned
  sections: [{ id, heading, level?, body: [] }] }]
PAGE_REFS = { [pageId]: [{ doc, section, label }] }  // page → brief cross-refs

ALIGNED = [{ title, body }]                   // points pre-agreed before voting
JOURNEY = [{ s, h, p }]                       // optional stage strip
```

### Shared state (Convex — see consensus.md for wiring)

```js
// returned by rnd_spec:get { doc: DOC_ID }
{ votes:    [{ pageId, person, status /* approve|decline|comment|null */, note, updatedAt }],
  comments: [{ id, pageId, author, text, ts }],
  agreements: [{ id, pageId, version, status /* draft|accepted */, agreed, disagreed,
                 proposalMarkdown, summary, headline?, planned?, openQuestions?,
                 generatedBy, model, createdAt, acceptedAt, acceptedBy }] }
```

## Product

```js
EXEC_SUMMARY = ''                             // one paragraph for the intro

SCREENS = [{
  id,                                         // matches a consensus PAGES id when one exists
  n, name,
  term?,                                      // the proper technical term behind the friendly name
  intent,                                     // one line: what the screen is for
  context,                                    // short paragraph: today + what changes, plain language
  build: [],                                  // the agreed scope
  rec,                                        // the technical call — the premise we build on
  open?                                       // the question this call resolves
}]
```

## Demo (one page per theme, side menu)

```js
INDEX_HREF = '../../index.html'               // back to the rnd index
ALL_THEMES = [{ id, name, href }]             // every theme page, in order (side menu + edge arrows)
CUR = {
  id, name,
  prd: '',                                    // source PRD path(s), shown under the panel
  scenes: [{
    id,                                       // unique; also the deep-link hash
    title,                                    // what this moment is
    caption,                                  // one or two plain lines
    detail: [],                               // 3-5 bullets from the PRD (tasks, acceptance) — the read-more layer
    svg: ''                                   // rich app-shell mockup (Sketches output)
  }]
}
// deck-linked demos additionally keep, on the DECK side:
FLOWS_WITH_DEMO = new Set([...themeIds])      // gates deck → demo links
```

## Convex tables (consensus only — verbatim from founder-x `schema.ts`)

```ts
spec_votes: defineTable({
  doc: v.string(), page_id: v.string(), person: v.string(),
  status: v.optional(v.union(v.literal('approve'), v.literal('decline'), v.literal('comment'))),
  note: v.optional(v.string()), updated_at: v.number(),
}).index('by_doc', ['doc']).index('by_doc_page_person', ['doc', 'page_id', 'person']),

spec_comments: defineTable({
  doc: v.string(), page_id: v.string(), author: v.string(),
  text: v.string(), created_at: v.number(),
}).index('by_doc', ['doc']),

// optional — only when the sign-off → generated-agreement loop is wanted
spec_agreements: defineTable({
  doc: v.string(), page_id: v.string(), version: v.number(),
  status: v.union(v.literal('draft'), v.literal('accepted')),
  agreed: v.array(v.object({ point: v.string(), detail: v.optional(v.string()) })),
  disagreed: v.array(v.object({
    point: v.string(), who: v.optional(v.string()),
    reference: v.optional(v.object({ doc: v.optional(v.string()),
      section: v.optional(v.string()), quote: v.optional(v.string()) })),
    why: v.string(),
  })),
  proposal_markdown: v.string(), summary: v.optional(v.string()),
  headline: v.optional(v.string()), planned: v.optional(v.array(v.string())),
  open_questions: v.optional(v.array(v.string())),
  generated_by: v.string(), model: v.optional(v.string()),
  created_at: v.number(), accepted_at: v.optional(v.number()),
  accepted_by: v.optional(v.string()),
}).index('by_doc', ['doc']),
```
