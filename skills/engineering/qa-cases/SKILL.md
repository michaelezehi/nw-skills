---
name: qa-cases
description: Generate a shareable QA test case .md document for the current project. Investigates the codebase (and any provided screenshots) to map every user-facing surface, then writes one test plan per app variant (web, mobile, each separately deployed app), grouped by user journey. Default output is high-level and grouped by page; pass `-v` for a verbose, atomic Given/When/Then plan. Use when the user asks for a QA test plan, test cases for QA, or a regression checklist.
argument-hint: [focus] [-v]
---
# /qa-cases — Generate a QA test case document

**Progress panel:** on by default. Before planning, follow `~/.claude/references/progress-panel.md`: load the savvy-progress tools if not loaded, then report this run's steps and sub-agents to the bar. If a bar is already running, carry on with it: add your rows, no second bar, no duplicate rows.

Use when the user asks for a QA test plan, test cases for handoff to QA, a regression checklist, or screenshots-to-tests. Output is **one shareable file per app variant** (see **Split by app variant**). A project with a single variant gets one `QA-TEST-CASES.md`.

## Modes

There are two output modes. Detect at the start and stay consistent throughout the document.

- **Default — high-level grouped (no flag).** One ticket per user journey. Each ticket describes the journey in plain English and lists a short prose block of "what to verify". No numbered Given/When/Then per behaviour. Written for a QA lead who reads the whole plan in one sitting and plans a cycle from it.
- **Verbose — atomic (`-v`).** One ticket per area with numbered Given/When/Then test cases — one assertion per case. Written for a tester who works through it case by case, so every assertion is spelled out.

If the user explicitly asks for detailed/granular/atomic test cases without typing `-v`, treat that as verbose mode. If the user says "high-level", "group it", "keep it concise", or doesn't specify, use default mode.

## Split by app variant

A tester opens one app at a time. A plan that mixes apps leaves them unsure which one a check belongs to, so the output is broken down by variant, always, without being asked.

- **A variant** is an app that is built, deployed or installed on its own: for example the ATS web app, the HR web app, the HR mobile app. In a monorepo, start from `apps/*` and the deploy targets. A native mobile app is always its own variant, separate from the web app it talks to. A phone browser on a responsive web page is not a variant; it stays in the web file's device matrix.
- **Small satellites** (a browser extension, the marketing site, a white-label host) go in the file of the team that tests them. Name them in that file's Scope line.
- **One file per variant:** `QA-<VARIANT>.md` (for example `QA-ATS.md`, `QA-HR.md`, `QA-HR-MOBILE.md`), all in the same output folder. Only one variant: `QA-TEST-CASES.md`.
- **One variant per ticket.** A journey that crosses apps (a prompt on web and a push on mobile, a delete on mobile checked on web) becomes one ticket per variant. Each one says where the other side is tested, for example "The web side is QA-HR-FORCED in the HR document."
- **Ticket IDs carry the variant** (`QA-ATS-…`, `QA-HR-…`, `QA-MOB-…`), so an ID never repeats across files.
- **Each file stands alone:** its own Scope line naming the app and pointing to the sibling files, its own before-you-start (only the builds, data jobs and settings that variant needs), accounts, ticket index, out of scope and bug template. The mobile bug template asks for the device, OS and app build, not a browser.
- **Mobile needs a build note:** say which build (at or after which commit) QA must install, because native changes only arrive with a fresh build.

## When to use

Trigger phrases: "create test cases", "QA test plan", "test cases for [area]", "what should QA test", "regression checklist", "QA handoff doc", or screenshots dropped with "create test cases for these".

Skip and ask first if the user wants:
- A single test case for a specific bug → just write it inline.
- Automated test code (Playwright, Cypress, Vitest) → wrong skill, this produces a manual QA plan.
- A PRD or spec → use `/prd-ch` instead.

## Inputs

The user may provide any combination of:

1. **Screenshots** — pasted images representing screens to test. Treat each as an entry point: identify the route/component, then expand the test plan to cover that surface.
2. **A focus argument** — e.g. `/qa-cases checkout`. Scope the doc to that area only.
3. **The `-v` flag** — switches to verbose mode (see above).
4. **Free-text context** — preferences on grouping, priority hints, or known-good areas to deprioritise.

If no inputs are given beyond the command itself, generate a full-app high-level plan.

## Process

### 1. Set up output location

Run:

```bash
mkdir -p "_r&d/qa/<slug>/$(date +%m-%d)/$(date +%H-%M)"
```

Where `<slug>` is a kebab-case summary of the focus (or `full-app` if none). The files are `_r&d/qa/<slug>/<MM-DD>/<HH-MM>/QA-<VARIANT>.md`, one per app variant, or a single `QA-TEST-CASES.md` when the project has only one.

If the project has no `_r&d/` directory, fall back to `docs/qa/`.

### 2. Read project conventions

Read `CLAUDE.md` (project-level) if present. Pull out:
- Brand voice rules (banned words, canonical strings).
- "Never use" lists (e.g. "no 'AI' in user-facing copy").
- Tech stack hints (Next.js + App Router vs Pages, auth provider, payment provider).
- Design tokens or breakpoint conventions.

These become **guardrail items** in the plan — verify the user-facing copy doesn't violate them. In default mode they fit inside a security/copy ticket; in `-v` mode they earn dedicated test cases.

### 3. Analyse screenshots (if provided)

For each screenshot:
- Identify the screen by visible labels, headers, nav items, and URL fragments.
- Note interactive elements at a meaningful level — buttons, inputs, dropdowns, modals — without enumerating every micro-interaction (unless `-v`).
- Map it to a probable route in the codebase.

### 4. Map the codebase

Use **Explore agents** ("very thorough" breadth) to inventory user-facing surfaces; on a large app, split by area and run them in parallel. Ask it to return, per area:

- Route path(s) — **pathnames only**, no domain. The plan must run unchanged in QA staging and production.
- Key component files
- User actions available at a high level
- Critical states (loading, empty, error, success)
- Auth or permission gates
- Mobile-specific behaviour

Cover at minimum (for a typical web app): auth flows, top nav, dashboard, primary list pages, create/edit flows, detail/results pages, settings, public pages, respondent-facing or external flows.

If the user gave a focus argument, scope the Explore prompt to that area only — but still cover its dependencies (e.g. testing checkout requires auth + cart context).

Don't paste source dumps into the output.

### 5. Compose the document

Pick the template that matches the mode (see **Output structure** below).

Defaults that apply to both modes:

- **One ticket per user journey or area, within one variant.** Desktop and phone browsers on the same web app are tested together unless behaviour diverges; call out divergences inline. A native app is a separate variant and file.
- **Pre-conditions, pass criteria, priority** on every ticket. Assign priority by risk (impact × likelihood): auth, payments, and data-loss journeys, plus areas adjacent to recent changes, rank highest.
- **Default device matrix and test data accounts** defined once at the top, reused throughout.
- **Path reference table** at the top — pathnames only, no domain.
- **Cross-cutting sweep** at the end (console errors, Lighthouse, keyboard, screen reader).
- **Bug filing template** at the very bottom.

### 6. Final pass

Before reporting done, verify:

- Every ticket has a unique ID. Default mode uses `QA-<JOURNEY>` (e.g. `QA-REG-FOUNDER`); verbose mode uses `QA-<AREA>-<NN>`.
- Every screenshot the user provided maps to at least one ticket.
- Every focus-area concern from the prompt is covered.
- No source-code blocks in the output (it's for QA, not engineering).
- No "AI" or banned project-specific terms in the document itself.
- All URLs are pathnames only — no domain references.
- The depth matches the mode: default reads as journeys, `-v` as one assertion per case.
- There is one file per app variant, no ticket covers two variants, and each file's Scope line names only its own app.

### 7. Open the folder

Once every file is written and the final pass is clean, open the output folder so the user can drag the files straight into their QA tool or a chat:

```bash
open "_r&d/qa/<slug>/<MM-DD>/<HH-MM>"    # macOS
xdg-open "_r&d/qa/<slug>/<MM-DD>/<HH-MM>" # Linux
```

Do this every run, without being asked. If the open command is missing or fails, say so in the report and give the absolute folder path.

## Output structure — default (high-level)

Use this skeleton. Replace placeholders. Drop sections that don't apply.

```markdown
# <Project> — QA Test Cases: <Scope>

**Version:** 1.0
**Date:** <YYYY-MM-DD>
**Owner:** Engineering → QA handoff
**Scope:** <one-line scope statement.>

---

## How to use this document

Each ticket covers one user journey at a high level. Test the listed pages in order, exercise the listed behaviours, and confirm the outcomes match. Don't treat every behaviour as a separate test case — treat each ticket as one journey.

**Severities:** P0 (blocker), P1 (must fix before release), P2 (file and triage).

**Devices:** Chrome and Safari desktop at 1440×900, current-generation iPhone Safari at 393×852 and Android Chrome at 412×915.

**Accounts to provision:** <one line per account the QA will need>.

**Paths (no domain — works in any environment):**

| Surface | Path |
|---|---|
| <Page name> | `/path/name` |
| ... | ... |

---

## Ticket index

| ID | Journey | Priority |
|---|---|---|
| QA-<JOURNEY> | <one-line journey> | P0 |
| ... | ... | ... |

---

## QA-<JOURNEY> — <journey title>

**Pages:** `/entry` → `/intermediate` → `/destination`.
**Priority:** P0 / P1 / P2
**Pre-conditions:** <accounts, data, fixtures the QA needs>.

**Journey to test:**
<One short paragraph in plain English describing the user's path from entry to outcome.>

**What to verify:**
- <Behaviour or outcome grouped at a meaningful level — not per keystroke.>
- <Validation and error behaviour summarised, not enumerated.>
- <Cross-page consequences if any.>
- <Mobile divergences if any.>

**Pass criteria:** <one to three sentences of what "green" looks like.>

---

## Cross-cutting checks (run once per cycle)

- **No console errors or warnings** on any page in production build.
- **Lighthouse pass** on key routes: Performance ≥ 80, Accessibility ≥ 95, Core Web Vitals (LCP, INP, CLS) in the green band.
- **Keyboard navigation** across primary flows: tab order logical, no traps.
- **Screen reader sanity** with VoiceOver or NVDA: headings announced, buttons labelled.
- **Error monitoring** picks up an intentional thrown error.

---

## Bug filing convention

```
[QA-<TICKET-ID>] <one-line summary>

Pre-conditions: ...
Steps to reproduce: 1. ... 2. ... 3. ...
Expected: ...
Actual: ...
Device / Browser: <e.g. iPhone 14 Safari 17.4>
Environment: QA staging | Production
Account used: <role + handle>
Severity: P0 / P1 / P2
Console errors: <paste if any>
Screenshot / Loom: <link>
```

One bug per failure. Don't bundle.

---

## Out of scope

- <Anything explicitly not in scope, kept short>

---

**End of document.**
```

### Default-mode rules

- **No numbered Given/When/Then per behaviour.** Use a prose "Journey to test" + bulleted "What to verify".
- **Group behaviours by intent**, not by surface element. "Validation and errors are surfaced clearly" is one bullet, not ten.
- **Don't list every form field.** Reference the page; QA will see the fields on screen.
- **Keep bullets to one to two sentences.**
- **Cap each ticket at ~12 bullets** in "What to verify". If it spills further, the ticket should be split or you're operating in verbose mode by accident.

## Output structure — verbose (`-v`)

Use the high-level skeleton above but replace each ticket body with the verbose structure below. Keep the same top-of-doc sections (path table, accounts, ticket index, cross-cutting, bug filing, out of scope).

```markdown
## QA-<AREA>-<NN> — <area title>

**Area:** <route(s) and key files>
**Priority:** P0 / P1 / P2
**Pre-conditions:**
- <account, data, env requirement>
- <permission or feature flag required>

### Test cases

1. **<short title>**
   *Given* <state>, *when* <action>, *then* <expected outcome>.

2. **<short title>**
   *Given* ..., *when* ..., *then* ...

### Pass criteria
- <observable success conditions>

### Coverage
Default matrix. (Or override: "Desktop only — payment flow is desktop-first.")
```

### Verbose-mode rules

- **Numbered Given/When/Then** for every test case, one assertion per case where possible.
- **Cover happy path, validation, errors, empty state, permissions, mobile, persistence, and cross-surface propagation** explicitly where they apply.
- **Brand guardrails earn dedicated cases**, e.g. "No 'AI' in user-facing copy. Given every page, then the rendered DOM does not contain the literal string 'AI'."

## Standard ticket coverage for a web app

Every full-app QA plan should at minimum include tickets (one per item in default mode, often split further in `-v`) for:

- **Auth** — sign-in, sign-up, email verify, forgot password, OAuth, team invite.
- **Top nav + user menu** — every link routes correctly, mobile hamburger, active states, scroll behaviour.
- **Dashboard / home** — loads, KPIs render, CTAs route, empty state, mobile layout.
- **List pages** — search, filter, status badges, row click, delete with confirmation, empty state, mobile.
- **Create flows** — every entry mode, happy path, validation, draft persistence, limits.
- **Editor flows** — inline edit, add/remove items, reorder, auto-save, publish, mobile.
- **Detail / results pages** — header, stats, sub-tabs, exports, empty state, mobile.
- **Settings** — profile, team (invite + remove), integrations, subscription.
- **Subscription / billing** — checkout, upgrade, cancel, failed payment, plan limits, feature gating.
- **Respondent / external flows** — public share links, multi-step completion, mobile permissions.
- **Marketing pages** — smoke pass, brand string verification.
- **Security** — session/cookie flags, rate limiting, CSRF, OAuth state, role isolation, IDOR, headers, file uploads.

Add or skip based on what the codebase actually has.

## Brand guardrails

If `CLAUDE.md` defines banned terms or canonical strings, cover them in the plan. In default mode, fold them into a security/copy bullet on the relevant ticket. In `-v` mode, give them their own test cases. Examples:

- *"No 'AI' in user-facing copy."*
- *"Tagline integrity — string is byte-identical to '<exact string>'."*
- *"Banned tells — none of leverage, delve, seamless, robust, cutting-edge, tapestry, multifaceted, vital, pivotal, groundbreaking appear on any marketing page."*

## Style rules

- **No emojis** anywhere in the output.
- **No source code** dumps. Reference component names if helpful, but keep it readable for non-engineers.
- **Sentences 8–18 words** where possible.
- **Active voice** throughout.
- **Concrete data** in examples — never `<some value>` placeholders unless the user must fill them.
- **Pathnames only** — never the domain. The plan must run on QA staging and production unchanged.
- **No "AI"** in any user-facing copy mentioned. Use "smart" or "intelligent" when describing features.

## Reporting back

When done, say the folder was opened, then output the folder, then one line per file: its name, its app variant and its ticket count, plus the mode.

Examples:
> Written to `_r&d/qa/role-registrations/05-12/18-09/QA-TEST-CASES.md` — 9 tickets, high-level mode. Re-run with `-v` for the detailed version.
> Written to `_r&d/qa/checkout-flow/05-07/14-22/QA-TEST-CASES.md` — 8 tickets, 47 cases, verbose mode.

Do not paste the document body back into chat.
