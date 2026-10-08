---
name: e2e-smoke-test
description: >-
  Generates an Optics smoke-checklist-v1 JSON catalog of forward-facing /
  public-facing roles and user-flow modules only. Discovers roles from code
  (capabilities.ts, USER_ROLES, memberships.role, nav role filters). Hard skip:
  admin, super-admin, platform-admin, internal-ops, staff CRM/ops (never emit
  admin.crm or "Admin CRM"). Writes "_r&d/qa/smoke-checklist.json". Use when the
  user says e2e smoke test, smoke checklist, map features for QA smoke, generate
  a smoke-test JSON catalog, run e2e, run smoke, or automate the smoke catalog.
argument-hint: "[host project path]"
---
# e2e-smoke-test — smoke-checklist JSON catalog

When invoked on a project, map its **forward-facing / public-facing** roles
and user flows, discover those roles from code (do not ask the user for a
role list), and write an Optics **smoke-checklist-v1** catalog. The JSON is a
**template**, not a filled run. QA later marks each item **Yes** (working) or
**No** (regressed).

Do **not** bake customer catalogs into Optics (`apps/`, `packages/`). Always
write the host project's own catalog next to that product.

## Hard rule — forward-facing only

**Map only public-facing / customer-facing roles and user flows.**

**Skip** (never put in `roles[]`, never emit as catalog modules):

- `admin`
- `super-admin`
- `platform-admin`
- `internal-ops`
- any staff-only CRM / ops / back-office surface

**Never emit** modules like `admin.crm` or titles like "Admin CRM".

Host admin routes (example: Unframed `/admin`, staff CRM) — skipped (not
public-facing). Mention them only as skipped. Do not emit catalog modules
for them. If `ROLE_IMPLICATIONS` says admin inherits employer, smoke the
employer-facing surface under the **employer** persona, not an admin
console module.

## Triggers

- "e2e smoke test"
- "smoke checklist"
- "map features for QA smoke"
- generate / write / export a smoke-test JSON catalog
- "run e2e" / "run smoke" / "automate the smoke catalog"

## Run (catalog already exists)

When the user says **run e2e**, **run smoke**, or **automate the smoke catalog**, execute the catalog — do not regenerate 103 spec files and do not ask an LLM to click.

1. Find `"_r&d/qa/smoke-checklist.json"` (quote the path — `_r&d` contains `&`). If missing, follow the generate path below first.
   Unframed default is **ATS + public** (5 personas). HR is `"_r&d/qa/smoke-checklist-hr.json"` and is **not** read by `pnpm smoke:e2e`. Pass `--catalog "_r&d/qa/smoke-checklist-hr.json"` (and `SMOKE_HR_BASE_URL`) to generate/run HR later.
2. Require `"_r&d/qa/smoke-runner.config.ts"` and a base URL (`SMOKE_BASE_URL` or the host e2e default).
3. From the **host** repo: `pnpm smoke:e2e -- --priority p0`
4. Optional: `--list` to print planned items without a browser. `--writes` only with host adapters; missing adapters are **blocked** (`no-adapter`), never a silent pass.
5. After a green P0 pass, ingest auto-pass into Optics when `OPTIC_KEY`, `OPTIC_ENDPOINT`, and (`OPTIC_RELEASE_ID` or `--create-draft-release`) are set. v1 may write a local JSON report instead.

The forward-facing rule holds for runs too: never log in as admin / super-admin / platform-admin / internal-ops, and never run `admin.crm`.

Chromium only. Default kinds: `loads` / `backend` / `lands`.

## Other hard rules

1. **Discover roles from code.** Never ask the user for a role list.
2. **Forward-facing only**, per the hard rule above.
3. **Onboarding modules stay coarse: register, photo if any, required fields through to the end — not every wizard step.**
4. **Other features: load + primary action + backend query for that role when applicable.**
5. **Results in the runner are Yes=working / No=regressed.** Do not put `result` on items. The catalog is the template.
6. **`entry.route` is a pathname only** (`/dashboard`, `/open-jobs`). No domains, no `https://…`. Strip locale prefixes unless the shipped URL really includes them.
7. Write to `"_r&d/qa/smoke-checklist.json"` in the **host** project. Quote the path — `_r&d` contains `&`.
8. Do not edit Optics `apps/web` or `packages/convex`. Do not seed Convex. Do not copy another product's catalog into Optics.

## Process

Copy this checklist and tick as you go:

```
- [ ] 1. Host + output path
- [ ] 2. Discover roles from code
- [ ] 3. Drop admin / ops; keep forward-facing only
- [ ] 4. Map features (routes, nav, onboarding, primary actions)
- [ ] 5. Emit catalog JSON
- [ ] 6. Validate
- [ ] 7. Write "_r&d/qa/smoke-checklist.json"
```

### 1. Host + output path

Work in the current workspace unless `$ARGUMENTS` is a project path.

```bash
mkdir -p "_r&d/qa"
```

Output file: `"_r&d/qa/smoke-checklist.json"`. If `_r&d/` is missing, create it.
`productApp` = host `package.json` `name` (or a short slug).

If the host **is** Optics: catalog Optics' own forward-facing product (org
member using the QA dashboard). Do not embed Unframed or any other customer.

### 2. Discover roles from code

Search the host. Do not invent personas. Evidence, then include.

| Look for | Typical files / symbols |
|---|---|
| Capability registry | `**/capabilities.ts`, `CAPABILITY`, `PLATFORM_ROLES`, `ROLE_IMPLICATIONS`, `capabilityRoles` |
| Role enums | `USER_ROLES`, `UserRole`, `v.union(v.literal("…"))` on `user_roles.role` |
| Org memberships | `memberRoles.ts`, `memberships.role`, `ROLE` union (`owner`, `hr_manager`, `member`, …) |
| Onboarding switches | `postAuthRedirect`, `defaultOnboardingPathForRole`, signup role mapping |
| Nav role filters | `shellTabs`, `EMPLOYER_TABS` / `TALENT_TABS`, `navigation` arrays gated by role |
| Route guards | middleware, `RouteRoleGuard`, `requireRole`, `roleHasCapability` |

Unframed (example only — do not copy its catalog): `packages/auth/src/shared/capabilities.ts` + `roles/_shared.ts` `USER_ROLES` + HR `memberRoles.ts` + `postAuthRedirect.ts` + `shellTabs.ts`.

Always consider a **`public`** persona when unauthenticated routes exist (login, marketing, public boards).

Search recipes: [reference.md](reference.md).

### 3. Drop admin / ops (hard rule)

**Skip** (do not put in `roles[]`, do not emit console modules):

- `admin`, `super-admin`, `superadmin`, `platform-admin`, `platform_admin`
- `internal-ops`, `internal_ops`, `staff-console`, `staff_console`
- any staff-only CRM / ops / back-office surface
- Routes like `/admin`, `/platform`, `/ops`, `/internal` as the *product's own* staff console

Also never emit "Platform admin console" or "Admin inherits employer workspace".

**Keep** company-side operators of the *customer product* (HR manager, recruiter, employee, employer). If the org schema names a seat `admin` but that human uses the same HR/ATS workspace as other customers, fold them into the forward-facing persona (`hr-staff`, `employer`) — do not emit an admin-console module.

**Inheritance:** if `ROLE_IMPLICATIONS` says admin satisfies employer, smoke `/jobs`, Talent Hub, etc. as `employer`. Do not add `admin` to `roles[]`.

**Aliases:** `partner` → `referral-partner` (or the shipped canonical id). One catalog role per persona.

Every kept role must have **≥1 P0 module**.

### 4. Map features

Per kept role, inventory:

1. **Auth / public** — login, signup, public lists/details.
2. **Onboarding** — one module per role that has a wizard. Coarse items only: register, photo if any, required fields through to the end. Not every step, slide, or field.
3. **Nav destinations** — each primary tab / sidebar href the role can open.
4. **Primary actions** — create/publish, apply, send, save, invite — the verb on that surface.
5. **Backend** — when a capability id or Convex/API gate exists for that role, add a `backend` item and set module `capability`.

Skip: storybook, rnd, internal debug, feature-flag-off, 404 stubs, admin consoles, staff CRM, internal-ops.

**Priority**

- `p0` — auth, onboarding, primary nav, money or data-write actions
- `p1` — secondary destinations, settings, optional photo
- `p2` — experimental / rarely used

### 5. Emit catalog JSON

Preferred envelope: `{ "productApp", "roles", "modules" }`. `$schema` is optional; omit it unless the host actually has the v1 schema file.

**`roles[]`:** `{ id, product, capability? }` — forward-facing only.

**`modules[]`:**

| Field | Rules |
|---|---|
| `id` | ASCII slug `[a-z0-9][a-z0-9.-]*`. Stable upsert key. `{role}.{feature}` e.g. `job-seeker.dashboard` |
| `name` | Display title |
| `priority` | `"p0"` \| `"p1"` \| `"p2"` (default `p0`) |
| `product` | Optional label (`ATS`, `HR`, `public`, …) |
| `roles` | Required. Personas this module is smoked as |
| `capability` | Optional backend capability id (`job_seeker.profile`, …) |
| `entry.route` | Optional. Pathname only, no domain |
| `preconditions` | Optional string[] |
| `items` | Required. ≥1 |

**Each item:**

| Field | Rules |
|---|---|
| `id` | Unique within the module. ASCII slug |
| `title` | What QA does |
| `required` | Default `true`. Blocking for coverage |
| `requiredWhen` | Optional helper text. **Not** evaluated |
| `assert` | What **Yes (working)** looks like |

Do not include `result`. Extra properties are ignored on import.

**Onboarding items (typical):** `register`, `photo` (`required: false` unless the product always demands it), `required-fields`, `backend`.

**Feature items (typical):** `loads`, one primary-action id (`create` / `save` / `send` / `apply`), `backend` when a gate exists.

### 6. Validate

- Every `roles[].id` is forward-facing (step 3). No admin / super-admin / platform-admin / internal-ops.
- Every `modules[].roles[]` value is in `roles[]` (or you add it).
- Every role has ≥1 P0 module.
- Every module has ≥1 item; ids match `[a-z0-9][a-z0-9.-]*`.
- Every `entry.route` is a pathname (starts with `/`, no scheme/host).
- Onboarding modules are coarse (not one item per wizard step).
- No admin-console modules. No `admin.crm`. No title "Admin CRM".
- JSON parses. Envelope is `{ modules: [...] }` with optional `roles` / `productApp`.

Full checklist: [reference.md](reference.md).

### 7. Write the file

```bash
mkdir -p "_r&d/qa"
```

Write `"_r&d/qa/smoke-checklist.json"` (quoted). Overwrite if present — upsert-by-id is the Optics import model; a regenerated catalog is the source of truth.

Report: host, roles kept (and which admin/ops were dropped as skipped — not public-facing), module count, output path.

## Short example

Not a filled run. Not a customer dump.

```json
{
  "productApp": "example-app",
  "roles": [
    { "id": "job-seeker", "product": "ATS", "capability": "job_seeker.profile" },
    { "id": "employer", "product": "ATS", "capability": "employer.workspace" },
    { "id": "public", "product": "public" }
  ],
  "modules": [
    {
      "id": "public.auth-login",
      "name": "Sign in",
      "priority": "p0",
      "product": "public",
      "roles": ["job-seeker", "employer"],
      "entry": { "route": "/auth/login" },
      "items": [
        { "id": "loads", "title": "Login page loads", "required": true, "assert": "Form is usable; no console error" },
        { "id": "lands", "title": "Sign in lands on the role dashboard", "required": true, "assert": "Redirect matches post-auth home for that role" }
      ]
    },
    {
      "id": "job-seeker.onboarding",
      "name": "Job seeker onboarding",
      "priority": "p0",
      "product": "ATS",
      "roles": ["job-seeker"],
      "capability": "job_seeker.profile",
      "entry": { "route": "/jobseeker-onboarding" },
      "items": [
        { "id": "register", "title": "Job seeker can register", "required": true, "assert": "Wizard starts; account can be created" },
        { "id": "photo", "title": "Upload profile photo", "required": false, "requiredWhen": "Job requires an applicant photo", "assert": "Image appears on the profile" },
        { "id": "required-fields", "title": "Fill required information through to the end", "required": true, "assert": "Lands on login or /dashboard" },
        { "id": "backend", "title": "job_seeker.profile writes succeed for this role", "required": true }
      ]
    },
    {
      "id": "employer.jobs",
      "name": "Employer jobs list",
      "priority": "p0",
      "product": "ATS",
      "roles": ["employer"],
      "capability": "employer.workspace",
      "entry": { "route": "/jobs" },
      "items": [
        { "id": "loads", "title": "Jobs list loads", "required": true },
        { "id": "create", "title": "Create and publish a job", "required": true },
        { "id": "backend", "title": "Jobs queries succeed (not FORBIDDEN)", "required": true }
      ]
    }
  ]
}
```

## Runner semantics (do not encode in JSON)

Optics stores Yes → `working`, No → `regressed`. Blocked fails the gate. There is no Skip. This skill only writes the template.

## Additional resources

- Field tables, search globs, validation: [reference.md](reference.md)
