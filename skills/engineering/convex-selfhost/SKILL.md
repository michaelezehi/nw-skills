---
name: convex-selfhost
description: >-
  Moves a Convex Cloud project onto the self-hosted lon1 shape proven on
  x-unframed: inventory, compose clone, export/import, rebuild, pause Cloud
  (never delete), and switch localhost from staging Cloud to npx convex dev.
  Use when self-hosting Convex, cutting over off Cloud, pausing a Cloud
  deployment, writing convex-deployments.manifest.json, remapping
  NEXT_PUBLIC_CONVEX_URL, or migrating a sibling project in __new-world__.
---

# convex-selfhost

Cloud Convex bills per function call and per byte of I/O. x-unframed left
Cloud. Every other Convex project in `__new-world__` follows this skill.

This is **not** `/convex-migration` (NestJS to Convex). This is **not**
`/region` (a new data-residency region). Those stay their own skills.

Manifest schema, Optic import rules, and the four standing rules live in
[`CONVEX-MIGRATION.md`](../../CONVEX-MIGRATION.md). Read that file
before the first edit. This skill is the executable playbook.

## Writing

Operator copy, checklists, and commit messages pass
`x-unframed/agent-skills/unslop/SKILL.md`. No em dashes.

## Hard rules

1. **Pause Cloud. Do not delete it.** Cloud is the rollback for a week.
2. **The invoice drops only after pause.** Two live stacks cost more than
   Cloud alone.
3. **Staging first when it exists.** No staging folder, no
   `ship:staging`, no `*.env.staging` Convex URL: cut over prod, still
   move localhost off Cloud first.
4. **Localhost uses `npx convex dev`.** After this skill, `.env.local`
   must not point at Cloud staging or Cloud prod.
5. **Isolate the Convex CLI.** Hide `.env.local`. `env -u CONVEX_DEPLOYMENT
   -u CONVEX_DEPLOY_KEY`. Pass `--env-file` that names only
   `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. Deploy
   from the real `convex/` or `convex-out/` tree, never a symlink scratch.
6. **Rebuild after every URL change.** `NEXT_PUBLIC_CONVEX_*` and
   `EXPO_PUBLIC_CONVEX_*` are build-time inlined. A container recreate
   without a rebuild still talks to Cloud.
7. **Never print secrets.** Admin keys, deploy keys, `accessToken`,
   `list_environment_variables` bodies, Stripe secrets. Names only.
8. **Pin `CONVEX_BACKEND_VERSION` to an explicit tag.** Never `latest`.
   Match the image x-unframed is running unless you have a reason not to:
   `2cbcf8179207eb4521360e6d81ebee5e7abbfa07`.
9. **Write `convex-deployments.manifest.json` at the repo root** in the
   same commit that flips `mode`. No secrets in that file.
10. **Confirm pause via `deploymentState`**, not `/version`. Usher still
    answers `/version` on a paused Cloud host.

## Read first

In this order, then stop and inventory:

1. `__new-world__/CONVEX-MIGRATION.md`
2. [references/inventory.md](references/inventory.md)
3. [references/gotchas.md](references/gotchas.md)
4. x-unframed exemplars (copy, do not invent):
   - `x-unframed/docker/convex-do/` (two backends on one host)
   - `x-unframed/docker/convex-gcc/` (one backend per stack: the default)
   - `x-unframed/scripts/deploy-convex-do.sh`
   - `x-unframed/docker/nginx-gateway/conf.d/convex-selfhost-extra-ports.conf`

x-unframed EU Cloud is already paused. Do not re-cutover it.

## Inventory (do this yourself)

Completion: a written table the user can reject, before any compose or
pause. Columns: app, env (`local` / `staging` / `prod`), Cloud
deployment name, current client URL, current site URL, droplet SSH,
whether a staging app exists, whether `.env.local` points at Cloud.

How to fill the table: [references/inventory.md](references/inventory.md).

Branch:

| What you found | What you cut over |
|---|---|
| Staging droplet or `ship:staging` or a Cloud `dev:` used as staging | Staging self-host, then prod |
| Only prod Cloud | Prod self-host. Localhost still moves to `npx convex dev` first |

Tell the user the branch. Wait if the table is wrong.

## Sequence

Proven on x-unframed. Steps 1 to 6 are reversible. Pause is last.

```
0  Inventory table signed off
1  Localhost → npx convex dev          (before any Cloud pause)
2  Stand up self-host next to Cloud
3  Export Cloud / import self-host
4  Rewrite stored Cloud storage hosts
5  Copy function env (names + remapped URLs)
6  Rebuild apps at the new public URLs
7  Verify (login, mutation, upload, cron, long action)
8  Pause Cloud for that env
9  Manifest + Optic
```

Do **staging 2-8**, then **prod 2-8**, unless inventory said prod-only.
Localhost (step 1) happens once, first.

Detail per step:

| Step | Where | Done when |
|---|---|---|
| 1 | [references/local-dev.md](references/local-dev.md) | `pnpm dev` talks to `127.0.0.1` from `npx convex dev`. Grep of `.env.local` has no `*.convex.cloud` |
| 2 | [references/shape.md](references/shape.md) | `/version` 200 on loopback 3210/3211 (or the project's ports). Admin key generated, stored in the env var the manifest will name |
| 3-5 | [references/cutover.md](references/cutover.md), [references/storage.md](references/storage.md) | Import doc counts match Cloud export. File GET on the new host returns 200. Function env key **names** match Cloud (values remapped) |
| 6-7 | [references/cutover.md](references/cutover.md), [references/webhooks.md](references/webhooks.md) | Baked image has the new URL, zero Cloud deployment names. Login works. Stripe/WorkOS destinations listed for the user |
| 8 | [references/pause.md](references/pause.md) | `_system/frontend/deploymentState:deploymentState` returns `{ state: "paused" }`. Self-host still 200 |
| 9 | `CONVEX-MIGRATION.md` | Manifest committed. `mode` matches reality |

## Isolate the CLI

Every `npx convex export|import|deploy|run|env` against self-host:

```bash
# From the real convex tree (convex/ or apps/*/convex-out)
mv .env.local .env.local.hide   # if present
cat > /tmp/convex-selfhost.env <<EOF
CONVEX_SELF_HOSTED_URL=https://<host>:<client-port>
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin-key>
EOF
env -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOY_KEY \
  npx convex deploy --yes --typecheck disable --env-file /tmp/convex-selfhost.env
mv .env.local.hide .env.local
```

The CLI refuses Cloud and self-host flags at once. A leftover
`CONVEX_DEPLOYMENT=dev:…` in `.env.local` silently targets Cloud.

On small droplets, push one backend at a time. Parallel HR+ATS timed out
at 4s on the 8 GB staging box.

## What you change in the project

Minimum set. Do not invent a second pattern.

- Compose clone under `docker/convex-selfhost/` (or the project's existing
  docker folder). Stack env on the droplet at
  `/opt/convex-<project>-<env>/`, **outside** the git checkout that
  `git reset --hard` / `git clean -fd` on ship.
- Nginx: extra TLS ports on an existing cert SAN, **or** flip the
  existing `:443` Cloud `.site` proxy to `http://<container>:3211`.
  Join the Convex container to the gateway Docker network. Proxy the
  **container name**, never `127.0.0.1` from inside nginx.
- App env on the droplet: `CONVEX_DEPLOYMENT=self-hosted:<instance>`,
  `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`. Rebuild.
- Ship scripts: stop `npx convex deploy` to Cloud. Point them at
  self-host or skip Convex (`XUNFRAMED_SKIP_CONVEX=1` shape).
- `.env.local` / `.env.example`: local URL from `npx convex dev`.
- `convex-deployments.manifest.json`.
- Legal or public copy only if the project already claims a Cloud city
  or vendor. Categories on public pages, names only in contract docs.

## What you do not change

- WorkOS login callbacks stay on the **app** origin
  (`https://app.example.com/api/auth/callback`). Convex URL is not
  WorkOS.
- Auth pairing: the droplet WorkOS client must stay the client the
  Convex deployment validates JWTs against.
- Do not upgrade a Stripe account Default API version mid-cutover.
- Do not rewrite storage paths from `_storage.internalId` UUIDs to
  `kg2…` `_id` values. Host only. See
  [references/storage.md](references/storage.md).
- Do not `scp` a laptop Cloud `.env` over a droplet self-host env.
- Do not `docker compose up` on a droplet without sourcing `.env`.
  `${VAR:-}` overrides `env_file` and blanks WorkOS.

## Delegate

The session model is the driver. It inventories, dispatches, reads each
diff, and does the pause itself. Briefings:
[references/dispatch.md](references/dispatch.md).

- One repo per agent. Never two agents in the same working tree.
- Mechanical leaves (compose clone, nginx extra port, locale-free env
  rename): cheaper model.
- Design, import, verify, pause: strongest model below the driver.
- Acceptance: gates pass, diff stays in owned paths. One redispatch.
  Then the driver does it inline.

Multi-project ("do all of them"): inventory every Convex repo first,
print the table, then one project at a time. Staging of project A can
overlap compose work on project B only when the trees and droplets
differ.

## Done

A project is done when all of these are true:

1. Inventory table was shown and not rejected.
2. Local `pnpm dev` uses `npx convex dev`. No `*.convex.cloud` in
   `.env.local`.
3. Staging (if it existed) is on self-host, verified, Cloud staging
   paused.
4. Prod is on self-host, verified, Cloud prod paused.
5. Baked images contain the new URL and not the Cloud deployment name.
6. `_system/frontend/deploymentState:deploymentState` is `paused` on
   every Cloud deployment that env used.
7. `convex-deployments.manifest.json` is committed, `mode` is
   `self-hosted` for those rows, `backendVersion` is the pin.
8. Ship scripts no longer push functions to Cloud.
9. Webhook destinations the user must click are listed, not guessed
   as done.

Report commit SHAs, Cloud names paused, and the live URLs. Do not
report "committed" without SHAs.

## Additional resources

- [references/inventory.md](references/inventory.md): scan + known siblings
- [references/shape.md](references/shape.md): compose, ports, nginx, env
- [references/cutover.md](references/cutover.md): export, import, rebuild, verify
- [references/local-dev.md](references/local-dev.md): `npx convex dev`
- [references/storage.md](references/storage.md): Cloud storage host rewrite
- [references/webhooks.md](references/webhooks.md): WorkOS and Stripe
- [references/pause.md](references/pause.md): pause and prove it
- [references/gotchas.md](references/gotchas.md): failures already paid for
- [references/dispatch.md](references/dispatch.md): agent briefings
