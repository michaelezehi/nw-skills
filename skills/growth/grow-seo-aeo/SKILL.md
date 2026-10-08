---
name: grow-seo-aeo
description: Local SEO+AEO growth engine (BabyLoveGrowth.ai replica) — audits via the geo skill, builds a keyword-clustered 30-day content calendar, scaffolds or adapts an in-repo blog, writes batches of GEO-optimized articles (answer-first, FAQ + JSON-LD, verified citations, internal links), a backlink outreach list, AI-visibility tracking, and Reddit opportunities (llms.txt available opt-in). Run inside any project.
argument-hint: [setup | calendar | write N | outreach | track | reddit | dashboard | status | all]
disable-model-invocation: true
---

Replicate BabyLoveGrowth.ai locally: grow the current project's organic and AI-search traffic through a repeatable, git-tracked pipeline. Base directory of this skill = `$SKILL_DIR` below. All per-project state lives in `<app-root>/_seo/` (committed, hand-editable).

## Hard rules (apply to every phase)

1. **Never fabricate.** External citations only from URLs actually retrieved via WebSearch/WebFetch in this session. No invented statistics, quotes, or search-volume numbers (no volume API exists — use qualitative High/Med/Low priority and say so).
2. **Never overwrite existing files.** Adapt to what exists; confirm any scaffold file plan with the user before writing; prefer editing over creating.
3. **Don't duplicate the `geo` skill.** Phase 1 invokes it via the Skill tool, and geo's guidance wins on technical GEO calls (crawlers, schema, llms.txt). This skill owns only what geo lacks: everything downstream of the audit (calendar, articles, outreach, tracking, Reddit).
4. **Respect the target repo's CLAUDE.md** — copy rules (e.g. never "AI" in user-facing copy), file-size limits, conventions.
5. **Writer subagents never write shared state.** One agent = one article file. Only you (main agent) edit `CONTENT-CALENDAR.md` and `LINKMAP.md`.
6. **Honest tracking.** Automated visibility checks measure web citation footprint (a proxy), never actual AI answers. Never simulate manual checks.
7. **No auto-posting** to Reddit or anywhere else.

## Phase 0 — Detect (always run first, read-only)

1. Read root `package.json`, `CLAUDE.md`, lockfiles (bun.lock → `bun`, pnpm-lock → `pnpm`, else npm).
2. Classify stack: Next.js App Router (`app/`) / Next Pages / Astro / Vite SPA / no web surface.
3. **Monorepo:** if `workspaces` exist, Glob each package for `next.config.*` + `app/` and classify each as public site vs internal (admin/dashboard names, auth-gated). If >1 public site, ask the user which app to target. Each app gets its own `_seo/`.
4. Find existing `_seo/` dirs (Glob `**/_seo/STRATEGY.md`, exclude node_modules) and existing content systems (see Phase 3 step 1).
5. Print the **status dashboard**:

```
📈 grow-seo-aeo — status
━━━━━━━━━━━━━━━━━━━━━━━
Target app:      <path> (<package name>)
Stack:           <classification>
Strategy:        <_seo/STRATEGY.md date | none>
Calendar:        <X planned / Y drafted / Z published of 30 | none>
Blog surface:    <detected system | scaffold needed | drafts-only>
Last track:      <date | never>
Next suggested:  /grow-seo-aeo <command>
```

## Dispatch

| Argument | Run |
|---|---|
| `status` | Phase 0 only. Write nothing. |
| `setup` | Phases 0–1 |
| `calendar` | Phase 2 |
| `write [N]` | Phase 3 (N default 5, hard cap 10) |
| `outreach` | Phase 4 |
| `track` | Phase 5 |
| `reddit` | Phase 6 |
| `dashboard` | Phase 7 (build/adapt the admin growth dashboard) |
| `autopilot` | Phase 8 (backend-scheduled staggered publishing; `write N --autopilot` stages batches into it) |
| `all` | Run the whole pipeline to completion under the **`own-goal`** skill (see below). 0→1→2→3(write 5)→4→5→6→7. Phase 8 runs when the user opts into autopilot. |
| *(bare)* | State machine below |

**`all` runs under `own-goal`.** When the argument is `all` (or the user asks to "build all the phases", "run the whole pipeline", "till done", or otherwise wants autonomous end-to-end execution), invoke the **`own-goal`** skill and let it drive: it locks the completion condition (every phase's output file exists and passes its checks), keeps an `ACCOUNTABILITY.md`, runs the gap loop, and does a fresh-eyes supervisor pass. Do not stop between phases to ask permission in this mode — the `own-goal` contract is no questions after Step 1. (The per-argument invocations above stay interactive and confirm scaffolds with the user as normal.)

**Review gate uses `/reviewer`.** Whenever a run writes or changes code (Phase 1 technical files, and especially Phase 3 article/scaffold code), the review gate is **`/reviewer`** — the standard reviewer — run it on the produced changes and fix everything it raises before closing out. Under `own-goal`, this is the same gate as its Step 6, so nothing is overridden. Pure-markdown-only runs (calendar/outreach/track/reddit with no code touched) may skip it.

**Bare invocation:** print status, then run the next sensible phase: no `STRATEGY.md` → `setup` (then offer calendar); strategy but no calendar → `calendar`; calendar has `planned` rows → `write 5`; all 30 resolved → offer a new month's calendar, a `track` refresh (if last snapshot >14 days old), or `outreach`.

Phases assume prior phases' state exists; if missing, run the missing phase first (tell the user).

## Phase 1 — setup

1. **Invoke the geo skill** (Skill tool, skill: `geo`, args: `all` — or `audit` if the user wants review-before-fix). Do not re-implement any of its 8 categories.
2. **llms.txt — opt-in only, default skip.** Per geo's current guidance, no major engine consumes llms.txt (~97% of published files get zero AI-bot requests), so do not create one by default. Only if the user explicitly asks, or the target is a developer-docs site: read `$SKILL_DIR/reference/llms-txt.md` and create `app/llms.txt/route.ts` (per-article routes then come with the Phase 3 scaffold). If one already exists, keep it maintained rather than deleting.
3. **Strategy:** read `$SKILL_DIR/reference/strategy-interview.md`. Extract everything possible from the repo first; ask the user only the gaps (competitors, priority persona, commercial goal). Distill brand voice from 3–5 real marketing pages — verbatim sample sentences, not invented ones.
4. Write `_seo/STRATEGY.md` from `$SKILL_DIR/templates/STRATEGY.template.md`. If it already exists, show a diff-style summary and update in place with consent.

## Phase 2 — calendar

Read `$SKILL_DIR/reference/keyword-calendar.md`, then:

1. Seed queries from STRATEGY.md (product terms × persona questions × competitor terms).
2. WebSearch each seed; harvest SERP titles, People-Also-Ask phrasings, competitor blog topics → ~60–80 candidates.
3. Cluster into 4–6 topical-authority clusters (pillar + supporting topics).
4. Select 30; dedupe against existing routes/articles and any prior calendar; order so early batches complete whole clusters (maximizes internal-link density).
5. Write `_seo/CONTENT-CALENDAR.md` from the template, all rows `planned`.

## Phase 3 — write N

Read `$SKILL_DIR/reference/blog-scaffold.md` and `$SKILL_DIR/reference/article-anatomy.md`, then:

1. **Publishing surface.** Detect an existing content system first (Glob `app/blog/**`, `content/**`, `posts/**`; Grep `lib/` for post registries — e.g. a `lib/posts.ts` feeding a `[slug]` route). **Adapt to it if found.** Otherwise scaffold per the reference (Next App Router: MDX + gray-matter + next-mdx-remote/rsc; sitemap wiring, Article/FAQPage/BreadcrumbList JSON-LD via geo's `JsonLd` component; per-article llms.txt routes only when the llms.txt opt-in is active). Present the file plan and get consent before scaffolding. Non-Next fallbacks are in the reference; a project with no web surface gets drafts-only mode (`_seo/drafts/`) — never scaffold a new app without explicit consent.
2. **Reconcile calendar vs filesystem:** article file deleted → row back to `planned`; hand-added article → append row as `drafted`.
3. **Rebuild `_seo/LINKMAP.md`** from the filesystem: every public route + every existing article, each with URL, title, one-line description, target keyword. Regenerated every run; never hand-edited.
4. **Select** the first N `planned` rows, preferring rows that share a cluster.
5. **Network links:** when `_seo/OPTIC.md` exists and network opt-in is on, read `$SKILL_DIR/reference/link-network.md`, fetch assignments for the batch, pass each assignment into the relevant writer brief, and report placements for verified articles at the end of the batch.
6. **Fan out writer subagents in parallel**, one per article. Each brief is self-contained per the anatomy reference: brand-voice block, its calendar row, the full LINKMAP plus batch siblings' slugs/titles, the article spec, its single output path. Each agent writes exactly one file.
7. **Verify each article:** word count 900–1,400, no H1 in body, valid frontmatter, all internal links resolve against LINKMAP + batch, WebFetch one cited source to spot-check it supports the claim. Fix or regenerate failures.
8. Flip completed rows to `drafted` with file path + date. Run the app's typecheck if the scaffold changed code. Print a batch summary + preview command.

## Phase 4 — outreach

Read `$SKILL_DIR/reference/outreach.md`. WebSearch niche-relevant targets (resource pages, guest-post blogs, directories, newsletters, competitor-listicle authors). Write `_seo/BACKLINK-OUTREACH.md` from the template with ≥15 researched targets and 3 brand-voice pitch templates. State plainly in the file: manual editorial outreach complements the Optics Link Network (automated relevance-matched exchanges, verified placements); no link buying or bulk schemes.

## Phase 5 — track

Read `$SKILL_DIR/reference/ai-visibility.md`. First run: build the 15–25 buyer-prompt library from clusters + persona questions. Every run: WebSearch each prompt and the brand-mention sweeps, append a dated snapshot to `_seo/AI-VISIBILITY.md` labeled as web-citation-footprint proxy. Offer (never fill) the manual ChatGPT/Perplexity/Gemini checklist.

## Phase 6 — reddit

Read `$SKILL_DIR/reference/reddit.md`. Per cluster: `site:reddit.com` searches for recommendation/alternative/how-do-I threads, prefer <12 months old. Write `_seo/REDDIT-OPPORTUNITIES.md` from the template with suggested helpful-answer angles.

## Phase 7 — dashboard (admin growth view)

Build (or adapt) a **modern admin growth dashboard** inside the target app that fuses the site's existing product-analytics platform (GA4 first — detect `gtag.js`/`G-XXXX` measurement id; else Plausible/Umami/PostHog) with the SEO/AEO pipeline this skill produces. Goal: one beautiful place to watch organic + answer-engine growth.

1. **Detect** the analytics platform and the app's existing admin surface (auth-gated route group, e.g. `app/(admin)`, an `AdminGate`, a design system / chart lib already in use). **Reuse them** — match the existing admin's components (KPI cards, chart theme, glass cards), never introduce a second chart library or a second admin shell. If no admin surface exists, ask before scaffolding one.
2. **Server-side data only for secrets.** Query the GA4 Data API (`properties/{propertyId}:runReport` via a service-account JWT from `google-auth-library`) from a server component or route handler using server-only env vars (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GA4_PROPERTY_ID`). Never expose credentials to the client. Add the env vars as empty placeholders to the committed `.env`/`.env.example` with a comment that they are server-only secrets (real values go in the gitignored server env).
3. **Fuse two data sources:** (a) traffic — visitors + pageviews over time, top content pages (join analytics `pathname` to the article registry titles), and referrer/channel mix; (b) pipeline — pieces shipped (from the content registry), publish cadence, and the latest answer-engine footprint snapshot from `_seo/AI-VISIBILITY.md`.
4. **Graceful states:** when the analytics env vars are absent, render a clean "connect analytics" setup card (which env vars to set) and still show the pipeline stats that come from the repo. On query error, show an honest error state, never fabricated zeros.
5. **Honor copy rules:** never the word "AI" in the UI where the repo bans it — label it "answer engines" / "generative search". Follow the repo's i18n convention for anything shell-level (e.g. a nav label added across every locale so the strict i18n check stays green); internal-only dashboard body copy may stay in the repo's base language if full localization is disproportionate.
6. **Verify:** run the app's typecheck (and i18n check if present), then the `/reviewer` gate on the new code.

State of record is the app's own admin route; this phase writes app code, not `_seo/` markdown.

## Phase 8 — autopilot (backend-scheduled staggered publishing)

Turn the pipeline into a self-publishing system: stage a batch of articles in the project's backend and let backend jobs flip them live on a cadence — no manual publishing. Reference implementation + verified research: the target repo's `_seo/AUTOPILOT-ARCHITECTURE.md` (write one for new projects from the same findings).

1. **Cadence at setup.** Ask once, and support **two modes**: (a) *weekday* — posts per week (default 3) + publish days + publish hour (UTC); (b) *fixed interval* — "every N days" at a set hour (e.g. `intervalDays: 2`). Store in the backend (e.g. a `seoSettings` singleton, interval field optional/nullable), editable from the admin dashboard. A weekday model **cannot** express a true "every N days" drip (7 isn't divisible by most intervals), so when the user asks for "every 2 days" you need the interval mode — don't approximate it with weekdays.
2. **Staged content table** (Convex reference: `seoArticles`): full article JSON + `status: draft → scheduled → published (| retired)`, `publishAt` (epoch-ms UTC), the scheduler job id. Indexes on status, slug, and `(status, publishAt)`.
3. **Scheduling (Convex specifics, adapt elsewhere):** per-article `ctx.scheduler.runAt(publishAt)` — durable, cancellable; static crons can't encode runtime cadences. Slot generation branches on the cadence mode: weekday-match vs a fixed-interval walk (`cursor += intervalDays * DAY_MS` from the next publish-hour mark strictly after the last scheduled slot, so consecutive `stageBatch` calls chain instead of overlapping). The publish flip is an **internal mutation** (exactly-once, transactional, status-guarded); have it **stamp the article's display date (`publishedAt`) to the real go-live day** so sitemap lastmod and `Article.datePublished` are accurate rather than showing a stale draft placeholder. Side effects (revalidation webhook) are an **action scheduled from that mutation**, retried with backoff. Add a daily **sweep cron** that publishes everything `publishAt <= now AND status == scheduled` (catch-up; never "due this tick" — overlapping cron runs are skipped, not queued).
4. **Rendering without rebuilds:** keep article pages ISR + `dynamicParams` with a hybrid registry (compiled/in-repo content ∪ backend-published), `fetchQuery`-style server reads (never `preloadQuery` — it forces per-request dynamic). Publish webhook route (shared-secret header) calls `revalidatePath` for the article, index, sitemap, and llms.txt, then a warming fetch (invalidation is lazy). **Trap:** `sitemap.ts`/static route handlers are cached by default — give them `revalidate` exports or their lastmod freezes.
5. **`write N --autopilot`:** writer agents produce the same article JSON, but it is inserted into the backend as `draft` (internal mutation) instead of committed as files; then `stageBatch` assigns the next cadence slots and schedules the jobs. The calendar markdown stays the git-tracked plan of record (`drafted`/`scheduled (convex)` rows note the backend); the backend is the runtime state. **Staging gotchas:** writers can emit a typed draft file (e.g. `export default piece satisfies Piece`) that you machine-extract to JSON (Bun/tsx import → `JSON.stringify`) so it's type-checked, not hand-JSON. When feeding JSON to a CLI (`convex run`), pass it through a **double-quoted shell variable** (`"$JSON"`) — article prose is full of apostrophes that break single-quoting — and **insert sequentially** so creation-time ordering (which `stageBatch` sorts by) matches your intended publish order.
6. **Honesty note:** research found no verified SEO evidence that staggered posting beats bulk publishing ("content velocity" is folklore) — cadence is a product/ops choice. Say so; don't sell it as a ranking tactic.
7. **Verify:** backend typecheck/codegen + app typecheck, then the `/reviewer` gate.

## Not in v1

- External CMS publishing (in-repo only).
- Automated backlinks (outreach list instead).
- Multi-language generation (`write N --lang xx` reserved for v2; v1 follows the repo locale).
- Direct ChatGPT/Perplexity answer querying and browser automation of chat UIs (manual protocol instead; browser automation only if the user explicitly asks).
- Image/infographic generation (frontmatter `image` optional; social cards come from the site's existing `/og` route).

## After completion

If any code was written or changed this run (Phase 1 technical files or Phase 3 article/scaffold code), run **`/reviewer`** as the review gate and fix everything it raises before closing out. Then print what was created/modified, calendar progress (X/30), and the suggested next command. Take each count from the calendar and filesystem as they stand now, not from memory, and say plainly what is unverified. (When the run was launched via `all`/`own-goal`, `own-goal` owns close-out — its reviewer gate is `/reviewer`, and it only reports COMPLETE once that gate is clean.)
