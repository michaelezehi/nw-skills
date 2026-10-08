# Agent briefings

The driver writes the inventory table, then fills these. One repo per
agent. Claim paths with `git status --porcelain` if the repo uses the
shared-tree protocol.

Do not give any agent Cloud admin keys in the briefing. Tell it where
the sealed file lives on the droplet and that it must not print values.

## Local-dev (mechanical)

```
Repo: <ABS>
Goal: localhost uses `npx convex dev`, not Cloud.

Read: __new-world__/agent-skills/convex-selfhost/references/local-dev.md
      and this repo's convex.json + .env.example

Edit only: .env.example, README/CLAUDE.md local Convex sentences,
           any committed default that points NEXT_PUBLIC_CONVEX_URL at
           *.convex.cloud for local. Do not commit .env.local.

Done: rg convex.cloud on committed local-default files is 0.
      Document the two-process command (npx convex dev + pnpm dev).
No git commit unless the driver said to.
```

## Compose + nginx (mechanical)

```
Repo: <ABS>
Droplet: <ssh>
Env: staging | prod
Shape: one backend (clone docker/convex-gcc) or two (clone docker/convex-do)

Read: __new-world__/agent-skills/convex-selfhost/references/shape.md
      x-unframed/docker/convex-gcc/ OR x-unframed/docker/convex-do/
      x-unframed/docker/nginx-gateway/conf.d/convex-selfhost-extra-ports.conf

Own: docker/convex-selfhost/** , nginx snippet, deploy-convex script.
Do not edit app runtime code. Do not pause Cloud. Do not print secrets.

Done: compose config --preflight passes. On the droplet after the
      operator copies env: curl 127.0.0.1:<client>/version is 200.
```

## Import + env remap (strongest below driver)

```
Repo: <ABS>
Cloud zip: <path, already exported by the driver>
Self-host URL + admin key: on droplet /opt/convex-<project>-<env>/
Public client URL: <url>
Public site URL: <url>

Read: SKILL.md isolate section, references/cutover.md, references/storage.md

Isolate every CLI call. Import --replace-all once. Rewrite storage hosts
(zip-first if the zip is still local). Re-apply function env with URL
remaps. Never print env values or keys.

Done: import counts in the report. One storage GET 200. Function env
      key-name count vs Cloud (not values).
```

## App rebuild (mechanical once URLs are decided)

```
Repo: <ABS>
Droplet: <ssh>
New NEXT_PUBLIC_CONVEX_URL: <url>
New CONVEX_SITE_URL: <url>
Ship script: <path>. Skip Convex function push to Cloud.

Own: droplet .env URL keys, deploy-app / ship flags, nginx :443 flip
     if this env is the cutover. Commit durable nginx in git if the
     next ship would wipe it.

Done: baked image grep new URL > 0, Cloud deployment name = 0.
      App HTTP 200. Do not claim login unless you ran it.
```

## Pause (driver only)

The driver pauses. Brief a pause agent only if the driver cannot reach
the Cloud API. The agent follows references/pause.md and returns
`state: paused` plus lon1 `/version` 200. It does not delete.
