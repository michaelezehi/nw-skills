---
name: staging
description: Use when the user says /staging, "spin up staging", "QA environment", "deploy a preview of this branch". Spin up a QA staging environment for any project on the dedicated staging droplet. Detects Postgres vs Convex, generates a self-contained Docker stack that joins the shared staging-network and routes through the shared staging-nginx-gateway. Emits a manual prerequisites checklist for the parts that cannot be automated (DNS, WorkOS dashboard, SSL).
disable-model-invocation: true
---
# /staging — Stand up a QA environment

Use when the user asks to add staging to a project, onboard a QA hire, or set up a non-production environment.

## Project root convention

Every staging project lives at **`/opt/<project-name>`** on the staging droplet. The `<project-name>` is the value of `PROJECT` from `lib/detect.sh` (same as the local repo directory name). Templates use `/opt/${PROJECT}` everywhere — never `/root/`, never `/home/<user>/apps/`.

## Single-droplet topology

All staging environments live on **one shared droplet** (`203.0.113.10`). Each project is self-contained:
- Its own `postgres-staging` and `redis-staging` containers
- Joins the shared Docker network `staging-network`
- Drops its nginx server blocks into the shared `staging-nginx-gateway`'s `conf.d/`
- Lives at `/opt/<project>/`

```
┌──────────────────── staging droplet (203.0.113.10) ────────────────────┐
│                                                                           │
│  ┌─── staging-nginx-gateway (single, ports 80/443) ────────────────────┐  │
│  │  conf.d/x-unframed.conf      → routes staging.*.x-unframed.com      │  │
│  │  conf.d/founder-x.conf       → routes staging.*.founders-align.com  │  │
│  │  conf.d/perspiva.conf        → ...                                  │  │
│  └─────────────────────────────────────────┬───────────────────────────┘  │
│                                            │                              │
│  ┌─── /opt/x-unframed ────────┐  ┌─── /opt/founder-x ───────────────┐     │
│  │  xunframed-app-staging     │  │  founder-x-web-staging           │     │
│  │  xunframed-api-staging     │  │  founder-x-admin-staging         │     │
│  │  xunframed-website-staging │  │  founder-x-api-staging           │     │
│  │  xunframed-worker-staging  │  │  founder-x-worker-staging        │     │
│  │  xunframed-postgres-staging│  │  founder-x-postgres-staging      │     │
│  │  xunframed-redis-staging   │  │  founder-x-redis-staging         │     │
│  └────────────────────────────┘  └──────────────────────────────────┘     │
│                                                                           │
│  All containers share the 'staging-network' bridge for inter-container    │
│  resolution. Each project's compose declares it `external: true`.         │
└───────────────────────────────────────────────────────────────────────────┘
```

## Prereqs the operator must complete (the skill cannot do these)

1. DNS A records for `staging.<host>`, `staging.app.<host>`, `staging.api.<host>` → `203.0.113.10`.
2. WorkOS staging redirect URI added in dashboard (per project).
3. SSL cert issued via certbot for the staging hostnames (one-shot per project; uses shared certbot volumes on droplet).
4. Droplet capacity: ≥1 GB free RAM, ≥3 GB free disk (preflight checks both).

## Flow

1. **Detect** — `lib/detect.sh` returns project type (`postgres` / `convex` / `unknown`), prod domain, prod container names.

2. **Preflight** — `lib/preflight.sh 203.0.113.10 root <prod-domain>` — droplet checks + DNS resolution.

3. **Generate diff** based on project type:
   - **Postgres**: render templates, present unified diff. See `lib/apply-postgres.sh`.
   - **Convex**: emit `.env.staging.example` with dev Convex URL + nginx conf only. See `lib/apply-convex.sh`.
   - **Unknown**: report missing scaffolding (Dockerfile, docker-compose.do.yml, etc.) and exit.

4. **Show user the diff and wait for approval.**

5. **Apply** — Edit/Write files. Generate `_r&d/staging/PREREQUISITES.md` and `_r&d/staging/QA-ONBOARDING.md` in the project root.

6. **Print next steps** verbatim from PREREQUISITES.md.

## Files this skill produces or modifies

In the project root:
- `docker/docker-compose.staging.yml` — self-contained stack (postgres-staging, redis-staging, app/api/web/worker), joins `staging-network`
- `docker/staging/nginx.conf` — server blocks for the project's staging hostnames (scp'd to gateway during deploy)
- `.env.staging.example` — template with WORKOS_*, JWT_SECRET, DB creds, etc.
- `scripts/remote-cmd-staging.sh` — SSH wrapper pointing at the staging droplet
- `scripts/deploy-staging.sh` — auto-clones if missing, else pulls + builds + swaps + reloads gateway
- `package.json` — adds `ship:staging`, `ship:staging:migrate`, `ship:staging:seed`
- `_r&d/staging/PREREQUISITES.md` — operator checklist
- `_r&d/staging/QA-ONBOARDING.md` — QA day-1 doc

Files this skill **never** modifies:
- `.env.production`
- `docker-compose.do.yml`
- Anything under `apps/`

## Templates

All templates use `${...}` placeholders. Substitute these at apply time:

| Placeholder | Value |
|---|---|
| `${PROJECT}` | short name from detect.sh (`xunframed`, `founder-x`, etc.) |
| `${PROD_DOMAIN}` | canonical domain (`x-unframed.com`, `founders-align.com`) |
| `${STAGING_HOST}` | `staging.${PROD_DOMAIN}` |
| `${STAGING_APP_HOST}` | `staging.app.${PROD_DOMAIN}` |
| `${STAGING_API_HOST}` | `staging.api.${PROD_DOMAIN}` |
| `${STAGING_ADMIN_HOST}` | `staging.admin.${PROD_DOMAIN}` (if project has an admin app) |
| `${STAGING_DROPLET_IP}` | `203.0.113.10` (constant) |
| `${SSH_USER}` | `root` |
| `${STAGING_NETWORK}` | `staging-network` (constant) |

## Shared infrastructure on the droplet

The staging droplet runs ONE shared nginx-gateway + certbot stack at `/opt/_staging/`. This is project-agnostic and set up once. The skill documents this in `lib/setup-shared-gateway.sh` (run once per droplet, not per project).

## Reusing the skill on other projects

For perspiva, yasmeen-personal-brand, founder-x, or any future project: cd into the project, invoke `/staging`. The skill re-runs detect → preflight → generate. Templates use placeholders so per-project values flow through automatically.

If a project has no `docker-compose.do.yml` (or `docker-compose.production.yml` or `docker-compose.staging.yml`), the skill exits with a friendly diagnostic — get production scaffolding in place first, then re-run.
