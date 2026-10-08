# Shape (copy x-unframed)

Default: **one Convex backend per environment**. Clone
`x-unframed/docker/convex-gcc/` and rename. Only clone
`x-unframed/docker/convex-do/` when the project already has two Cloud
deployments that must share one droplet (ATS + HR).

## Image

```
ghcr.io/get-convex/convex-backend:2cbcf8179207eb4521360e6d81ebee5e7abbfa07
```

Pin the same tag on the dashboard image if you start that profile. Backend
and dashboard versions must match. Most dashboard APIs are unversioned.

## Ports

Inside the container: client API `3210`, HTTP actions `3211`.

Publish loopback on the droplet:

| Role | Host bind |
|---|---|
| Client API | `127.0.0.1:<N>:3210` |
| HTTP actions | `127.0.0.1:<N+1>:3211` |

Pick unused `N`. x-unframed EU uses `3310/3311` (HR) and `3320/3321` (ATS).
Do not collide with those if you share `xunframed-prod` (`203.0.113.20`)
or `new-world-staging` (`203.0.113.10`).

Public URL until a dedicated cert SAN exists: extra TLS ports on a name
already on the cert. x-unframed used `8443` (ATS client), `8444` (HR
client), `8445` (HR HTTP). Copy
`x-unframed/docker/nginx-gateway/conf.d/convex-selfhost-extra-ports.conf`.

When the existing `:443` vhost already proxies Cloud `.site`, flip that
block to `http://<container>:3211` at cutover. Do not leave
`proxy_ssl_server_name` pointed at Cloud.

## Compose rules

- `INSTANCE_NAME` is required. Convex derives the Postgres database as
  `INSTANCE_NAME` with `-` → `_`. It does **not** create that database.
  Bundled `postgres-init/` must `CREATE DATABASE` it, or you create it
  by hand.
- `POSTGRES_URL` has **no** database name. Convex appends the derived one.
- `CONVEX_CLOUD_ORIGIN` / `CONVEX_SITE_ORIGIN` must be the **public**
  client and site URLs the browser and webhooks will use, including the
  extra TLS port.
- Join the backend to the **gateway** Docker network. Nginx resolves
  `http://<container>:3210` via `127.0.0.11`. `127.0.0.1` inside the
  nginx container is the nginx container.
- Dashboard services stay on `profiles: ["dashboard"]`. Prod and staging
  default **off**. Logs live in Optic. "Logs disappeared" is this
  profile, not a fault.
- `DISABLE_BEACON=true` if you do not want the self-hosted usage beacon.

## S3 / Spaces

Prod overlay (`${VAR:?}`) requires five buckets per backend plus
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
`S3_ENDPOINT_URL`. Same region as the droplet.

**First boot without Spaces:** base compose + `--profile local-db` only.
**Omit** `AWS_*` keys. An empty `AWS_ACCESS_KEY_ID=` crashes the backend
via IMDS. Missing buckets with no AWS keys: files land on the container
volume. Say so in the inventory. Do not pretend they are backed up.

Empty bucket **names** with AWS keys set: silent write to the volume.
Preflight the five names.

## Env on the droplet

Ship scripts in this workspace often `git reset --hard origin/main` and
`git clean -fd`. Convex env and admin key files live at:

```
/opt/convex-<project>-<env>/
  .env
  admin.key
  nginx-extra-ports.conf   # durable copy if ship wipes the git checkout
```

Not under `/opt/<project>/` if that tree is the ship checkout.

Laptop Cloud `.env` is not a droplet self-host env. Copy **key names**
from Cloud `list_environment_variables`, remap URL values, never scp the
file over the cutover URLs.

## Recreate

`${VAR:-}` in compose `environment:` overrides `env_file`. A bare
`docker compose up --force-recreate` with an empty shell blanks WorkOS
and the app dies ("WorkOS configuration is missing"). Always
`set -a && source .env && set +a` first, or use the project's
`deploy-app.sh`.

## Admin key

```bash
docker compose -p <stack> exec <backend> ./generate_admin_key.sh
```

Store in the env var the manifest will name. Prefer a read-only key for
Optic. `GET /api/check_admin_key` reports `isReadOnly`.

## Deploy script

Copy `x-unframed/scripts/deploy-convex-do.sh` and shrink it to one
backend if that is the shape. Keep `--preflight` (`compose config`
against the overlay so missing `${VAR:?}` fails before `up`).
