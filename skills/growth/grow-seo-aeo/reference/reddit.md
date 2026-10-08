# Phase 6 recipe — Reddit visibility engine

Reddit threads are disproportionately cited by AI engines, which makes helpful participation double-value (human readers + LLM corpus). This skill never posts. It surfaces threads for a human to answer.

## Mining (WebSearch, per cluster)

Query patterns:

- `site:reddit.com "<primary keyword>" recommend`
- `site:reddit.com "<primary keyword>" alternative`
- `site:reddit.com "how do I <job-to-be-done>"`
- `site:reddit.com <competitor> vs`

Prefer threads <12 months old (check dates in results); note the subreddit and the actual question being asked. 3–6 threads per cluster is plenty — quality over volume.

## Output

Fill `templates/REDDIT-OPPORTUNITIES.template.md`. The **Suggested angle** column is the useful part: one sentence on what a genuinely helpful answer looks like for that thread (which article or feature answers it, what to disclose). Etiquette rules stay in the file header: helpful answer first, disclose affiliation, link only when the link answers the question.

Re-runs append new threads (dedupe by URL) and leave user-updated Status values alone.
