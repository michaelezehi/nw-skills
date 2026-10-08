# Phase 3 recipe — Optics Link Network

Contextual outbound links from an opt-in, credit-balanced exchange network on Optics. Conservative by design — exchanges are named in Google's link-spam policy.

## When to run

Only when **both** are true:

1. `<app-root>/_seo/OPTIC.md` exists (site URL, project slug, `sk_` key via env — never commit the key).
2. The project has **network opt-in** on in the Optics Growth hub **Links** tab.

Otherwise skip entirely — no API calls, no brief assignments, no fabricated placements.

## Assignment (after batch rows are selected, before fan-out)

Per article, `POST {opticsConvexSiteUrl}/link-network/assignments`:

```
Authorization: Bearer sk_…
Body: { "articleSlug": "<slug>", "topic": "<title or topic>", "cluster": "<calendar cluster>" }
```

Response (0–2 items):

```json
[{ "placementId": "…", "targetUrl": "…", "suggestedAnchor": "…" }]
```

Empty array when kill switch is off, opt-out, or no relevant match. Fetch once per batch article; pass each article's assignments into its writer brief.

## Placement rules (writer briefs)

- **Max 2** network links per article.
- **Contextual in-body** — inside a relevant paragraph, not link lists, footers, author boxes, or sidebars.
- **Anchor:** use `suggestedAnchor` or a close natural variant in context. Never invented promo or keyword-stuffed anchors.
- **Skip, don't force:** no natural fit → omit the link; note `skipped` in the batch summary.

## Report placements (after verification)

When each article passes verification (word count, links, citations), for every embedded network link:

```
POST {opticsConvexSiteUrl}/link-network/placements
Authorization: Bearer sk_…
Body: { "placementId": "<id>", "articleUrl": "<full URL or path>" }
```

One request per embedded link. Skipped assignments need no call. Optics verifies dofollow + live `href` on a daily crawl before the placement counts.

## Honesty

- Never fabricate placements or claim network links that were not written into the article.
- API unreachable or empty assignments → write the article **without** network links and say so in the batch summary.
- Manual outreach (`BACKLINK-OUTREACH.md`) complements this channel; both coexist.

## Server-side rails (for context)

Relevance-matched categories; ring topology (no direct A↔B reciprocal within 90 days); ≤2 links/article; network links ≤30% of outbound article links; per-project opt-out; global kill switch (`LINK_NETWORK_ENABLED`).
