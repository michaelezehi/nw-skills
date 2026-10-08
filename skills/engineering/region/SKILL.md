---
name: region
description: Stand up, verify, or deploy an Unframed data-residency region (gcc, us, asia, africa, uk, …). Automates everything deterministic — registry + manifest entries, routing maps, env templates, tests, i18n keys, deploys, drift checks — and emits the exact human checklist for the physical half (cloud account, DNS, TLS, keys) it cannot do. Use for "/region <id>", "add a region", "deploy to <region>", "region status", or "move <region> in-country".
---

# region — one command per region, honestly

## Writing

Checklists, status notes, and operator copy must pass
`agent-skills/unslop/SKILL.md`. Em dashes are prohibited. Use a period or a
comma.

`/region gcc` · `/region asia --new` · `/region status` · `/region deploy gcc prod`

This skill exists because adding a region is two very different halves:

- **The repo half** — registry entry, manifest entry, routing maps, env templates,
  country mappings, i18n, tests, deploys, verification. Deterministic. This skill does
  all of it.
- **The physical half** — a cloud account applying Terraform, DNS records, TLS certs,
  generated admin keys, WorkOS pairing. No skill can conjure infrastructure. This skill
  generates the exact per-provider checklist, then **stops at the gate and resumes when
  the operator confirms** each item.

Never blur the two. A region that exists in the repo but not physically must carry
`status: "preview"` and its true `dataLocation`, and deploys to it must refuse
(`provisioned: false`) — the honesty machinery is load-bearing, not decoration.

## Before anything else

Read, in this order:
1. `packages/data-residency/src/registry.ts` — regions, `dataLocation` honesty contract,
   the in-Kingdom flip comment block.
2. `packages/data-residency/regions.manifest.json` — deploy targets, `requiredEnvKeys`,
   `provisioned` flags.
3. `docker/convex-gcc/README.md` — the runbook the gcc region was built from; every new
   self-hosted region clones its shape.
4. `.claude/goals/regional-deploy-implementation/ACCOUNTABILITY.md` (if present) — the
   gotcha log from the original build.

## Command shapes

| Invocation | Meaning |
|---|---|
| `/region status` | `pnpm regions:status` + interpret: SHA per target, DRIFT flags, unprovisioned rows |
| `/region deploy <id> <env>` | `./scripts/deploy-region.sh <id> <env>` with the skew guard explained on refusal |
| `/region <id> --new` | Full new-region scaffold (Phase 1 below) + checklist (Phase 2) + verify (Phase 3) |
| `/region <id> --flip` | Move a preview region's disclosure to its real location once infra passes E2E |

## First decision: is it actually a new region?

Ask this before scaffolding — half of "add region X" requests are really "map country X
to an existing region", which is a two-line change, not infrastructure:

- **UK** → already lawfully served from `eu` (Dublin) under adequacy. A UK *region* is
  only needed for UK-only-residency buyers → self-hosted on a UK host.
- **A new country in an existing region's bloc** → add to `COUNTRY_TO_REGION` and (if
  lawful) `lawfulWithoutSafeguardsFor`. Done. No infra.
- **A genuinely new physical region** (asia, africa, in-Kingdom ksa) → full pipeline.
- **Convex Cloud regions are only US East + EU West** (verify against
  docs.convex.dev/production/regions — this changes). Everything else is self-hosted:
  our Docker stack on any host, which is why the provider is a variable.

## Phase 1 — repo scaffold (all automated)

Every step has an existing exemplar; copy its shape, don't invent:

1. **Registry** (`packages/data-residency/src/registry.ts`): new `RegionId`, region block
   with `status: "preview"`, `plans: ["enterprise"]`, `hosting: "self-hosted"`, and —
   the part that matters — a **truthful `dataLocation`** for wherever the deployment
   will *actually* run first. `domesticFor` = only the country the bytes sit in. The
   registry-integrity tests enforce `dataLocation.countryCode ∈ domesticFor`; do not
   fight them, they are the honesty contract.
2. **Country mappings**: `COUNTRY_TO_REGION` entries + `REGION_ORDER` + a distinct
   `envSuffix`.
3. **Manifest** (`regions.manifest.json`): dev + prod envs, `provisioned: false` on
   every app until real infra exists, `requiredEnvKeys` cloned from gcc/prod (the S3
   five + `INSTANCE_SECRET` + `POSTGRES_URL` + `CONVEX_BACKEND_VERSION`), registry block
   with the provider's region name.
4. **Routing maps**: `NEXT_PUBLIC_*` is build-time inlined, so these are literal code
   edits, not env config: add `process.env.NEXT_PUBLIC_CONVEX_URL_<SUFFIX>` lines to
   `apps/app/src/lib/residency-routing.ts` AND `apps/hr/src/lib/residency-routing.ts`.
5. **Compose stack**: `docker/convex-<id>/` cloned from `docker/convex-gcc/` (compose +
   prod overlay + both `.env.*.example`), instance names updated. Remember the derived
   DB name (`INSTANCE_NAME` with `-`→`_`, never auto-created).
6. **Infra as code**: `infra/<id>/` cloned from `infra/ksa/` with the provider region —
   and keep the **region validation lock** pattern (`var.aws_region` allowlist): a
   module that can apply to the wrong country makes a compliance claim false.
7. **i18n**: if any new user-facing label is introduced, all 7 locales, both apps,
   catalogs-first, compose gates. (Region labels themselves live in the registry.)
8. **Tests**: extend the registry/manifest/routing suites for the new id — the existing
   parametrised tests mostly pick it up; run all five residency surfaces.

## Planned regions, the honest half-step

A region can be recorded before it is built. `status: "planned"` is what makes that
truthful rather than a promise the code contradicts. `apac` (Sydney, DigitalOcean
`syd1`) is the worked example.

What `planned` means, mechanically:

- **The registry entry is real.** Label, `dataLocation`, `domesticFor`, `envSuffix`, the
  country mappings. `dataLocation` still states where the bytes will sit, and it moves
  through code review like any other claim.
- **`resolveResidency` splits the answer in two.** `region` is `DEFAULT_REGION`, because
  that is where the data actually is. `preferredRegion` is the planned id, so a company
  created today can be found by a query when the region opens instead of by guesswork.
  `exactMatch` is **true**: a planned region is a decision, not the unmapped fallback,
  and reporting it as a fallback is what the onboarding copy used to get wrong.
- **`domestic` and `needsTransferSafeguards` are computed against the routed region.**
  A promise about Sydney does not change what London holds, so an Australian company
  still sees the transfer note.
- **Nothing routes there.** `listRegions` and `canSelectRegion` exclude planned regions,
  `nearestSupported` returns the default, and every manifest entry carries
  `provisioned: false` so `manifest_apps` yields nothing and deploys refuse.
- **Onboarding says so in words.** HR's `ResidencyVignette` and the ATS `ResidencyStep`
  render a third branch when `preferredRegion !== region.id`: stored in London today, a
  Sydney region is coming, and we will say before anything moves.

Flipping out of `planned` is Phase 4 below, after real-infrastructure E2E. It is two
separate decisions, made in this order: `provisioned: true` per app in the manifest once
that backend answers, then `status: "ga"` in the registry. Neither is a formality, and
the second one changes what customers are told.

## Phase 2 — the physical checklist (human, generated per provider)

Emit as a checkbox list and stop there. Each item needs a person with account access:

- [ ] Cloud account + `terraform plan`/`apply` in `infra/<id>/` (native arch — the AWS
      provider dies under Rosetta)
- [ ] `CREATE DATABASE <instance>_prod;` on the managed Postgres (derived name!)
- [ ] DNS + gateway TLS for the two origins
- [ ] Boot stack → `generate_admin_key.sh` → store as `CONVEX_<ID>_PROD_ADMIN_KEY` on
      the operator machine (never in git — the manifest test greps for leaked keys)
- [ ] WorkOS env pair (`WORKOS_ISSUER`/`WORKOS_JWKS_URI`) + full function-env sync:
      `sync-convex-env.sh <file> --yes` (self-hosted mode; `--dry-run` first)
- [ ] Bridge pairing both ways: `ATS_CONVEX_SITE_URL_<SUFFIX>` /
      `HR_CONVEX_SITE_URL_<SUFFIX>` + shared secret — same region on both ends, the
      resolver fails closed across borders by design
- [ ] S3 buckets in the same provider region (empty buckets = silent container-volume
      fallback = data loss; the prod overlay hard-fails on them)

## Phase 3 — verify (automated again, hard gates)

1. Flip `provisioned: true` in the manifest; `./scripts/deploy-region.sh <id> dev`.
   First push against a cold backend can hit the 4s module-analysis timeout.
   Set `ISOLATE_ANALYZE_USER_TIMEOUT_SECONDS=30` on the backend (compose default)
   and recreate it. A retry alone is not enough for the HR graph on an 8 GB host.
2. **Long-action probe** (non-negotiable, re-run on every image bump):
   `npx convex run _ops/longActionProbe:probe '{"seconds": 45}'` against the new
   backend. <45s clean = Companion voice broken there; stop.
3. `pnpm regions:status` — new region in-sync, no drift.
4. E2E: onboard a company from a mapped country → cookie set → client connects to the
   new deployment only; plus the fallback case (unset URL → served from default,
   `fellBack` disclosed).

## Phase 4 — `--flip` (only after Phase 3 on real infra)

One reviewed edit of the region's registry block: `dataLocation` to the real
city/provider/region, `domesticFor`/`lawfulWithoutSafeguardsFor` to the bloc, per the
worked example in the registry's gcc comment. Every disclosure, `domestic` flag and
transfer-safeguards warning recalculates automatically. `status: "ga"` is a separate,
commercial decision. Never flip before real-infra E2E — that is the one lie the whole
system is built to prevent.

## Gotchas that already cost time (do not relearn)

- Convex CLI: `CONVEX_DEPLOYMENT` and `CONVEX_SELF_HOSTED_*` are mutually exclusive —
  scratch `--env-file`, never the app's `.env.local`.
- Admin keys contain a pipe → never `source` a file holding one.
- `--env-file` values keep inline `# comments` as part of the value.
- Compose interpolates profile-gated services per-file before merging (the
  `POSTGRES_PASSWORD` throwaway in prod env files exists for this).
- HR i18n compose fails "extra leaf" on new keys until `.parity-baseline` is refreshed
  from the composed bundles.
- `ssh` targets come from the manifest via `scripts/lib/manifest.sh` — never hardcode a
  host; aliases preferred, `sshFallback` keeps fresh machines working.
