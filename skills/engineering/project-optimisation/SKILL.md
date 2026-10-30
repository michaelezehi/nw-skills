---
name: "project-optimisation"
description: "Find and fix why a JS/TS monorepo is slow, from the dev machine to what users download. Measures first (dev server RSS, orphaned processes, dev caches, local backend storage, first-load JS per route), fans out one investigator per cause, fixes in parallel with owned paths, re-measures with the same script, then ships through staging. Built on a Next.js + Turbopack + Convex + pnpm/turbo monorepo; the checks carry to any similar stack. Use when the user says /project-optimisation, \"the app hogs memory\", \"dev is slow\", \"next-server is using GBs\", \"make it faster\", \"optimise the project\", or \"why is the bundle so big\"."
argument-hint: "[scope: dev | prod | convex | all] (no args = all)"
---

# project-optimisation

Measure, find the cause, fix it, measure again with the same tool. Every
number in the report comes from a command run in this session.

Size: this is L or XL by the CLAUDE.md scale. Write the unlazy ledger under
`gates/` before the first edit, one file per phase.

## Step 1: measure before touching anything

Run these in one go and keep the output. They are the "before" column.

```bash
# Processes: memory, CPU, age. Look for herds and anything reparented to PID 1.
ps -axo pid,ppid,rss,%cpu,etime,command | awk 'NR==1 || /next-server|next dev|convex|turbo|vitest|tsup|tsc|node /' | sort -k3 -nr | head -30

# Orphans: dev tools whose parent died, still running.
ps -axo pid,ppid,etime,%cpu,command | awk '$2==1 && /vitest|tsc|tsup|next|convex|node -e/'

# Dev caches and local backend storage, the things that only grow.
du -sh apps/*/.next apps/*/.next/dev/cache/turbopack 2>/dev/null
du -sh **/convex-out/.convex/local/*/convex_local_backend.sqlite3 **/.convex/local/*/convex_local_storage/modules 2>/dev/null

# What dev starts: every workspace with a dev script, and the root runner.
grep -l '"dev"' apps/*/package.json packages/*/package.json; grep '"dev"' package.json
```

For production, build once at the current commit in a separate worktree
(`git worktree add --detach ../<repo>-perf-baseline HEAD`, copy the
gitignored `.env*` files, `pnpm install --frozen-lockfile --prefer-offline`,
`npx turbo run build --filter='<app>^...'` so workspace packages exist, then
`next build`). Measure with the bundled script:

```bash
node ~/.claude/skills/project-optimisation/scripts/first-load.mjs <app>/.next > base-<app>.txt
```

It reads every route's `page_client-reference-manifest.js` and sums the
gzip -6 size of the JS that route loads first. Next 16 with Turbopack prints
no first-load table, so this is the number. Never pipe its output through
`tee | head`: head closes the pipe and truncates the file.

## Step 2: find the cause, one investigator per area

Dispatch read-only investigators in parallel (Explore, strongest model below
the driver), each told to rank causes with file:line evidence and to list
what it ruled out. The areas and what they found the first time:

| Area | Check | Found before |
|---|---|---|
| Dev server memory | Any `import(\`./x/${var}.json\`)` or other template-literal import. Turbopack resolves it as a glob over the whole folder | 1,001 JSON files compiled 3 times for 11 locales; next-server at 3 to 6 GB vs 200 MB for a sibling app |
| Dev caches | Size and growth of `.next/dev/cache/turbopack` | 20 GB, growing 7 to 10 GB a day |
| Orphans | Agent-run test suites whose shell timed out; test suites that spawn processes and only stop them on the happy path | 3 vitest trees at 100% CPU for 7 hours; leaked dashboard and fixture processes from a test file |
| Test hangs | A worker pinned at 100% that never times out | convex-test lock livelock: a scheduled `runAfter(0)` from one test ran into the next test's database |
| Dev orchestration | Watchers nobody needs (`tsup --watch` for a package the apps read from dist), typecheck on every save, tsconfig `include` that walks `.next` | 1.1 GB watcher; full `tsc` before every Convex push |
| Local backend | Crons running production schedules on a laptop; sqlite revision bloat; module blobs never pruned | 4.6 GB sqlite, 7.7 GB of module blobs, 10 s full-table cron every 10 minutes |
| Client bundle | Locale catalogs in first load; whole catalogs for every locale; server-only code reachable from a client module; heavy libraries without `next/dynamic`; one-file UI kit builds; two UI kits | Two locales eager, legal texts and product copy for 11 locales on every dashboard page; crypto-browserify via one unused function in a client-imported module |
| Backend queries | Reactive queries that `.collect()` whole tables, subscribed at layout level | notifications and audit logs scanned on every write, in every open tab |
| Backend push | Files marked `"use node"` that use no Node API; test helpers inside the functions folder; regexes built at module load | 6.3 MB per push from 6 files; 565 of 646 ms cold load from 2,774 regexes |

To find what is in a large chunk, fingerprint it by content: count Arabic or
other script characters (a locale), grep distinctive identifiers
(`sha224WithRSAEncryption` means a crypto polyfill), list quoted keys. Then
trace the import chain in source. Check a match before acting on it: `three`
matched date-fns `threeDigits` and `xlsx` matched an export menu.

## Step 3: fix in parallel, owned paths only

One worker per cause, briefs naming the reason, the exact owned paths, the
verification commands, and the commit format. Rules that saved rework:

- **Fixed imports, never globs.** Generate a loader map with one literal
  `() => import('./x/en.json')` per locale from the compose step, with a
  `--check` mode that fails when stale.
- **One eager locale.** The server waits on the active locale's catalog
  (`use(loadCatalog(locale))`) so a non-English first paint never flashes
  English.
- **Load copy where it is shown.** Legal texts on drawer open, marketing copy
  on marketing routes, one locale per load.
- **Delete server code from client-imported modules.** An unused helper that
  imports `crypto` or `next/server` ships its polyfills to every page.
- **LazyMotion is a sweep.** Non-strict `<LazyMotion features={async}>` at
  each app root, then convert every `motion.*` to `m.*` with a
  TypeScript-checker codemod. Update the test mocks to export `m` first, or
  half the files get held back.
- **Unbundled design system.** One ESM file per module with relative imports
  rewritten to `.mjs`, `"use client"` kept per file, CJS unchanged for
  anything that requires it. Add it to `optimizePackageImports`.
- **Indexed reads with the same result.** Each changed query gets a test that
  rebuilds the old full-scan result and compares. A cap turns a total into a
  floor: check whose total it is before accepting it.
- **Lazy regexes.** Keep the source, compile on first possible match, and skip
  any question that lacks the pattern's required literal. Prove byte-identical
  output over the whole corpus.
- **Local backend reset round trip.** Export tables, files and env vars;
  wipe sqlite and storage, keep the instance config; restore env vars BEFORE
  the first push (auth config reads them); push; import with
  `--replace-all`. Set the local cron switch before the push too.
- **Dev tooling.** Kill orphan trees, clear oversized caches and run the root
  setup step before services start. A dashboard that already samples `ps` is
  the place for it.
- **Test runs from agents.** Always `vitest run` with a wall clock
  (`perl -e 'alarm shift; exec @ARGV' 900 npx vitest run`), a `testTimeout`,
  and a `maxWorkers` cap (vitest 2 also needs `minWorkers: 1`).

The driver reads every returned diff before accepting it, and re-checks the
claims that decide a gate. Workers were wrong about details several times:
an "unused" dependency that was used, a package name that was not imported,
a commit message miscount. Accept the code on evidence, not the summary.

## Step 4: measure again with the same tool

Rebuild at HEAD, run `first-load.mjs` on both builds into full files, and
compare the median, p90, max and the routes users hit first (home, public
pages, dashboard). Re-measure the dev server after a fresh start at the same
minute mark as the baseline. For a backend push, time no-op pushes before and
after (the first push after a schema change builds indexes, so it does not
count).

## Step 5: ship through staging

- A deploy that pushes the local working tree ships every unpushed commit,
  not just this work. Count `git rev-list --count origin/main..HEAD` and say
  so before deploying.
- Run the i18n or payload gates the ship scripts run, early, so a stale
  budget surfaces before the deploy and not during it.
- Staging, measure, then prod. Delete the gates ledger when delivered.

## Docker and CI

Check, per change:
- The Dockerfiles build workspace packages in order (design system, then the
  packages that import it, then the app). A new build config must work from
  a clean clone with `pnpm build` in that package.
- A workspace package newly imported by another package (often a source-only
  one with `exports: ./src/index.ts`) must be copied into every image before
  the importer builds, and its `package.json` registered in the deps stage.
  Grep each Dockerfile for the new name; the deploy fails with
  `Could not resolve` otherwise.
- Generated files the build reads (loader maps, namespace lists) are
  committed, because Docker builds often skip `prebuild`.
- `.dockerignore` excludes `**/.next`, `**/node_modules`, `**/.convex` and
  backup folders, so a local image build does not upload gigabytes of dev
  data.
- A removed dependency needs the lockfile committed in the same change, since
  `--frozen-lockfile` fails otherwise.
