# Phase 2 recipe — keyword research, clustering, 30-topic calendar

No search-volume API exists locally. **Never print volume numbers.** Priority is qualitative — High/Med/Low from SERP weakness × relevance × intent — and the calendar header must say so.

## 1. Seed queries (from STRATEGY.md)

Compose ~15–20 seeds from three axes:

- Product terms: category names, feature names, "what is <category>".
- Persona questions: the literal questions listed per persona.
- Competitor terms: "<competitor> alternative", "<competitor> vs", "best <category>".

## 2. SERP harvest (WebSearch)

For each seed, WebSearch and record: top result titles (what currently wins), People-Also-Ask-style question phrasings, competitor blog topics that appear. Expand to **60–80 candidate queries**. Run seeds in parallel subagents if the batch is large; harvest output is a flat candidate list with source notes.

## 3. Cluster (4–6 clusters)

Group candidates that share a head noun, intent, or overlapping SERP results. Each cluster gets:

- A **pillar** topic (broad, definitional, links to all supporting posts).
- 4–7 **supporting** topics (specific questions, comparisons, how-tos).

This is the topical-authority structure — an AI engine citing one article should find the cluster's siblings one hop away.

## 4. Select 30

- Dedupe against existing routes, existing articles, and prior calendars (check old `_seo/CONTENT-CALENDAR*.md`).
- Mix intent: roughly 60% informational, 25% commercial-investigation (comparisons, alternatives), 15% transactional-adjacent. Skew by the commercial goal in STRATEGY.md.
- Order rows so early batches **complete whole clusters** (pillar first, then its supports) — internal-link density beats topic scattering.
- Slugs: kebab-case, ≤6 words, contain the primary keyword.

## 5. Write the calendar

Fill `templates/CONTENT-CALENDAR.template.md`: clusters table, then 30 rows, all `planned`, `File` and `Date` empty. Only the main agent ever edits this file.

## Monthly refresh

When all 30 rows are resolved, a new run generates next month's calendar in the same file under a new `## Calendar — <month>` heading (history preserved), deduping against everything above it.
