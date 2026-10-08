# e2e-smoke-test — reference

Read from [SKILL.md](SKILL.md). Do not copy another product's catalog; discover the host.

## Search globs

Run these against the host (ripgrep). Collect ids from hits; do not ask the user.

```
capabilities.ts
PLATFORM_ROLES|USER_ROLES|UserRole
ROLE_IMPLICATIONS|CAPABILITY_ROLES|capabilityRoles
memberRoles|memberships\.role
defaultOnboardingPathForRole|postAuthRedirect|onboardingPath
EMPLOYER_TABS|TALENT_TABS|shellTabs|build.*Tabs
RouteRoleGuard|requireRole|roleHasCapability
v\.literal\("(admin|employer|job-seeker|member|owner)
```

Also open:

- App Router / Pages `app/` and `pages/` for route pathnames
- Middleware matchers
- i18n routing config — emit the pathname QA types, not `https://host/...`

## Hard rule — forward-facing only

Map **only** public-facing / customer-facing roles and user flows.

**Skip** (never in `roles[]`, never as catalog modules): `admin`, `super-admin`, `platform-admin`, `internal-ops`, and any staff-only CRM / ops / back-office surface.

**Never emit** modules like `admin.crm` or titles like "Admin CRM".

Host `/admin` (and staff CRM) — skipped (not public-facing). Do not catalog them.

| Drop | Keep |
|---|---|
| `admin`, `super-admin`, `platform-admin` | `job-seeker`, `graduate`, `employer` |
| `internal-ops`, `staff-console` | `referral-partner` / `partner` (canonicalise) |
| Product `/admin` console modules | `public` (unauthenticated) |
| Staff-only CRM / ops (`admin.crm`, "Admin CRM") | Company HR: `hr-staff`, `hr-recruiter`, `hr-it`, `hr-employee` |
| Capability `admin.console` as a smoked persona | Employer workspace smoked as `employer` |

Company seat `admin` / `owner` that uses the **customer** HR/ATS workspace → fold into `hr-staff` or `employer`. Do not emit a platform console module.

If `ROLE_IMPLICATIONS.employer` includes `admin`: catalog role is `employer` only. Employer modules cover the inherited surface.

## Module id convention

`{persona}.{surface}` — `job-seeker.dashboard`, `employer.post-job`, `public.open-jobs`, `hr-employee.time-off`.

Shared shell (graduate uses job-seeker nav): still a graduate P0 module that asserts those destinations load for graduate, or list both roles on the shared module (`"roles": ["job-seeker", "graduate"]`).

## Item patterns

**Onboarding** (one module, coarse):

- `register` — account / wizard starts
- `photo` — only if the product has a photo step; usually `required: false` + `requiredWhen`
- `required-fields` — fill required information through to the end (name the critical fields in `assert`, not as separate items)
- `backend` — capability writes succeed for this role

**Everything else:**

- `loads` — route renders, no console error, not 404
- Primary action — `create`, `save`, `send`, `apply`, `publish`, `invite`
- `backend` — queries succeed; FORBIDDEN for the wrong role when that is a real gate
- Optional: `own-only` when the surface must not leak another user's rows

`assert` describes Yes (working). Leave it off only when the title is already that sentence.

## Priority heuristics

| `p0` | `p1` | `p2` |
|---|---|---|
| Login, register, onboarding | Account settings | Flagged-off / experimental |
| Each primary nav href | Secondary / deep links | Known stubs |
| Create/publish/apply/pay | Optional photo | |
| Capability write for that role | | |

## Pathnames

- `/dashboard`, `/open-jobs/[slug]`, `/me/overview`
- Not `https://staging.unframed.com/dashboard`
- Not `app.example.com/jobs`
- i18n: prefer `/jobs` if the locale is a prefix rewrite; use `/en/jobs` only when that is the real shipped path

## Envelopes Optics accepts

1. One module object
2. `{ "modules": [ ... ] }` ← **write this**, plus `roles` and optional `productApp`
3. A raw array of modules

If `$schema` is present it must be the v1 schema URL. Customer hosts: **omit** `$schema`.

## Validation checklist

- [ ] `roles[]` has no admin / super-admin / platform-admin / internal-ops / staff-console
- [ ] No module id `admin.*`, no `admin.crm`, no title "Admin CRM"
- [ ] Every module `roles[]` entry exists in catalog `roles[]`
- [ ] Every catalog role has ≥1 `priority: "p0"` module
- [ ] Module and item `id` match `[a-z0-9][a-z0-9.-]*`
- [ ] Every module has ≥1 item
- [ ] `entry.route` values are pathnames (start with `/`, no `://`)
- [ ] Onboarding: register + required-fields (+ photo if any) — not per-step items
- [ ] Features: loads + primary action + backend when a gate exists
- [ ] No `result` / Yes / No on items
- [ ] No customer catalog written into Optics `apps/` or `packages/`
- [ ] File is `"_r&d/qa/smoke-checklist.json"` (quoted in shell)

## Output location

Host project root:

```bash
mkdir -p "_r&d/qa"
# write "_r&d/qa/smoke-checklist.json"
```

Unframed: that default file is ATS + public. HR is a holding file `"_r&d/qa/smoke-checklist-hr.json"` — `pnpm smoke:e2e` does not read it unless `--catalog`.

Optics imports this JSON; it does not ship it.

## Run env (agents)

Quote `"_r&d/qa/smoke-checklist.json"` and `"_r&d/qa/smoke-runner.config.ts"`.

```
SMOKE_BASE_URL=https://staging.example.com
SMOKE_USER_JOB_SEEKER=…
SMOKE_PASS_JOB_SEEKER=…
# repeat per catalog role; never admin
OPTIC_KEY=sk_…
OPTIC_ENDPOINT=https://app.optics.example
OPTIC_RELEASE_ID=…          # or pass --create-draft-release
SMOKE_ALLOW_WRITES=          # empty on prod
```

Host command: `pnpm smoke:e2e -- --priority p0`

Kind table: `loads` / unknown+route → navigate; `backend` / `own-only` / `authz` → authz; `lands` → land; write verbs → host adapter or **blocked** `no-adapter` (never silent pass). Default run excludes write kinds from scope.

