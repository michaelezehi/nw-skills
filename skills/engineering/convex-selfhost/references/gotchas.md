# Gotchas already paid for

Read before you improvise. Each line is a failure, not a preference.

1. **`CONVEX_DEPLOYMENT` in `.env.local` wins.** `npx convex import` /
   `deploy` against self-host silently hits Cloud. Isolate or fail.
2. **Symlink scratch trees fail deploy.** Push from the real `convex/`
   or `convex-out/` directory.
3. **Empty `AWS_ACCESS_KEY_ID=` crashes the backend** (IMDS). Omit the
   keys. Do not export empty AWS vars.
4. **Empty S3 bucket names with keys set** write files to the container
   volume and look fine. Preflight bucket names. Prod overlay uses
   `${VAR:?}`.
5. **Prod overlay requires Spaces.** First boot can be base compose +
   `--profile local-db` only.
6. **Parallel function push on 8 GB** (two backends) hit a 4s timeout.
   Sequential works.
7. **Nginx `127.0.0.1` is the nginx container.** Use the Convex
   container name on the shared Docker network. Resolver `127.0.0.11`.
8. **`:443` Cloud proxy used `https://` + `proxy_ssl_server_name`.**
   Self-host is `http://<container>:3211`.
9. **Stale HTTP/2** can still show `convex-usher` / `cf-ray` after the
   flip. Curl the droplet A record with `--http1.1` before chasing DNS.
10. **Ship `git clean -fd`** deletes extra-port nginx if it only lives
    in the checkout. Durable copy under `/opt/convex-…/` and a git
    commit.
11. **Laptop `pnpm ship`** that still deploys Convex to Cloud undoes the
    cutover. Skip Convex or remap first.
12. **`docker compose up` without sourced `.env`** blanks WorkOS via
    `${VAR:-}`.
13. **Pause probe via `/version` is wrong.** Use
    `_system/frontend/deploymentState:deploymentState`.
14. **Storage rewrite to `kg2` ids 404s.** Host only. UUID is
    `internalId`.
15. **Function env survives `--replace-all`.** Still re-apply remapped
    URLs. Cloud hosts left in env send webhooks and fetches back to
    Cloud.
16. **WorkOS client mismatch** → login succeeds, workspace queries never
    resolve. Pair the JWT client with the backend.
17. **Mobile / Expo** inlines Cloud at build time. Staging APK ≠ prod
    pair. Rebuild after cutover if phones matter.
18. **Legal PDFs** can still name the old city after `FACTS.md` flips.
    Do not regenerate PDFs unless asked. Public pages never name the
    stack.
19. **Companion 45s probe** is the voice go/no-go on self-host when the
    project has long actions. Skip only if there is no such action.
20. **Dashboard container off on prod/staging** is intentional. Optic is
    the console. Convex dashboard is FSL-1.1: run it, do not copy
    `dashboard-common` into a product.
21. **Health Insights, Project Usage, Custom Domains** do not exist
    self-hosted. Stop looking.
22. **Convex object keys must be ASCII.** Unrelated to hosting, still
    true on self-host. Do not "fix" import by using display labels as
    keys.
