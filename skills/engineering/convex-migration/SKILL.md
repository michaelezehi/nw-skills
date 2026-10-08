---
name: convex-migration
description: End-to-end backend → Convex migration orchestrator. Detects the source stack (NestJS / Fastify / Express; GraphQL / REST / tRPC / mixed; TypeORM / Prisma / raw SQL), runs nest2convex on the source, then ports the emitted stubs, migrates data from the source database, cuts the frontends off the legacy transport, batches schema indexes, and runs three reviewer sweeps (FE runtime, backend security, build health). Uses parallel sub-agents per module/domain. Idempotent — safe to re-enter at any phase. Built on top of `/nest2convex` (the converter at `/Users/michaelezehi/Documents/src/__new-world__/convex-converter/`).
---
# /convex-migration — full backend → Convex migration playbook

This skill takes any TypeScript backend (NestJS, Fastify, Express, …) talking to a relational DB and migrates it to Convex end-to-end, including the frontend(s) that consume it. It builds on top of the `/nest2convex` converter that emits the scaffolding.

**It does not require GraphQL.** REST-only, tRPC-only, or mixed projects work just as well — the converter understands `@Controller` / `@Resolver` / `@Cron` / `@Processor` / `@Gateway` independently.

## Port as you emit

The founder-x migration took about two extra days of fix waves because hundreds of `NOT_IMPLEMENTED` stubs were emitted first and audited later (emit-then-audit). The fix is to port each function 1:1 from the legacy source the moment it is emitted, with a pointer file for mechanical verification. Apply these in every wave:

1. **Compile-clean is not parity.** `npx convex dev --once` passing means TypeScript parsed, not that the Convex impl matches the legacy behavior. Verify parity per function by reading both implementations.

2. **Port in the same wave you emit.** Each porting agent emits-or-rewrites and ports from legacy before the wave closes. A wave that closes with any function throwing `NOT_IMPLEMENTED` (or returning a hand-built empty shape) is not done.

3. **Pointer files come with the stub.** Every emitted function gets a `_legacy/<module>/<fn>.md` sibling at emit time (R2). The porting agent writes against it and the reviewer diffs impl vs pointer. Pointers written during a later audit arrive after the impls are already wrong.

4. **Reads are not generators.** `<noun>Report` / `<noun>Result` / `<noun>View` / `latest<X>` are reads: they return stored rows or `null`, ported deterministically. `generate<X>` / `regenerate<X>` / `trigger<X>` are generators: those throw `EXTERNAL_NOT_WIRED` on the SDK call. Throwing `EXTERNAL_NOT_WIRED` from a read is a bug.

5. **Data audits run before the first port.** Run the cross-tenant audit and FK-shape audit on the imported data before any port wave starts. Otherwise data bugs surface as behavior bugs and get masked by dual-probe code instead of fixed.

6. **A parity reviewer runs in every wave.** The wave's exit check is "for each function, pointer matches impl". Drift compounds across waves, so one sweep at the end costs far more than one per wave.

7. **`EXTERNAL_NOT_WIRED` is a contract, not a fallback.** It is for sharp external dependencies (LLM, Stripe SDK, Resend SDK, Calendar API, S3 presign). If the legacy code does the work without an external call, the Convex port does too.

8. **Parity check before deleting legacy code.** See Phase 9. A backup proves retrievability, not correctness.

## Hard rules

Learned from the founder-x post-mortem. These take precedence over anything later in this file.

### R1 — No `NOT_IMPLEMENTED` stubs reach the running system

Every emitted function must be either (a) ported 1:1 from the legacy source, or (b) an explicit `EXTERNAL_NOT_WIRED` throw at a SHARP external boundary (LLM, Stripe, email, calendar, S3-presign) with the local persistence/validation portion fully ported.

A function that throws `NOT_IMPLEMENTED` from inside the system (no external dependency) is a bug, not a placeholder. The right shape is:

```ts
// AWAITING_PORT — never ship in this state. The converter+skill should
// have either filled the body via LLM transpile OR thrown EXTERNAL_NOT_WIRED.
throw new ConvexError({
  code: 'AWAITING_PORT',
  module: '<module>',
  fn: '<fn>',
  legacy_source: 'apps/api/src/modules/<x>/<y>.service.ts:<line>',
});
```

Before declaring the migration done, grep for `AWAITING_PORT` (see "Verification at end of every wave"). Zero matches outside `__tests__/` is the only acceptable end state.

### R2 — Every ported function has a legacy pointer file

Alongside every emitted module file, write a sibling `_legacy/<module>/<fn>.md` capturing:

- Source path (`apps/api/src/modules/...`)
- Verbatim legacy resolver + service body (so a reviewer can verify the port)
- Identified external boundaries (LLM call, Stripe call, etc.)
- Gate the legacy code used (`@UseGuards(JwtAuthGuard)`, `@CurrentUser()`, custom decorator)

This makes the 1:1 verification mechanical: any port reviewer can `diff` the Convex impl against the pointer file. No more guessing whether a behavior matches.

The converter has an LLM-transpile step (`src/transpile/apply.ts`) — extend it to also emit the pointer file on every attempt (success or failure). If the LLM body is below confidence, the function throws `AWAITING_PORT` AND the pointer file is the entire backlog.

### R3 — Importer must use ONE foreign-key form (Convex `_id` only)

The single biggest source of read-side bugs in founder-x: migrated rows stored FK fields in mixed forms — sometimes the legacy UUID, sometimes the Convex `_id`. Every reader had to dual-probe both.

The importer must resolve every legacy FK uuid to the Convex `_id` of the parent row BEFORE inserting. If a parent row hasn't been imported yet, defer the child (the two-phase import pattern in `src/map/migrate.ts`; enforce it, do not treat it as optional).

Concretely: after import, `grep -E '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'` over every FK column should match ONLY `legacy_id` columns. If a `*_id` column (other than `legacy_id`) contains a uuid, that's a bug — the row references the source database, not the Convex graph.

Run this check after migration (`audit-fk-shapes.mjs` below) and stop the migration if it finds any.

### R4 — Importer must preserve PG FK semantics exactly (no "smart" remapping)

If the PG row has `founder_profiles.company_id = <X>`, the Convex row must have the resolved Convex `_id` of `<X>`. Don't overwrite from sibling tables (e.g. don't use `memberships.company_id` to populate `founder_profiles.company_id`). The PG source of truth is the source of truth.

This bug cross-attached 6 founder_profiles in founder-x to the wrong companies, including one cross-tenant data exposure window.

### R5 — No fake-shaping reads

A read query that legitimately returns no data returns `null` or `[]` BECAUSE the underlying table has no matching row, not because we invented a default to "make the FE not crash." Empty defaults silently hide migration gaps.

If the legacy code regenerates data on read miss via LLM, the Convex port can return the stored row when present and throw `EXTERNAL_NOT_WIRED` for the regenerate path. It must NOT return a synthetic empty shape and call itself ported.

### R6 — Tenancy gates assert, never trust FE-supplied team_id

Every mutation taking `team_id` / `company_id` from FE input must call `assertCompanyMember(ctx, user._id, teamId, user.legacy_id)` BEFORE any DB write. Reads that return tenant-scoped data the caller might not own get the same gate.

The gate must support both id forms (Convex `_id` AND legacy uuid) until R3 is fully enforced. Once R3 is enforced, the gate can collapse to single-form.

### R7 — Cross-tenant audit before declaring "done"

After every port wave, run a cross-tenant audit (the founder-x pattern: query every table where `(author.user_id) ∈ {convex_id, legacy_id}` AND `(tenant_id) ∉ legit_tenant_ids`). Zero rows = clean. Any row = repair before merging.

### R8 — Read the legacy code BEFORE porting

Speculative ports are forbidden. Every port commit message must reference the legacy source file:line that informed it. If the agent can't find the legacy source, the port pauses — it does not guess.

### Verification at end of every wave

Orchestrator runs:

```bash
# R1 — no AWAITING_PORT outside tests
grep -rn "AWAITING_PORT\|notImplemented" apps/api/convex-out/convex/ \
  --include="*.ts" | grep -v "__tests__\|_admin\|_migrate"
# Expected: 0 matches (function-call usage) — definitions are allowed.

# R2 — every emitted function has a pointer file
node scripts/check-pointer-coverage.mjs

# R3 — no raw uuids in non-legacy_id FK columns
node scripts/audit-fk-shapes.mjs

# R4 — founder_profile.company_id matches PG source
npx convex run _admin/audit_fk_drift:run

# R7 — cross-tenant audit
npx convex run _admin/cross_tenant_audit:run
```

If any check fails, the wave is not complete.

## Tooling source of truth

The upstream converter and all emitter patterns live at:

```
/Users/michaelezehi/Documents/src/__new-world__/convex-converter
```

Key reference paths inside the converter (read these before fighting a pattern):

| Path | What it emits / documents |
|---|---|
| `src/emit/schema/` | `convex/schema.ts` from TypeORM entities |
| `src/emit/auth/` | `convex/_lib/auth.ts` (WorkOS-aware) |
| `src/emit/functions/` | Per-module `query`/`mutation`/`action` stubs |
| `src/emit/http.ts` | `convex/http.ts` from REST controllers |
| `src/emit/crons.ts` | `convex/crons.ts` from `@Cron()` schedulers |
| `src/emit/migrate/` | `_migrate/import.ts` + `_migrate/resolveFks.ts` + `migrate-from-postgres.ts` script |
| `src/transpile/` | GraphQL → Convex type/shape transforms |
| `src/lib/normalise-value.ts` | Postgres value coercion (number/date/bool/JSON-key sanitisation) |
| `README.md` | CLI usage, env, output layout |
| `skill/SKILL.md` | The `/nest2convex` skill (the converter's own skill) |

If you find a pattern you don't recognise in the user's `convex-out/`, search the converter for it — it's emitted from there.

A battle-tested customer of this converter lives at `/Users/michaelezehi/Documents/src/__new-world__/founder-x` (branch `convex-migration`). That repo ran the full playbook this skill describes (35 modules ported, ~97 FE files migrated, 62 schema indexes, 9 🔴 issues caught by reviewer sweeps). Use it as a sanity check when you want to see what "done" looks like — but the converter is the source of truth for emitter patterns, not founder-x.

## What this skill detects and handles

Don't assume any specific source stack — **detect what's actually there, then adapt**. The converter handles the dispatch.

### Backend variants (any one works)

| Framework | Transport | DB | What changes |
|---|---|---|---|
| NestJS | GraphQL (Apollo) | TypeORM + Postgres | The original founder-x case. Resolvers → `query`/`mutation`/`action`. |
| NestJS | REST (`@Controller`) | TypeORM + Postgres | Controllers → `convex/http.ts` route handlers. Skip Phase 7's `gql\`` greps. |
| NestJS | tRPC | any | Procedures → Convex functions. FE migration is router-by-router. |
| NestJS | gRPC / WebSocket (`@Gateway`) | any | Gateways need bespoke handling — leave on the source backend, migrate everything else. |
| Fastify standalone | REST | TypeORM / Prisma / raw pg | Same playbook. Routes → `http.ts`. |
| Express | REST | any | Same playbook. Less framework metadata so the converter emits fewer auto-mappings — expect more manual porting. |
| Mixed (e.g. NestJS with both REST and GraphQL) | both | any | Handle both transports in the FE inventory. |

### Database variants

| Source | Migration story |
|---|---|
| Postgres + TypeORM | Fully supported — converter emits `_migrate/*.ts` + `migrate-from-postgres.ts`. |
| Postgres + Prisma | Converter parses the schema (limited); the data-migration script needs minor adapter changes (use `prisma.<model>.findMany()` instead of raw pg). |
| Postgres + raw pg / Drizzle / Kysely | Adapt the data-migration script — keep the two-phase legacy_id → Id resolution pattern. |
| MySQL / MariaDB | Same playbook; swap the `pg` driver in `migrate-from-postgres.ts` for `mysql2`. |
| MongoDB | Different — Convex schema isn't a 1:1 mapping. Out of scope for this skill; reach for `/mongo-to-convex` (or build it). |
| SQLite | Treat as Postgres with a different driver. |

### Frontend variants

| Client | What to migrate |
|---|---|
| `graphql-request` via codegen client | Strip `gql\`` constants + `getGraphQLClient` imports; swap to `useQuery(api.X.Y)`. |
| Apollo Client | Replace `useQuery`/`useMutation` from `@apollo/client` with the Convex equivalents. ApolloProvider → ConvexProvider. |
| urql | Same shape as Apollo. |
| `fetch('/api/...')` to REST endpoints | Server actions/hooks call `ConvexHttpClient` instead. |
| `tRPC` client | Router-by-router swap. |
| TanStack Query directly hitting the API | Wrap with `useQueryCompat` so the TanStack-shaped surface survives. |

### Auth providers

WorkOS, Clerk, Auth0, custom JWT — the converter detects and emits the right claim readers in `_lib/auth.ts`. Other providers: swap the `readClaims` body manually.

### Detection commands (run these BEFORE adapting the playbook)

```bash
# Backend framework
grep -l '"@nestjs/core"' apps/*/package.json package.json 2>/dev/null
grep -l '"fastify"' apps/*/package.json package.json 2>/dev/null
grep -l '"express"' apps/*/package.json package.json 2>/dev/null

# Transport in use
find apps -name "*.resolver.ts" 2>/dev/null | head -1     # → GraphQL present
find apps -name "*.controller.ts" 2>/dev/null | head -1   # → REST present
grep -rln "createTRPCRouter\|initTRPC" apps/*/src 2>/dev/null | head -3  # → tRPC present
find apps -name "*.gateway.ts" 2>/dev/null | head -1      # → WebSocket present

# Database / ORM
grep -l '"typeorm"' apps/*/package.json package.json 2>/dev/null
grep -l '"@prisma/client"' apps/*/package.json package.json 2>/dev/null
grep -l '"drizzle-orm"' apps/*/package.json package.json 2>/dev/null

# FE GraphQL client (or lack thereof)
grep -l '"@apollo/client"\|"graphql-request"\|"urql"' apps/*/package.json 2>/dev/null
```

**Tell the user what you detected** before running anything. Frame it as discovery, not a blocker. The playbook below uses the union of patterns — you skip the GraphQL bits if there's no GraphQL, skip the REST bits if there's no REST, etc.

## High-level shape

```
Phase 0  Inventory + prerequisites
Phase 1  Run /nest2convex (or verify it's been run) → emit scaffolding
Phase 2  Foundation: _lib/auth + _lib/membership + auth module port
Phase 3  Run data migration: Postgres → Convex (two-phase)
Phase 4  Port backend modules in waves (parallel agents)
Phase 5  Batch-add schema indexes flagged by porting agents
Phase 6  Web FE cutover
Phase 7  Admin (and any other) FE cutover
Phase 8  Three reviewer sweeps: FE runtime, backend security, build health
Phase 9  Delete legacy transport artifacts + push
```

This is **multi-session work** — plan for waves of parallel agents and intermediate commits.

---

## Phase 0 — Inventory

Build the full inventory yourself before dispatching any agent. The single biggest mistake is a too-shallow inventory — common traps:

1. A shim wrapper (`getAuthenticatedClient`, `apiClient`, `serverApi`, `trpc` …) hides every server action that still talks to the legacy backend. Always grep for the SHIM name, not just the transport syntax.
2. Multiple Next.js apps under `apps/` (web + admin + …) each need migrating. Don't forget the admin app.
3. `useEffect`-driven `fetch()` calls to the backend that don't go through TanStack Query.
4. Mixed transports — e.g. a project where most hooks use `graphql-request` but a handful of pages use raw `fetch` to REST endpoints. Phase 0 inventory must cover all transports the project actually uses.

### Backend inventory

```bash
# NestJS modules
find apps/api/src/modules -maxdepth 2 -name "*.module.ts" | xargs -I{} dirname {} | sort -u

# Entity count
find apps/api/src -name "*.entity.ts" | wc -l

# If nest2convex has already run, count unimplemented stubs
grep -r "nest2convex: .* not implemented" apps/api/convex-out/convex --include="*.ts" | grep -v __tests__ | wc -l

# Per-module export counts
for mod in apps/api/convex-out/convex/*.ts; do
  echo "$(basename $mod .ts): $(grep -c '^export const ' $mod)"
done | sort -t: -k2 -rn
```

### Frontend inventory (exhaustive)

```bash
# All apps under apps/
ls apps/

# For each app, find every legacy-backend caller. Run all probes — the union
# is your scope. Don't bail on a transport that isn't there; just record 0.
for app in apps/*/; do
  echo "=== $app ==="
  # GraphQL
  grep -rln "getGraphQLClient\|gql\`\|graphql-request\|@apollo/client\|urql" "$app/src" 2>/dev/null | wc -l
  # REST via fetch/axios to a backend URL
  grep -rln "fetch\(\(.*\?\)\?\(\`\|'\|\"\)https\?://\|axios\.\|baseURL" "$app/src" 2>/dev/null | wc -l
  # tRPC
  grep -rln "trpc\.\|@trpc/client\|createTRPCReact" "$app/src" 2>/dev/null | wc -l
  # Shim wrappers (THE TRAP — name varies per project)
  grep -rln "getAuthenticatedClient\|apiClient\|server-graphql\|serverApi" "$app/src" 2>/dev/null | wc -l
  # Convex callers already present (partial migration?)
  grep -rln "from ['\"]convex/react['\"]\|from ['\"]convex/browser['\"]" "$app/src" 2>/dev/null | wc -l
done

# Categorise by file role per app
for app in apps/*/; do
  echo "=== $app ==="
  find "$app/src/hooks" -name "*.ts" -not -name "*.test.ts" 2>/dev/null | wc -l
  find "$app/src/actions" -name "*.ts" -not -name "*.test.ts" 2>/dev/null | wc -l
done
```

**Tell the user the totals.** Phrase it as detection, not gatekeeping: "I found 27 hooks calling `getGraphQLClient`, 5 server actions using `fetch` to the backend URL, 0 tRPC callers, 1 shim-wrapper (`getAuthenticatedClient`) used by 42 files. Migrating all 79."

Compare against rough expectations (adapt to what you actually find):

| App size | Files to migrate (rough) |
|---|---|
| Small public web | 10-15 hooks + 2-5 actions + 2-5 pages |
| Admin dashboard | 25-50 hooks + 30-70 actions + 5-10 pages |

If an admin app comes back under 30 files **and** has shim wrappers present, the inventory missed the shim consumers. Re-grep against the shim name.

---

## Phase 1 — Run the converter

If `apps/api/convex-out/` doesn't exist yet, or the user wants to re-emit:

```bash
# From the converter directory
cd /Users/michaelezehi/Documents/src/__new-world__/convex-converter
tsx src/cli.ts convert <path-to-user-api> --out <path-to-user-api>/convex-out

# OR if /nest2convex skill is installed
# (Claude Code invokes it)
```

This emits:
- `convex/schema.ts` with every entity as a `defineTable`. **Auto-includes `by_<fk>` indexes on every FK column** (no more 60-index batch fixup).
- `convex/<domain>.ts` with stub `query`/`mutation`/`action` exports throwing `nest2convex: not implemented`
- `convex/_lib/auth.ts` — `requireUser`, `tryUser`, `requireRole`, `requireOrg`, `findUserDoc`, `requireUserDoc`, **`ensureUserDoc`** (idempotent provisioning mirroring NestJS `userService.getOrCreate`), `fullName`. WorkOS / Clerk / Auth0 claims auto-detected.
- `convex/_lib/membership.ts` — `tryCompanyMembership`, `requireCompanyMember`, `requireCompanyAdmin`. Every per-tenant query/mutation should call one of these.
- `convex/_migrate/import.ts` + `convex/_migrate/resolveFks.ts` with per-table bulk inserts and FK resolvers (exported as public `mutation`, not `internalMutation`, so the migration script can call them without admin auth)
- `scripts/migrate-from-postgres.ts` with the two-phase migration runner (value coercion: decimal strings, NUMERIC column-name patterns, both `T` and space-separated ISO timestamps, non-printable JSON key sanitisation)
- `convex/http.ts` + `convex/crons.ts`
- `fe-lib/convex-mutation.ts` — TanStack-shaped `useMutationCompat` / `useActionCompat` adapter for the FE. Copy to your Next.js app's `src/lib/` to localise the GraphQL → Convex swap.
- `fe-lib/convex-server.ts` — server-side `ConvexHttpClient` factory with a TODO for wiring the WorkOS access token via `setAuth()`.
- `__tests__/*.test.ts` shape stubs
- `MIGRATION_REPORT.{md,html}` with the per-tier mapping decisions and AI grades

**Verify the deploy**: `cd convex-out && npx convex dev --once` → "Convex functions ready!". If schema fails to push, that's a column-type drift bug — read the converter's `src/parse/entities.ts` to fix.

---

## Phase 2 — Foundation customisation

The converter now emits a working `_lib/auth.ts` + `_lib/membership.ts` out of the box. Your job in this phase is **only** the bits that depend on the user's specific schema:

### 2a. Audit `_lib/auth.ts` against the user's `users` table

The emitted `ensureUserDoc` assumes columns: `workos_user_id`, `email`, `first_name`, `last_name`, `profile_picture_url`, `role`, `email_verified`, `updated_at`, `metadata`. If the user's `users` table uses different column names (e.g. `display_name` instead of `first_name`/`last_name`), adjust the insert payload + patch object.

Verify the emitted `readClaims` function actually reads the claims your auth provider puts on the JWT. Some WorkOS JWT templates omit `picture` — check `apps/api/src/auth/**` to see what claims the NestJS guard was reading.

### 2b. Audit `_lib/membership.ts` against the user's `memberships` schema

The emitted helpers assume:
- A `memberships` table with `user_id`, `company_id`, `role`, `removed_at` columns
- Indexes `by_user_id_company_id` and `by_company_id`
- Role strings like `'owner'`/`'OWNER'`/`'admin'`/`'ADMIN'`

If the table is called `team_memberships` or the FK is `team_id` instead of `company_id`, rename throughout. If your roles use a different enum, update `requireCompanyAdmin`.

### 2c. Port the auth module yourself

This is the canonical reference every other agent reads. Don't delegate this — set the patterns:

- `getCurrentUser` (query) returns `null` on no-identity / no-row. Shape: `{ id, email, fullName, firstName, lastName, role, profile_picture_url, emailVerified, founderProfile: { id, company: { id, name } | null } | null }` (camelCase keys the FE consumes).
- `ensureUser` (mutation) calls `ensureUserDoc(ctx)` and returns the same shape.
- `updateMyProfile` (mutation) patches the row.
- `updatePendingUserEmail` (mutation) for pending placeholder rows.
- External-API stubs (`createAccountWithPassword`, `requestPasswordReset`, `resendVerificationEmail`) throw `ConvexError({ code: 'NOT_IMPLEMENTED', reason: 'Use /api/auth/<route> in the web app instead.' })` — never silently succeed.

Verify: `npx convex dev --once` clean, then commit.

### 2d. Minimum index set (for the data migration)

Before running the data import, add:
- `users.by_email`, `users.by_workos_user_id`, `users.by_legacy_id`
- `founder_profiles.by_user_id`, `founder_profiles.by_company_id`, `founder_profiles.by_legacy_id`
- `memberships.by_company_id`, `memberships.by_user_id_company_id`

The full 60+ index batch comes in Phase 5 after the agents flag what they need.

---

## Phase 3 — Data migration

The converter emits the script. **Promote `_migrate/*.ts` exports from `internalMutation` to `mutation`** before running — the script uses `ConvexHttpClient` without admin auth.

```bash
sed -i '' 's/internalMutation/mutation/g' apps/api/convex-out/convex/_migrate/*.ts
cd apps/api/convex-out
pnpm migrate:from-pg  # runs scripts/migrate-from-postgres.ts
```

Two phases:
1. Phase 1: insert every row with original `legacy_id` preserved. FK columns hold legacy_id strings.
2. Phase 2: `resolveFks_<table>` mutations walk FK columns and rewrite each legacy_id → Convex `Id<T>`.

### Value coercion (already in the converter's `lib/normalise-value.ts` — verify it handles these)

```ts
// Decimal strings (BIGINT/NUMERIC/DECIMAL from pg)
if (/^-?\d+\.\d+$/.test(v) && Number.isFinite(Number(v))) return Number(v);

// Integer-shaped strings ONLY for known numeric column names
const NUMERIC_COL_RE = /(^|_)(amount|count|price|value|year|number|total|sum|qty|...)($|_)/;
if (colName && NUMERIC_COL_RE.test(colName) && /^-?\d+$/.test(v)) return Number(v);

// Boolean string survivors
if (v === 'true') return true;
if (v === 'false') return false;
if (colName && BOOL_COL_RE.test(colName)) {
  if (v === 't' || v === '1') return true;
  if (v === 'f' || v === '0') return false;
}

// Postgres timestamps (BOTH "T" and space separators)
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2}?)?$/;
if (ISO_DATETIME_RE.test(v)) return Date.parse(v);

// Non-printable chars in JSON keys — sanitise
function sanitiseKey(key) { /* replace [^0x20-0x7e] with '_' */ }
```

If the converter is missing any of these, patch it in `src/lib/normalise-value.ts` so the next customer gets it for free.

### Verification

The converter emits `convex/_migrate/counts.ts` exporting `countAll(tables)`. Call it post-migration and compare per-table row counts against pg `SELECT COUNT(*)`:

```bash
cd apps/api/convex-out
npx convex run _migrate/counts:countAll '{"tables":["users","companies","founder_profiles",...]}'
```

After data is verified, delete `_migrate/` entirely. It's a one-shot.

---

## Phase 4 — Port backend modules in waves

**Wave playbook**: one agent per module (one file = no merge conflicts), 6-8 agents in parallel per wave.

### Wave structure (replicate)

| Wave | Modules | Notes |
|---|---|---|
| 0 | `auth` | You do this in Phase 2, not an agent. |
| 1 | small/simple modules (gamification, onboarding, membership) | Validates the pattern. |
| 2 | FE-consumed core (billing, equity, workflow) | Largest workload. Agents will split files. |
| 3 | FE-consumed extras (professionals, coach_workspace) | Heavy stubs but few FE-blocking surfaces. |
| 4 | small admin/internal (health, leads, notes, referral, reviews, video, jtbd_research) | Many low-stake. |
| 5 | medium admin/internal (availability, blueprint, blueprint_report, burnout_index, companies, decisions, invitations) | Some modules huge — expect slices. |
| 6 | collaboration + remaining (collaborative_documents, conversation_notes, crm, human_dd, insight_chat, market_intelligence, protocol_personalization) | |
| 7 | admin/VC final (authadmin, djana_bridge, management_dashboard, moderation, teams, vc_dashboard) | vc_dashboard 43 exports — needs slices. |

Adapt to the actual modules in the user's project. The structure (FE-consumed first → admin/internal last) is what matters.

### Canonical agent briefing template

Fill `<MODULE>`, `<FE_FUNCTIONS>`, `<ABSOLUTE_PATH>`:

```
Port one Convex module from its NestJS source, 1:1 in behavior.

## Project context
- Repo root: <ABSOLUTE_PATH>
- NestJS source: apps/api/src/modules/<MODULE>/ (resolvers + services + entities)
- Convex stub to rewrite: apps/api/convex-out/convex/<MODULE>.ts
- Tests: apps/api/convex-out/convex/__tests__/<MODULE>.test.ts

## Read first — these set the pattern
- apps/api/convex-out/convex/auth.ts — canonical port pattern (query vs mutation vs action, snake_case columns, camelCase returns, ConvexError shapes)
- apps/api/convex-out/convex/_lib/auth.ts — helpers (requireUser, requireUserDoc, ensureUserDoc, tryUser, findUserDoc)
- apps/api/convex-out/convex/_lib/membership.ts — per-company gates (tryCompanyMembership, requireCompanyMember, requireCompanyAdmin)
- Converter source of truth (read it if you hit a pattern you don't understand):
  /Users/michaelezehi/Documents/src/__new-world__/convex-converter/src/emit/

## Priority functions (FE consumes these, port first)
<FE_FUNCTIONS — one line each: "fn(args) — what it returns, mutation/query/action">

## Other exports
Port these too, from the legacy source. Read the legacy file before writing each one and cite its file:line in the pointer file.
Every function gets a pointer file at apps/api/convex-out/convex/_legacy/<MODULE>/<fn>.md (source path, verbatim legacy body, external boundaries, legacy guard).
Only a sharp external call (LLM, Stripe, email, calendar, S3 presign) may throw EXTERNAL_NOT_WIRED, with the local persistence and validation ported.
If you cannot finish a port, throw ConvexError({ code: 'AWAITING_PORT', module, fn, legacy_source }) and list it in your summary. Never silently succeed or return mock data.

## Rules
1. snake_case Convex columns (match schema.ts exactly); camelCase return shapes when FE expects them. Adapt at function return boundary.
2. Use indexes: no .filter() without .withIndex(). Missing index? Report it in your summary and use a .filter() fallback. Do not edit schema.ts; other agents share it and Phase 5 adds indexes in one pass.
3. Auth: every per-user/per-company function calls requireUserDoc or the membership gate. Never trust an FE-supplied user_id as caller identity; derive it from requireUserDoc(ctx).user._id server-side.
4. Per-company access: any function taking companyId/teamId must call requireCompanyMember(ctx, companyId).
5. File size ≤ 600 lines. If <MODULE>.ts grows larger, extract slices into <MODULE>/{queries,mutations,actions,_shared}.ts and turn <MODULE>.ts into a re-export barrel.
6. External APIs (Stripe, WorkOS, OpenAI, etc.) → action() wrapping process.env.X_KEY. Missing key → throw ConvexError({ code: 'X_NOT_CONFIGURED' }), NOT 'NOT_IMPLEMENTED'.
7. Validate with: cd apps/api/convex-out && npx convex dev --once. Must report "Convex functions ready!". Fix any errors before reporting.
8. Touch only the module file(s) + its __tests__ file.
9. No git commands.

## Return summary (the orchestrator merges many of these, so keep it tight)
- Implemented functions: one line each. Any AWAITING_PORT left, with the reason.
- Schema gaps: missing indexes, missing columns, FK type mismatches. List by table.
- External integrations stubbed with explanation.
- File structure if you split.
- Deploy result.
- **Converter bugs spotted** (REQUIRED FIELD): any emit-time bug that broke your port (reserved-word identifiers, malformed comments, wrong validator types, duplicate exports, failed name resolution, etc.). Include the symptom + the converter source file you'd patch. Empty list is fine — just say "none."
```

### Self-improvement loop (do this between waves)

When a wave returns any non-empty "Converter bugs spotted" sections, start a background patch agent on the converter as you dispatch the next wave. Briefing and rules: "Feeding learnings back upstream" at the bottom of this file.

### Parallel-deploy hazard

All agents push to the same Convex deployment via `npx convex dev --once`. If one writes invalid TS, the whole deploy fails for everyone. Mitigation: each agent fixes their own file before reporting. If you see persistent failures, fall back to `--typecheck=disable` and audit module-by-module after.

---

## Phase 5 — Batch schema indexes

After all waves land, **one agent** adds every flagged index in a single `schema.ts` commit.

Briefing template:

```
Add ~50-60 schema indexes that the porting agents flagged. Single coordinated pass on apps/api/convex-out/convex/schema.ts.

For each: locate the matching defineTable(...) block, append .index('by_X', ['col']) to its chain. Skip indexes that already exist (idempotent). If a column doesn't exist on the table, skip that index and log it.

After: run cd apps/api/convex-out && npx convex dev --once. Must complete with "Convex functions ready!" — the schema deploy back-fills indexes so it takes longer than usual but should still succeed.

<LIST: every index by table name + column array, taken from prior agent reports>
```

---

## Phase 6 — Web FE cutover

### 6a. Convex client + lib helpers

Create these in `apps/web/src/lib/` (copy patterns from the converter's `src/emit/web/` if it has FE emitters, or write fresh):

- `convex.ts` — `api` runtime export via `anyApi`
- `convex-mutation.ts` — `useMutationCompat` adapter exposing `{ mutate, mutateAsync, isPending, isError, error, reset }` (TanStack-shaped) over Convex's bare-function `useMutation`
- `convex-server.ts` — `getServerConvexClient()` returning a `ConvexHttpClient` with WorkOS session forwarded via `setAuth()` (for server actions + API routes)
- `app/convex-provider.tsx` — mounts `ConvexProvider` with a client built from `NEXT_PUBLIC_CONVEX_URL`

Build `useMutationCompat` before migrating hooks. Without it you'd touch 100+ downstream call sites; the adapter localises the swap.

### 6b. `useCurrentUser` is foundational — do it first

```ts
const meQuery = useQuery(api.auth.getCurrentUser, {});
const ensureMutation = useConvexMutation(api.auth.ensureUser);
const ensureRunRef = useRef(false);
useEffect(() => {
  if (!ensureRunRef.current && meQuery !== null && /* user appears authenticated */) {
    ensureRunRef.current = true;
    ensureMutation({}).catch(() => { ensureRunRef.current = false; });
  }
}, [meQuery]);
```

### 6c. Hook migration

For hooks already using `useQuery(api.X.Y)`:
- Strip dead transport-specific constants (`gql\`` templates, tRPC procedure paths, REST URL helpers)
- Strip the legacy client import (`getGraphQLClient`, `apiClient`, `trpc`, etc.)
- Strip TS interfaces that only typed the legacy response (keep types still exported to other modules)

For hooks still on the legacy client + TanStack Query:
- Swap to `useQuery(api.X.Y, args)` / `useMutation(api.X.Y)` from `@/lib/convex-mutation`
- Use `'skip'` (not `undefined`) when args aren't ready

Per-transport swap recipe:

| If the hook uses … | Replace with |
|---|---|
| `graphql-request` `client.request(GQL, vars)` | `useQuery(api.X.Y, vars)` (or `await convexHttp.query(api.X.Y, vars)` server-side) |
| `@apollo/client` `useQuery(GQL_DOC)` | `useQuery(api.X.Y, vars)` from `convex/react` |
| `trpc.foo.bar.useQuery(input)` | `useQuery(api.foo.bar, input)` |
| `fetch('/api/foo', { method, body })` to the legacy backend | `useMutation(api.foo)` or `convexHttp.action(api.foo, body)` |
| `axios.get('/api/foo')` | Same as fetch |

### 6d. Server actions + pages

- Server actions: `getServerConvexClient()` → `client.query/mutation/action(api.X.Y, args)`
- Pages with direct legacy calls (gql / fetch / trpc): convert to Convex hooks

### 6e. Final cleanup

Run the same legacy-caller grep from Phase 0 against `apps/web/src` — all counters should be 0. Then:

```bash
# Whichever of these the project had — only delete what existed
rm apps/web/src/lib/apiClient.ts                  # if GraphQL/REST client wrapper
rm apps/web/src/lib/trpc.ts                       # if tRPC client setup
# rm apps/web/src/utils/api.ts                    # alternate tRPC location

# Remove legacy helpers from lib files (whichever apply)
# - getGraphQLEndpoint  → delete the function
# - tRPC router type imports → delete if no callers remain
# - REST endpoint URL constants → delete

# Edit apps/web/package.json — remove WHICHEVER of these deps remain unimported:
#   @<org>/api-client, graphql, graphql-request, @apollo/client,
#   @trpc/client, @trpc/react-query, @trpc/server, urql, axios (if unused)

# Edit apps/web/next.config.ts — remove the legacy package from transpilePackages

# Edit apps/web/.env.example — add NEXT_PUBLIC_CONVEX_URL; remove NEXT_PUBLIC_API_URL if obsolete

# Edit apps/web/CLAUDE.md — update data-flow narrative to Convex
```

For every removal, run a grep first to confirm zero remaining imports. Don't blanket-remove a dep that something else still uses.

---

## Phase 7 — Admin (and other) FE cutover

Admin apps are where inventories come up short, so re-inventory before declaring done.

### 7a. Re-inventory (the shim trap)

Run the same multi-transport inventory from Phase 0 against `apps/admin/src` (replace `apps/web/src`). The trap to watch for: a project-specific shim wrapper that hides legacy-backend callers behind a single function name. Common shim names to grep for:

```bash
# Generic wrappers — name varies per project, grep for what your codebase uses
grep -rln "getAuthenticatedClient\|getApiClient\|getServerApi\|apiClient\b" apps/admin/src
# Direct legacy client (whichever your project uses)
grep -rln "getGraphQLClient\|graphql-request\|@apollo/client\|urql" apps/admin/src
grep -rln "createTRPCProxyClient\|trpc\." apps/admin/src
grep -rln "axios\.\|fetch\(\(.*\?\)\?\(\`\|'\|\"\)https\?://" apps/admin/src
# Transport-specific syntax
grep -rln "gql\`" apps/admin/src
```

Union of these = your scope. Often 80-100 files in a mature admin app. **If a count looks suspiciously low, your project probably has a shim wrapper with a unique name** — open one of the admin's server actions and read its imports to find it.

### 7b. Mirror lib helpers

Copy `convex.ts`, `convex-mutation.ts`, `convex-query.ts`, `convex-server.ts` from web to `apps/admin/src/lib/`. Same code.

### 7c. Wave-based dispatch by domain

Group files by domain (auth, billing, equity, decisions, blueprint, burnout, CRM, professionals, coach, VC, …). Dispatch 6-8 agents per wave, 7-14 waves total depending on app size.

### 7d. NOT_IMPLEMENTED handling on FE

When an admin surface calls a Convex function that throws `NOT_IMPLEMENTED`, the page would crash. Three patterns:

1. **Server action**: try/catch, return soft-fail (`{success:false, message:'Not yet implemented'}`).
2. **Page with `useQuery`**: wrap in React error boundary rendering a friendly empty state.
3. **Mutation in form**: catch rejection, surface error banner.

Do NOT silently fake success. Each soft-fail must include a `TODO(convex-migration): <module>.<fn>` comment so future devs can find them.

### 7e. Test file mocks

Tests that previously mocked the legacy client (e.g. `@/lib/apiClient`, `@/lib/trpc`, `vi.mock('graphql-request')`) now mock `convex/react` (for hooks) or `@/lib/convex-server` (for server actions). For tests that asserted transport-specific strings (`expect.stringContaining('mutation Foo')`, `expect(client.query).toHaveBeenCalledWith({ path: 'foo.bar', ... })`), wrap `describe` in `.skip` with TODO — full rewrite is out of scope.

### 7f. Delete the shim + legacy client

When the legacy-caller grep returns 0 hits (excluding tests):

```bash
# Delete whichever shim files your project had — verify each exists first
rm apps/admin/src/actions/auth.ts            # if there's an auth shim
rm apps/admin/src/lib/apiClient.ts           # if there's a GraphQL/REST client wrapper
rm apps/admin/src/lib/server-graphql.ts      # if there's a server-side GraphQL helper
rm apps/admin/src/lib/trpc.ts                # if there's a tRPC client setup
rm apps/admin/src/utils/api.ts               # alternate tRPC location

# Edit apps/admin/package.json — remove WHICHEVER of these deps remain unimported:
#   @<org>/api-client, graphql, graphql-request, @apollo/client,
#   @trpc/client, @trpc/react-query, @trpc/server, urql, axios (if unused)
```

Grep first; remove only what's actually unused now.

---

## Phase 8 — Three reviewer sweeps

Run all three. This is where the real defects surface; the 8b audit has caught auth bypasses that 8+ porting agents missed.

### 8a. FE runtime audit

Dispatch a `Code Reviewer` agent against the FE work. Focus:
- Every `api.X.Y` resolves to a real Convex export (anyApi types pass typos)
- NOT_IMPLEMENTED calls don't crash the page (error boundaries in place)
- `useMutation` vs `useAction` — actions called via `useMutation` reject at runtime
- File-upload-style hooks calling Convex `action()` need `useAction`, not the mutation wrapper

### 8b. Backend security + correctness audit

Dispatch a `Code Reviewer` agent against the backend ports. Focus:
- **FE-supplied identity bypass**: any mutation taking `user_id: v.string()` and using it as caller identity → bypass. Authoritative identity must derive from `requireUserDoc(ctx).user._id`.
- **Cross-tenant leak**: any function taking `companyId/teamId` without `requireCompanyMember(ctx, companyId)` → leak.
- N+1 query loops (`await` inside `.map` without `Promise.all`)
- Missing `.withIndex` on hot paths
- Race conditions on signing/accepting/transferring ownership
- `internalMutation` vs `mutation` boundaries (cron-callable should be internal)

### 8c. Build health + api-path resolution

Dispatch a third `Code Reviewer` agent. Focus:
- Grep every `api.X.Y` in the FE, cross-check against actual Convex exports
- `convex dev --once` clean
- `pnpm typecheck` on every app — compare to pre-migration baseline
- `NEXT_PUBLIC_CONVEX_URL` in `.env.example`
- `transpilePackages` no longer lists deleted `@<org>/api-client`
- Convex env vars referenced via `process.env.X` — list which need `npx convex env set X`

---

## Phase 9 — Pre-deletion parity check, then delete + push

### 9a. Mandatory parity check before any `rm -rf` of legacy code

**Do NOT delete anything in `apps/api/src/modules/` (or wherever the legacy backend lives) until this gate passes.** A backup proves retrievability; parity proves correctness. Deletion without parity is how migrations regress weeks of work.

For each legacy module slated for deletion, dispatch a **Senior Architect** or **Backend Architect** agent with this briefing:

```
You are a parity reviewer. The team is about to delete legacy NestJS module
<MODULE> at apps/api/src/modules/<MODULE>/ now that it has been ported to
Convex. Your job: produce a function-level parity report. The deletion is
gated on a clean report.

## Method
For every public surface in the legacy module — every @Controller method,
every @Resolver query/mutation, every public service method called from
guards or external modules — locate the corresponding Convex export and
read both implementations side-by-side. For each pair, mark one of:

- match — Convex impl matches legacy behavior end-to-end.
- drift — Convex impl exists but diverges (different validation, missing
  side effect, wrong auth gate, wrong return shape).
- missing — legacy surface has no Convex equivalent.
- external — legacy depended on an external service (LLM, Stripe, email,
  calendar) and the Convex port correctly throws EXTERNAL_NOT_WIRED with
  a pointer file at apps/api/convex-out/convex/_legacy/<module>/<fn>.md.

For drift/missing/external, cite both file:line on the legacy side and on
the Convex side. For external, also confirm the pointer file exists.

## Specific checks for each pair
- Argument shape: legacy DTO (class-validator decorators) vs Convex
  `v.object({...})` validator. Optional/required, nullable, enum members.
- Auth gate: legacy @UseGuards(JwtAuthGuard) + @Roles + custom decorators
  vs Convex requireUserDoc / requireCompanyMember / requireRole. The
  Convex gate must be at least as strict.
- Side effects: DB writes, queue enqueues (Bull → Convex cron/action),
  email sends (Resend SDK), event emissions. Each side effect in the
  legacy must have an equivalent on the Convex side (or be marked
  external with a pointer file).
- Error paths: legacy throws NotFoundException/UnauthorizedException/etc.
  Convex throws ConvexError({ code, ... }). The codes must convey the
  same intent.
- Return shape: every key the FE reads from the legacy GraphQL/REST
  response must be present in the Convex return value (snake_case vs
  camelCase boundary adapt is fine).

## Output
A markdown report at `_parity/<module>.md` with a status table. Bottom
line: GREEN (safe to delete) or RED (deletion blocked, fix list).

## Rules
- Read every file in apps/api/src/modules/<MODULE>/ that has public
  surface — controllers, resolvers, services, guards.
- Read every Convex file that re-exports from that module's slice
  (apps/api/convex-out/convex/<MODULE>.ts and any sub-modules).
- Citations are mandatory: every status row has at least one file:line
  on each side.
- No assumptions. If you can't find the Convex equivalent of a legacy
  surface, that's `missing` — not "probably ported somewhere."
- The report is for a human reviewer who will decide GREEN/RED — but
  recommend a status at the bottom based on the rows.
```

Run one parity agent per legacy module. They are read-only and parallelisable.

The agent's report goes to `_parity/<module>.md`. The user reviews. Only after every module's report is GREEN do you proceed to 9b.

### 9b. Delete + push (only after every parity report is GREEN)

```bash
# Final verification — extend the grep to whichever transports the project had.
# Only assert 0 for transports that were actually present.
grep -rn \
  "getGraphQLClient\|getAuthenticatedClient\|server-graphql\|graphql-request\|@apollo/client\|createTRPCProxyClient\|createTRPCReact" \
  apps/*/src --include="*.ts" --include="*.tsx" | grep -v "\.test\."
# → 0 hits for transports present in the project

cd apps/api/convex-out && npx convex dev --once
# → "Convex functions ready!"

# Typecheck every Next.js app under apps/
for app in apps/*/; do
  pnpm --filter="@$(basename $(dirname $app))/$(basename $app)" typecheck 2>&1 | tail -5
done

# Delete the legacy workspace package(s) — only those that existed
rm -rf packages/api-client       # GraphQL codegen client
rm -rf packages/trpc-router      # tRPC router shared package
# Edit root pnpm-workspace.yaml + tsconfig.json if needed to drop references

# Final commit, message adapted to what actually shipped. Pass the paths this
# migration owns; never `git add -A` on a branch other agents share.
git commit -m "feat: complete Convex migration (X modules, Y FE files, Z indexes)" -- <the migration paths>
git push origin <migration-branch>
```

Open items requiring user action (can't be automated — need secrets):
- `npx convex env list` — verify provider keys are set (whichever the project uses: Stripe / WorkOS / Clerk / Auth0 / Google / Resend / OpenAI / Anthropic / …)
- `pnpm install` — refresh lockfile after dep removals
- Smoke test the running app

---

## Pitfalls — read before starting

1. **Shallow inventory** — grep for one transport only (just `gql\``, or just `trpc.`, or just `fetch(`). Misses shim wrappers AND mixed-transport projects. Run all probes from Phase 0; the union is your scope.

2. **FE migration without backend** — backend stubs all throw `NOT_IMPLEMENTED`. Backend first, then FE.

3. **`useMutation` for an `action()`** — Convex's `useMutation` only accepts mutation refs. Use `useAction` for actions.

4. **FE-supplied `user_id`.** The most common security bug in these ports (R6, 8b). The arg can stay for legacy compat but the handler ignores it and derives identity from `requireUserDoc(ctx).user._id`.

5. **Cross-tenant reads** — any function taking `companyId`/`teamId` without `requireCompanyMember(ctx, companyId)` is a data leak.

6. **Action's `process.env.X` missing** — actions reading `process.env.STRIPE_SECRET_KEY` fail silently in prod if env isn't set on Convex. Throw `STRIPE_NOT_CONFIGURED` not `NOT_IMPLEMENTED` so the FE can surface a useful message.

7. **`internalMutation` from cron** — agents sometimes make cron targets public `mutation`. Cron-callable paths should be `internalMutation`/`internalAction`. Verify via `convex/crons.ts` references.

8. **Numeric pg values come as strings** — BIGINT/NUMERIC/DECIMAL return as strings. `normaliseValue` must coerce. Patch the converter if it misses this.

9. **Convex `id` columns vs string FKs** — `convex/schema.ts` may declare `v.union(v.id('users'), v.string())` for legacy IDs. `ctx.db.get(idString)` throws on legacy strings — catch + filter fallback.

10. **Soft-delete leaks** — tables with `removed_at`/`deleted_at`: reads filter them out. Easy to miss.

11. **`api.someTypo.foo` typo at runtime** — `anyApi` makes typos compile clean. Cross-check every `api.X.Y` against real Convex exports during reviewer sweep.

12. **`'use server'` files** — Next.js server-action files can only export `async` functions. Need to share types? Extract to a sibling non-server file (e.g. `<action>-types.ts`).

13. **Hooks that auto-commit your work** — some users have git hooks committing on tool calls. If you see commits you didn't make, it's the hook. Coordinate by committing intentionally yourself; don't fight it.

14. **Transport-shape tests** — tests asserting `expect.stringContaining('mutation X')`, `expect(client.query).toHaveBeenCalledWith({ path: 'foo.bar' })`, or any other legacy-transport syntax. Skip with TODO; don't try to rewrite during migration.

15. **One agent per module file** — agents touching shared files (`schema.ts`, `package.json`, `lib/convex.ts`) must run sequentially. Parallelism only works on disjoint file sets.

---

## When you're done

You finish only after:

1. `npx convex dev --once` → "Convex functions ready!" with all modules registered.
2. The multi-transport legacy-caller grep returns 0 hits across `apps/*/src` (excluding tests) for whichever transports the project had — GraphQL clients, tRPC clients, REST shims, and any project-specific wrapper.
3. Every Next.js app under `apps/` typechecks with no new errors vs baseline.
4. All three reviewer sweeps landed clean.
5. Security tests added (`apps/api/convex-out/convex/__tests__/security.test.ts` covering auth bypass + cross-tenant gates).
6. The migration branch is pushed with a final tally commit (modules ported, indexes added, FE files migrated, security issues fixed).
7. A clear checklist printed for the user: env vars to set via `npx convex env set`, lockfile refresh, smoke test plan.

Compiling files are not the finish line. The success criterion is "every FE surface either calls a real Convex export or degrades gracefully with a TODO". Verify it with grep, typecheck, and a brief smoke test.

## Feeding learnings back upstream — self-improvement loop

Every run of this skill patches the converter for the emit bugs it finds. Hand-fixing 65 emitted files in one customer's `convex-out/` and walking away leaves the next customer hitting the same 65 bugs.

### The rule for porting waves (Phase 4)

Every porting agent's summary has a "converter bugs spotted" section. When a wave returns any, dispatch a patch agent in the background (`run_in_background: true`) while the next porting wave runs, rather than saving the fixes for the end of the migration.

Patch-agent briefing template:

```
Patch the nest2convex converter for N emit bugs discovered during a live migration run.

- Converter repo: /Users/michaelezehi/Documents/src/__new-world__/convex-converter
- Read first: src/map/functions.ts (function name emit), src/emit/ (file emit), src/parse/entities.ts (schema parsing), src/transpile/ (LLM transform).
- Test pattern: `pnpm test` (vitest). Build: `pnpm build`.
- Before editing, check `git status`: the user may have other in-flight changes. Leave uncommitted files alone unless they're part of your patch.

## The bugs (one block per bug)
### Bug N: <one-line title>
- Symptom: <what the customer hit in their convex-out/>
- Source location: <which converter source file likely emits this>
- Suggested fix: <what to do, specifically>

## Done when
- Each bug is patched with the minimum set of files, with a vitest test per bug where test infrastructure exists.
- `pnpm build` and `pnpm test` pass.
- Nothing committed. Report a per-bug summary with file:line refs.
```

### Post-mortems and the upstream backlog

Two customer runs (founder-x: 35 modules + web + admin; x-unframed: 65 modules, REST, no `users` table, 1023 stubs) fed patches back into the converter — auth helpers, membership gates, auto FK indexes, FE compat hooks, value coercion, reserved-word renames, DTO validators and more. Before hand-patching an emit bug, read `references/post-mortems.md` to see whether the converter already emits the fix.

Nine emitter gaps remain open (auto tenancy gates, FE-supplied `user_id` warnings, `internalMutation` detection, soft-delete-aware reads, env-missing throws, shim-trap scanner, test scaffold upgrades, no-`users`-table identity, oversize-file splitting). If you hit one and patch it in the user's project, also patch the converter — the list is in `references/patterns-not-emitted.md`.
