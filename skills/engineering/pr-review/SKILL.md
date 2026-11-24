---
name: pr-review
description: "Reviews any GitHub pull request with due diligence: checks it out in an isolated git worktree, runs its tests and the running app, proves bug fixes with base reproduction and revert checks, deduplicates against automated review bots, renders an optional HTML report, and posts only findings the user approves. Use on /pr-review with a PR URL or number, plus optional --html and --comment flags."
argument-hint: "<PR URL or number> [--html] [--comment]"
---

# pr-review: evidence-backed GitHub PR review

Review a GitHub pull request in any repository with due diligence. Every finding in the report carries reproducible proof. Nothing is posted to GitHub until the user names the finding IDs.

When `$ARGUMENTS` holds a GitHub PR URL (`.../pull/<n>`) or a bare PR number, review that PR. Never repeat what an automated review bot (such as GitHub Copilot) has already said on the PR. A code-only `/code-review` only reads code: any finding from it in the conversation stays unverified until this workflow reproduces it.

## Rules

- **Be specific.** Write "SQL injection on `users.ts:42`", never "security issue".
- **Explain why** each finding matters, with a concrete failure scenario.
- **One review, complete feedback.** No drip-feeding across rounds.
- **Confirm before you report.** Read the code path. A pattern match alone produces false positives.
- **Never guess. Every finding needs proof.** Each finding cites the evidence that proves it: the `file:line` you read, a test or command you ran and its output, the design frame, or the ticket text. If you cannot prove it, do not raise it. Do not ask it as a question or soften it with "consider" either. List unverified items in the HTML report only, never posted. This applies to everything:
  - **Copy:** wording comes from the design spec (e.g. Figma) or content source. Raise it only when the design spec shows different text, and quote the frame or source.
  - **UI and behaviour:** only with the design spec or the ticket.
  - **Framework and library behaviour:** only after you have read the installed dependency source (`node_modules`, site-packages, vendor, etc.) or run it.
  - **Runtime claims:** only after you have traced or tested the path.
  - Before posting, fetch the PR head again and drop any finding whose lines have changed since the review.
- **Raise only what affects the ticket.** A finding must be in the PR's own files and change what the ticket delivers (it breaks the build, the app's behaviour, or the user-facing output). Anything else (infra, sibling PRs, other flows, process points such as the PR description, nits that do not change behaviour) is **out of scope**: it goes in the findings file with `scope: "out"` and a one-line `reason`, appears only in the `--html` report, and is never posted unless the user picks it.
- **Never invent a fix; reuse what exists.** Before suggesting a helper, utility, component, or pattern, search the repo for one (`git grep` at the PR head across shared libraries, utils, components, design-system packages, and sibling features). If one exists, the suggestion uses it with its real import path. If none exists, say so in the comment ("no shared X yet; `foo.ts` has a private one"), and name the function to add with the module it belongs in, next to its nearest siblings.
- **The user decides what gets posted.** Post only the finding IDs the user names (`post F1 F3`). When the user calls a finding normal or wrong, move it to `dismissed` with their reason and do not raise it again.
- **Every comment goes through `unslop`.** Before you report or post, run each finding and each PR comment body through the `unslop` skill: one or two plain lines saying what breaks and the fix, nothing else. Never include AI attribution footers (such as "Generated with Claude").
- **No third-party review bots.** Never call Greptile or CodeRabbit, their CLIs, MCP servers, or skills, even when they are installed.

## Scope and budget

- **Review the PR diff, not the main checkout.** Scope is `git diff <base>...pr-<n>` inside an isolated git worktree. Never touch or check out the PR in the main working tree.
- **Bounded:** one full pass over the diff, one fix batch (on your own PR only), one re-run of typecheck and tests, one confirm pass. Do not loop.
- **Fan out only when the diff is large** (more than about 15 files): one fresh reviewer agent per disjoint area, each returning findings in the format below. Merge and confirm every finding yourself.
- **Progress panel** (`~/.claude/references/progress-panel.md`), on by default when `savvy-progress` is installed: report `title: "Review PR #<n>"` and four `tasks` (`Understand diff`, `Test PR`, `Review`, `Report`). Use `phase: "review"`, bump `done` per step, and set `finished: true` at the report. Skip silently if `savvy-progress` is not installed.

## Scripts

Three zero-dependency Node scripts ship alongside this skill (resolve `<skill-dir>` to this skill's directory, e.g. `~/.claude/skills/pr-review`):

- `<skill-dir>/scripts/pr-bot-findings.mjs`: fetches automated review bot threads and review passes from GitHub via `gh`.
- `<skill-dir>/scripts/review-report.mjs`: renders `/tmp/pr-<n>-review.json` into a self-contained HTML report at `/tmp/pr-<n>-review.html` and opens it.
- `<skill-dir>/scripts/post-review.mjs`: validates diff anchors, supports `--only` and `--dry-run`, and posts the approved review via `gh`.

---

## Step 0: Verify the PR and discover review skills

### 0a. Check it is a PR

A `/compare/...` URL or a bare branch name is not a PR. If given a branch or compare URL, run:

```bash
gh pr list -R <owner/repo> --head <branch> --state all
```

If nothing comes back, stop and say so in one line, then draft a short message for the user asking the author to open the PR. Review only if the user explicitly says to.

### 0b. Find the review skills on this machine

Before reviewing, list the review skills available here and pick the ones that fit the diff:

1. Look in `~/.claude/skills/`, the project's `.claude/skills/`, and installed plugin skills. Read each `SKILL.md` frontmatter `description`.
2. Keep skills whose name or description is about reviewing, auditing, critiquing, checking guidelines, or hardening. Drop any Greptile or CodeRabbit skill.
3. Match them to what changed. Typical pairings:

| Diff touches | Skills to run if installed |
|---|---|
| Any code | built-in `/code-review`, built-in `/simplify` |
| Auth, input handling, secrets, APIs | built-in `/security-review`, `pentest` |
| React or Next.js | `vercel-react-best-practices` |
| React Native or Expo | `vercel-react-native-skills` |
| UI, layout, accessibility | `impeccable` (audit or critique), `web-design-guidelines`, `ui-ux-pro-max` |
| Animation or motion | `review-animations` |
| User-facing copy, docs, emails | `unslop`, `humanizer` |
| Module boundaries, new abstractions | `codebase-design` |

4. Say in one line which skills you will use and why. Run each on the scoped PR paths only, and fold their findings into Step 4. A skill that is not installed is skipped silently; never install one mid-review.

---

## Step 1: Collect what bots already raised

Run:

```bash
node <skill-dir>/scripts/pr-bot-findings.mjs <PR> --json /tmp/pr-<n>-bot.json
```

This collects every automated review bot thread (file, line, open/resolved/outdated state, commit, body, replies, URL) and the bot's review passes per commit.

---

## Step 2: Check out the PR in a worktree, always

Before reading any code, fetch the PR into a dedicated branch and worktree:

```bash
git fetch origin pull/<n>/head:pr-<n>
git worktree add ../wt-pr-<n> pr-<n>
```

Handle dependencies safely inside `../wt-pr-<n>`:

- **Symlink dependencies from the main checkout only when** the PR does not change any dependency manifest or lockfile (`package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `pyproject.toml`, `uv.lock`, `Cargo.lock`, `go.sum`, etc.) **and** the main checkout's installed core framework version matches the PR's manifest.
- Otherwise run a clean install inside the worktree (`pnpm install --frozen-lockfile`, `npm ci`, `yarn install --frozen-lockfile`, `bun install --frozen-lockfile`, `uv sync`, etc.). Stale symlinked dependencies cause false compile and test failures.
- Never check the PR out in the main checkout.
- Scope is `git diff <base>...pr-<n>` (get `<base>` from `gh pr view <n> --json baseRefName -q .baseRefName`), and every file is read from the worktree.

---

## Step 3: Test what the PR is meant to do, before reviewing the code

### 3a. Build the checklist

Read the linked ticket's acceptance criteria (GitHub Issue, Linear, Jira, or whatever tracker the project uses; if unreachable or none exists, say so and use the PR body) plus each change the PR body claims. Every checklist item gets a Pass or Fail with evidence.

### 3b. Run the tests

Run the test suite (and typecheck/lint if fast) for every package or module the PR touches, from inside the worktree. Report failing tests by name. CI and build failures are the author's to fix: list them, never debug them.

### 3c. Run the app

Start the app or service from the worktree using the project's dev command. When a backend needs credentials or external services that are unavailable locally, stub API calls with a local stub script or Playwright `route.fulfill()`.

- For web or UI projects, exercise each checklist item and each suspected issue in a browser at desktop (~1200px) and mobile (~320px) widths: default state, error on submit, fixing the error, back/continue (returning user), and any edge value the change touches (`0`, min, max, new limits).
- For API, CLI, or library projects, exercise the real endpoints, commands, or public entry points with the same states and edge values.
- Save a screenshot for each UI state into `screenshots` in the findings file, with `label`, `path`, `url`, `width`, and a one-line `note` on what it proves.
- If a state cannot be reached locally, say so in its note. Never describe that state from the code alone.

### 3d. The proof gate

A correctness, behaviour, UI, or accessibility finding is raised **only** when it reproduced in the app or in a test run, and its proof is that screenshot, network trace, or test output. Only findings caught this way become comments.

- Code-quality points (dead code, duplication, needless work, poor structure) are never posted: put them in the HTML report as `scope: "out"` with `reason: "Not testable"`.
- Anything that did not reproduce is dropped, not softened into a question.

### 3e. Bug-fix PRs: prove the fix fixes the bug

For any PR that claims to fix a bug, do all three checks and treat any failure as a **Blocker**:

1. **Reproduce the bug on the base.** Add a second worktree at the merge-base:
   ```bash
   git worktree add ../wt-pr-<n>-base "$(git merge-base origin/<base> pr-<n>)"
   ```
   Reproduce the ticket's symptom there in the app or in a test. If it will not reproduce on the base, say so: the PR cannot be shown to fix it.
2. **Confirm it is gone on the head**, following the exact same steps and capturing the same screenshot or network trace.
3. **Revert check:** copy the PR's new or changed test files into the base worktree and run them there:
   ```bash
   git show pr-<n>:<test-path> > ../wt-pr-<n>-base/<test-path>
   ```
   A new test that still passes without the fix proves nothing, and that is the finding. Remove the base worktree afterwards (`git worktree remove ../wt-pr-<n>-base`).

### 3f. Verification discipline

- **No ticket, no premise finding.** Never raise a finding that says the PR's reasoning is wrong without reading the linked ticket first. If the issue tracker is unreachable, ask the user to paste the ticket before raising any premise finding. When the ticket names a sibling story or dependency, find its PR (`gh pr list --state all --search <KEY>`), apply its diff on top in a throwaway worktree, and test again. A PR that is correct once its dependency lands is not a bug; at most, note the merge order.
- **Layout claims rest on the screenshot, not a number.** Before saying an element "still fills" or "only wraps", look at your own screenshot of the visible box (border or background) and measure that element, not a wrapper.
- **Test the premise, not only the result.** When the PR or a code comment says the change works because of some mechanism (a header, an interceptor, an order of calls, a cache), check that mechanism directly: watch the request in the network panel or log it in a test. A mechanism you did not observe gets `"not observed"` in its proof, never `"confirmed"`.
- **Design comparison** (e.g. Figma) runs only when the design MCP or source is reachable. Otherwise skip it and say so in the summary.

---

## Step 4: Review the code

Read the full PR diff (`git diff <base>...pr-<n>`), plus the ticket/PRD context and the project's `CLAUDE.md` or `AGENTS.md`. Test every suspected bug using Step 3 before keeping it.

### 4a. Core criteria

1. **Correctness.** Does it meet the requirements? Logic errors, missing edge cases, incomplete flows?
2. **Security.** Injection, auth gaps, data exposure, OWASP Top 10.
3. **Maintainability.** Clear to another developer in six months? Naming, structure, separation of concerns.
4. **Performance.** N+1 queries, needless re-renders, missing indexes, expensive work in hot paths.
5. **Error handling.** Unhandled rejections, missing null checks, failure modes that crash instead of degrade.
6. **Type safety.** `any` that should be specific, missing type guards, unchecked casts.
7. **Completeness.** Anything half-built, left as TODO, or implied by the requirements and missing.
8. **Module depth.** For a new or heavily changed module, apply the deletion test: would deleting it concentrate complexity elsewhere (fine) or just move it (shallow)? A file split only to stay under a size limit is not automatically deep.
9. **Test quality.** Flag tautological tests (the assertion recomputes the expected value the same way the code does) and implementation-coupled tests (mocking internal collaborators, reaching into private state). Tests should target public seams.
10. **Project rules.** The repo's `CLAUDE.md`, `AGENTS.md`, or local conventions doc is part of the spec. Breaking one of its rules is a Blocker even when the code works.

### 4b. Catch what was missed (PR-bot pass)

Ask:
- What would a senior engineer on this team flag in PR review?
- What edge case breaks this in production?
- What would a penetration tester try?
- What happens under load or with bad data?

Then read each changed file the way an automated PR reviewer (like GitHub Copilot) does, checking for:

- **Dates and time zones:** any "today", tax-year, cut-off, or day-boundary logic must use the project's configured business time zone, never the device's local zone. Test it at exact UTC instants either side of local midnight, and run the test under `TZ=UTC`, `TZ=America/New_York`, `TZ=Asia/Tokyo`, `TZ=Pacific/Auckland`, and `TZ=Pacific/Kiritimati`.
- **Parsing user input:** check every number or money parse against `''`, `'   '`, `'0'`, `'-5'`, `'1e3'`, `'0x10'`, `'12.50'`, `'5,000'`, `'05000'`, and `max + 1`. If the behaviour is already right on your own PR, add the test cases anyway so a reply can say "tests added".
- **Deprecated or fragile APIs:** style or encapsulation bypasses reaching into library internals (e.g. `::ng-deep`, `ViewEncapsulation.None`, `!important` overrides on design-system classes), `any`, unchecked `as` casts on external data, and `@ts-ignore` / `@ts-expect-error` without justification.
- **Repeated work in hot paths:** reactive subscriptions, validators, computed values, render/template getters. Flag objects allocated on every run, and work that runs whether or not anything is shown.
- **Untrusted persisted data:** `sessionStorage`, `localStorage`, cookies, or query params used as lookup keys or in switches. Check for a fallback and an own-property check (`Object.hasOwn` or `Map`).
- **Test brittleness:** index-based lookups, unchecked `querySelector` results, duplicated mock setup. Expected values must be literals, never values computed by the helper under test. Exception: plain copy/i18n dictionaries, where pinning the literal string duplicates the dictionary; accept a render test referencing the copy constant instead.
- **Test/spec shape:** every test the diff adds or changes checks queried elements for null before reading them, checks state by value rather than `aria-label` or copy, scopes queries to the component under test, finds buttons by label rather than index, unsubscribes outputs/listeners before the first `expect`, and resets shared mocks in `afterEach`.
- **PR text:** if a description or ticket exists, check it matches the code.
- **Frontend structure and design system:** for any UI diff, check against the repo's component library and architecture rules (code in the right layer, using design-system components instead of one-off overrides, no behaviour the design spec does not show, error states covered with screenshots).
- **Naming:** follow the repo's folder and module naming conventions (avoid repeating parent domain names unnecessarily; name shared types by concept).
- **Repo review catalogue:** if the repo has a local review conventions or learned-patterns file (e.g. `.claude/review-conventions.md` or a section in `CLAUDE.md`), check every defect pattern listed there and skip anything listed as an accepted repo convention.

### 4c. Finding priority and format

Mark each finding by priority:
- **Blocker**: must be fixed before this ships
- **Gap**: should be fixed, a real quality improvement
- **Nit**: nice to have, not blocking (out of scope for posting unless the user picks it)

Tag findings that came from a Step 0 skill with its name, for example `(via review-animations)`.

---

## Step 5: Match every finding against the bot list

Before reporting, compare every finding against `/tmp/pr-<n>-bot.json`. A finding is **already covered** when a bot thread is on the same file within about 5 lines (or the same function) and makes the same point, even if worded differently.

Covered findings are never repeated in "To comment on". They go only in the coverage table:
- **Covered and resolved:** drop it.
- **Covered and still open:** note that the bot already raised it, link the thread, and say whether you agree.
- **Covered, declined by a reply, and you think the bot was right:** list it under **Disagreements**.

---

## Step 6: Write `/tmp/pr-<n>-review.json`

This file is the single source of truth for the terminal report, the HTML report, and posting:

```json
{
  "pr": 123,
  "repo": "owner/repo",
  "title": "PR title",
  "head": "<full-40-char-sha>",
  "author": "github-handle",
  "summary": "One gap, see inline.",
  "tested": [
    { "check": "<ticket or PR claim>", "result": "Pass", "proof": "`<spec>` or `<screenshot>`" }
  ],
  "screenshots": [
    { "label": "desktop-default", "path": "/tmp/pr-123-desktop.png", "url": "http://localhost:3000/...", "width": 1200, "note": "Renders default state" }
  ],
  "comments": [
    {
      "id": "F1",
      "severity": "Blocker",
      "scope": "in",
      "title": "Short title",
      "reason": "Only needed when scope is out",
      "proof": "Spec name + failing output, screenshot path, or network trace",
      "path": "src/example.ts",
      "line": 42,
      "startLine": 40,
      "body": "One or two plain unslopped lines saying what breaks and the fix.",
      "suggestion": "exact replacement lines for startLine..line"
    }
  ],
  "dismissed": [
    { "id": "F9", "title": "...", "reason": "User confirmed expected behaviour" }
  ],
  "bot": [
    { "mark": "✓", "threads": "#26, #51", "url": "https://github.com/...", "path": "src/example.ts", "point": "Short point", "status": "open", "note": "Agreed; real null dereference" }
  ],
  "disagreements": [
    { "threads": "#31", "url": "https://github.com/...", "path": "src/example.ts", "point": "Short point", "note": "Declined in reply, but reproduces on empty input" }
  ]
}
```

Field rules:
- `id`: `F1`, `F2`, ... in priority order, in-scope first. A finding anchored in two places uses the same `id` twice.
- `scope`: `"in"` or `"out"`, per the Rules. Out-of-scope entries carry a `reason` (e.g. `"Infra file, not in this PR's diff"` or `"Not testable"`).
- `proof`: how the finding was proved (test name and failing output, screenshot path, or network trace). "Read the code" is not proof for a behaviour finding; such a finding is `scope: "out"` with `reason: "Not reproduced"`.
- `suggestion`: exact replacement for `startLine`..`line` on the PR head so GitHub renders a one-click "Suggested change". Include it whenever the fix fits in those lines.
- `summary`: the review body, a few words: `"One gap, see inline."` With zero in-scope findings, the body is `"LGTM 👍"` and the PR gets a 👍 reaction. **Approve only when every review thread (bot and human) is resolved or outdated by a later push.** Check via GraphQL `reviewThreads { isResolved isOutdated }`. If any thread is still open, do not approve, even when the code already addresses it. Never mention Copilot, other reviewers, what was left out, or how the review was done.
- `bot`: one row per group of bot threads making the same point, marked `✓` confirmed, `✗` wrongly dismissed, `·` not checked.

---

## Step 7: Show the terminal report

**No report without Step 3.** If the app or tests were not run, the review is not finished: say so rather than reporting.

Show the terminal report in **this exact layout** with no extra prose around it:

```markdown
## PR #<n> · <title>
<author> · head `<sha9>` · <k> to comment on · <m> out of scope · <d> dismissed

### Tested
| Check | Result | Proof |
|---|---|---|
| <ticket or PR claim> | Pass / Fail | `<screenshot>` or `<spec name>` |

### To comment on
| ID | Priority | Where | Comment | Proof |
|---|---|---|---|---|
| F1 | Blocker | `file.ts:6-11` | <body, as it will be posted> | `<spec name>` fails / `<screenshot>` |
| F2 | Gap | `copy.ts:40`, `copy.ts:68` | <body> · suggestion included | `<screenshot>` |

### Bot already covered
| | Threads | Point | Note |
|---|---|---|---|
| ✓ | #26, #51 | <point> | <one-line note> |

### Disagreements with bot
<rows, or "None.">

Out of scope: F3 <title> · F4 <title> ... (details in `--html`)
Reply `post F1 F2` to post as **<gh user>**. Nothing is posted until you do.
```

Omit the `Out of scope:` line when there are none. Stop the dev server and remove the worktree (`git worktree remove ../wt-pr-<n>`) once the user has picked what to post (or declined).

---

## Step 8: `--html` report

When `--html` is passed (or requested afterwards), run:

```bash
node <skill-dir>/scripts/review-report.mjs /tmp/pr-<n>-review.json --worktree ../wt-pr-<n>
```

This writes `/tmp/pr-<n>-review.html` and opens it: Tested checklist (with embedded screenshots), To comment on, Out of scope (with reasons), Dismissed, Bot coverage, and Disagreements. Each finding shows line-numbered code from the PR head, target lines highlighted, the suggested change as a diff, and the exact comment text below. Re-run it after every edit to `/tmp/pr-<n>-review.json`.

---

## Step 9: Fix or post

### On your own PR

When the branch is checked out and the author is the current user:
- Fix new blockers and gaps straight away inside the scoped paths. State what you fixed in one line and commit by path on top (never force-push):
  ```bash
  git commit -m "fix(scope): what changed and why it was wrong" -- <paths you fixed>
  ```
- Write focused unit tests for critical paths where a bug would do real damage (core business logic, data transformations, auth flows) using the project's existing test framework. Test through the public seam with independent expected values (known-good literals or worked examples, never recomputed from the code). Priority: happy path, edge cases, error handling, security-sensitive logic.
- `--comment` means "get the review ready to post", never "post now". Never repost something a bot already said.

### On someone else's PR

Do not edit code. Prepare the review and wait for the user's pick.

### Posting the review

1. **Dry run** the IDs you would post:
   ```bash
   node <skill-dir>/scripts/post-review.mjs <PR> /tmp/pr-<n>-review.json --only F1,F2 --dry-run
   ```
   This verifies the PR head has not changed the anchored lines and every anchor sits on a changed line in the PR diff. Fix any anchor it rejects. An out-of-scope finding on a file outside the diff cannot go inline; if the user picks one, add it to `summary` instead.
2. **Wait for the user's pick.** A review is public. Post only after the user names the IDs (e.g. `post F1 F2`, or `approve` when zero findings and all threads are resolved/outdated).
3. **Post** with the user's chosen IDs, without `--dry-run`:
   ```bash
   node <skill-dir>/scripts/post-review.mjs <PR> /tmp/pr-<n>-review.json --only F1,F2
   ```
   It posts one `COMMENT` review (or `APPROVE` + 👍 reaction when `--approve` is passed and all review threads are resolved/outdated) as whoever is signed in to `gh` on this machine (`gh api user`). Report the review URL.

---

## Step 10: Feed project conventions

When a review uncovers a recurring defect class or an accepted repo convention (e.g. a bot comment or finding the user dismissed as normal), note it at the end so the user can add it to the project's `CLAUDE.md`, `AGENTS.md`, or local review conventions file and avoid repeat noise on future PRs.
