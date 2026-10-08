# Phase 1 recipe — strategy extraction + interview

Goal: fill `templates/STRATEGY.template.md` with maximum repo extraction and minimum user questioning.

## 1. Extract from the repo (before asking anything)

| Field | Where to look |
|---|---|
| Product definition | CLAUDE.md, landing `page.tsx` hero copy, root layout metadata description, README |
| Domain / metadataBase | root `layout.tsx` `metadataBase`, `lib/site.*`, robots/sitemap files |
| Language | `<html lang>`, i18n config, locale files |
| Audience hints | pricing/features/about page copy, persona-flavored sections |
| Existing content topics | blog/community posts, help pages — feeds dedupe later |
| Copy rules | CLAUDE.md (e.g. "no AI in user-facing copy", banned words, tone notes) |
| Author identity | about/team pages, package.json author, git log names |

## 2. Ask the user only the gaps

Usually just these (use AskUserQuestion, one round):

1. **Competitors** — 2–5 names/domains (offer any found in repo copy as defaults).
2. **Priority persona** — which audience segment matters most commercially right now.
3. **Commercial goal** — signups, waitlist, installs, leads? (Shapes intent mix in the calendar.)

Skip any question the repo already answers. Never ask about brand voice — it is learned, not asked.

## 3. Brand-voice distillation

Read 3–5 real marketing pages (hero, features, about — the best-written copy). Produce:

- 3–5 tone rules observed (sentence length, person, formality, humor, hype level).
- Vocabulary the brand actually uses; banned words (from CLAUDE.md rules + observed absence).
- 3 sample sentences copied **verbatim** — these anchor writer agents better than adjectives.

## 4. Niche & content gaps

WebSearch each competitor's blog/site (`site:<competitor> blog`, brand + category terms). Note: topics they own, topics with weak/outdated answers, angles this brand is uniquely credible on. 4–8 bullet points — this seeds Phase 2 clustering.

## 5. Write the file

Fill every section of the template. If `_seo/STRATEGY.md` exists, print a summary of what would change and update in place with consent. Convert relative dates to absolute.
