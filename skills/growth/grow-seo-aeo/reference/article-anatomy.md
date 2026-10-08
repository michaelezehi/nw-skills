# Article spec + writer-agent brief

## Article anatomy (what every article must contain)

1. **Frontmatter** per `templates/article.template.mdx` — title ≤60 chars with primary keyword; description ≤160 chars, answer-flavored; 3–5 FAQ pairs; 2–4 sources.
2. **Answer-first intro**: the first paragraph (~50 words) directly and completely answers the primary query. No throat-clearing ("In today's fast-paced world…" is an automatic rewrite). This is the passage AI engines extract.
3. **Length** 900–1,400 words. **Headings**: H2 → H3 only; no H1 in the body (the page template renders the title).
4. **One comparison table or ordered list** where the topic supports it — tables are disproportionately cited by AI engines.
5. **Citations**: 2–4 external sources, cited inline where the claim appears. A URL goes in `sources` only if this agent retrieved it via WebSearch/WebFetch in this session and it supports the claim. No stats without a cited source. No invented quotes.
6. **Internal links**: 2–4, chosen from the LINKMAP provided in the brief (may include batch siblings). Natural anchor text, not "click here".
7. **FAQ**: 3–5 genuine questions (People-Also-Ask phrasing from the calendar research), each answered in 2–3 self-contained sentences. They live in frontmatter only — the page template renders them and builds FAQPage JSON-LD.
8. **Voice**: follow the brand-voice block verbatim rules. Respect banned words (including "AI" in user-facing copy where the repo rules say so).
9. **No YouTube embed unless** a real, relevant video URL was found and verified this session. No images unless a real asset path exists (`image` frontmatter optional).

## Writer-agent brief format (main agent composes one per article)

Each subagent brief is fully self-contained — the agent must not need to read `_seo/` files or this skill:

```
Write one MDX article. Output: write exactly one file at <content-dir>/<slug>.mdx and nothing else.
Do not edit any other file. Return the word count and the list of internal links you used.

CALENDAR ROW: <title | slug | primary kw | secondary kws | cluster | intent>

BRAND VOICE (follow exactly):
<the entire Brand voice block from STRATEGY.md>

AUTHOR: <name, role — for frontmatter>
SITE: <domain> · LANGUAGE: <lang>

FRONTMATTER SCHEMA + BODY RULES:
<paste of templates/article.template.mdx>
<paste of the "Article anatomy" section above>

RESEARCH: Use WebSearch to research the topic and find 2–4 citable sources. Only cite URLs
you actually retrieved. If you cannot verify a claim, cut the claim.

INTERNAL LINK MAP (choose 2–4):
<LINKMAP.md contents + batch siblings: slug — title — one-line description>
```

Agents return summaries; the main agent then verifies each file (word count, heading structure, frontmatter parses, internal links resolve, spot-WebFetch one source per article) and only then flips the calendar row to `drafted`.
