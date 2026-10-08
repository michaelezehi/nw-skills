# Phase 5 recipe — AI visibility tracking (honest version)

BabyLoveGrowth queries AI engines server-side. Locally we cannot read ChatGPT/Perplexity/Gemini answers. What we CAN measure is the **web citation footprint**: whether the brand appears in the search corpus AI engines retrieve from. Every output must carry that framing — never claim an AI-answer measurement that didn't happen.

## First run — build the prompt library

15–25 prompts a real buyer would ask an assistant, derived from calendar clusters + STRATEGY.md persona questions:

- "best <category> for <audience>"
- "<competitor> alternatives"
- "how do I <job-to-be-done>"
- "is <brand> good for <use case>" (brand-aware prompts too)

Write them into section 1 of `templates/AI-VISIBILITY.template.md`. On later runs, reuse the existing library (the user may have added rows).

## Every run — snapshot

1. WebSearch each prompt; record whether the brand/domain appears in results, and where.
2. Brand-mention sweeps: `"<brand>"`, `"<brand>" review`, `"<brand>" site:reddit.com`.
3. Append one dated block to section 2 (append-only — history is the trend line). Label: `method: WebSearch proxy`.
4. Summarize movement vs the previous snapshot in the run output (new appearances, losses).

Parallel subagents are fine for the searches; only the main agent writes the file.

## Manual protocol (offer, never fill)

Point the user at section 3: copy each prompt into ChatGPT/Perplexity/Gemini/Claude and record mentions by hand. Browser automation of chat UIs: only if the user explicitly asks — flaky and ToS-gray; say so.
