# Inventory

Fill the table before any compose, import, or pause. Re-scan. Do not trust
this file as live state.

## Scan (from `__new-world__`)

```bash
for d in */; do
  [ -d "$d/.git" ] || continue
  find "$d" -maxdepth 5 -name convex.json -not -path "*/node_modules/*" -print -quit \
    | grep -q . || continue
  if [ -f "$d/convex-deployments.manifest.json" ]; then s=yes; else s=NO; fi
  printf "%-24s manifest:%s\n" "$d" "$s"
done
```

`manifest:NO` has not been through this skill.

Per project, from that repo root:

```bash
find . -maxdepth 5 -name convex.json -not -path "*/node_modules/*"
rg -n "CONVEX_DEPLOYMENT=|NEXT_PUBLIC_CONVEX_URL=|EXPO_PUBLIC_CONVEX_URL=|CONVEX_SITE_URL=" \
  --glob ".env*" --glob "*.example" --glob "docker-compose*.yml" --glob "eas.json"
rg -n "convex.cloud|convex.site|npx convex deploy|ship:staging" \
  --glob "*.{sh,yml,md,json,ts}" -g '!node_modules' -g '!.next'
ls docker-compose*.yml docker/*.yml 2>/dev/null
```

Record droplet SSH from the project's deploy script (`root@…`), not from
memory.

## Table columns

| Column | What to write |
|---|---|
| `app` | `web`, `admin`, `mobile`, or the Convex package name if one backend serves several |
| `env` | `local`, `staging`, `prod` |
| `cloud` | Deployment name (`prod:tame-frog-970` → `tame-frog-970`) |
| `client` | Current `NEXT_PUBLIC_CONVEX_URL` |
| `site` | Current `CONVEX_SITE_URL` / `.convex.site` |
| `droplet` | SSH target, or `none` |
| `staging?` | `yes` if a staging app, staging compose, or Cloud `dev:` used as staging exists |
| `local→` | Where `.env.local` points today (`cloud-dev`, `cloud-staging`, `cloud-prod`, `already-local`) |

## Staging exists when any of these are true

- `pnpm ship:staging` / `scripts/ship-staging.sh`
- `docker-compose.staging.yml` that sets a Convex URL
- `.env.staging` with a different Cloud name than prod
- A hostname `staging.<app>.…` whose baked URL is `*.convex.cloud`

A Cloud `dev:` deployment that **localhost and staging share** counts as
staging. Cut that over, then move localhost to `npx convex dev` (step 1
still happens first).

## Last scan (2026-08-29, re-run)

`find` at maxdepth 5. `renovyn` has Cloud env pins and no `convex.json`. Skip
until Convex lives in that tree. `perspiva` / `uplifted`: examples only.

| Repo | Branch | Cloud | Local today | Droplet | Staging? |
|---|---|---|---|---|---|
| `x-unframed` | done | EU Cloud paused | skip | `203.0.113.20` prod, `203.0.113.10` staging | yes |
| `optic-qa-ai` | staging then prod | staging/local `quick-parrot-159`; prod `industrious-hyena-762` | `cloud-staging` | staging `root@203.0.113.10` (shared with x-unframed, ports 3310-3321 and 8443-8445 taken); prod `root@203.0.113.50` | yes |
| `founder-x` | staging then prod | local `precise-antelope-461`; prod `dapper-wolverine-603` | `cloud-dev` | staging `root@203.0.113.10`; prod `root@203.0.113.30` | yes (compose + ship) |
| `connect` | prod-only | `silent-cow-326` is local **and** `.env.production` | `cloud-prod` | none in scripts | no |
| `new-age-id` | prod-only | `courteous-puma-828` is local **and** `.env.production` | `cloud-prod` | none in scripts | no |
| `aml` | prod-only | `mild-marten-711` is local **and** `.env.production` | `cloud-prod` | none in scripts | no |
| `decked` | prod-only | `flexible-capybara-403` local; no prod pin | `cloud-dev` | none in scripts | no |
| `talent-spotter` | local already | none | `already-local` (`127.0.0.1:3210`) | none | no |

Shared staging box `203.0.113.10`: new Convex stacks must pick loopback
ports other than 3310-3321 and extra TLS ports other than 8443-8445.

## Localhost trap

Most of these repos set `.env.local` to the Cloud `dev:` deployment that
staging also uses. Pausing that Cloud name without step 1 bricks every
laptop. That is why local `npx convex dev` is first, not last.
