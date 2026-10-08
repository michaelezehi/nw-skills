# Cutover (staging, then prod)

Do this once per environment. Staging first when inventory said it exists.

## 1. Export Cloud

From a laptop, against Cloud, with the Cloud deploy key or a logged-in CLI.
`--include-file-storage`. Keep the zip off git.

```bash
npx convex export --include-file-storage --path /tmp/convex-<project>-<env>.zip
```

Cloud export is the rollback. Keep it for a week after pause.

## 2. Import self-host

Isolate the CLI (SKILL.md). `--replace-all` on a **fresh** self-host only.

```bash
env -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOY_KEY \
  npx convex import --replace-all --admin-key "$ADMIN" \
  --url "$SELF_URL" /tmp/convex-<project>-<env>.zip
```

Record doc counts and file counts from the import log. Those numbers go
in the report. `--replace-all` does **not** wipe Convex function env.

HR-scale imports (100k+ docs) are slow. Do not parallelise two imports
onto one 8 GB box.

## 3. Storage hosts

Import copies blobs and `_storage` rows. App documents still hold
absolute `https://<cloud>.convex.cloud/api/storage/<uuid>` strings. The
UUID is `_storage.internalId`. Rewrite the **host** only. See
[storage.md](storage.md).

Prefer rewriting the zip **before** import when you already know the
public self-host origin. x-unframed prod HR: 2,858 Cloud hosts rewritten
in the zip, then import. Staging missed that and needed a live rewrite
mutation after.

## 4. Function env

Dump Cloud env from the droplet or laptop with admin auth. Write a
**sealed** file under `/opt/convex-<project>-<env>/cloud-env/` (mode
0600). Never print it.

Apply onto self-host with remaps:

| Cloud value | Self-host value |
|---|---|
| `https://<name>.*.convex.cloud` | public client URL (extra TLS port included) |
| `https://<name>.*.convex.site` | public HTTP-actions URL |
| App origins (`https://app.…`) | unchanged |

Fill gaps the import did not carry. Do not overwrite a cutover URL with
the Cloud URL.

## 5. Rebuild the apps

On the droplet, using that project's deploy script, **after** the droplet
`.env` has the self-host URLs.

`NEXT_PUBLIC_*` is inlined. Recreate without rebuild is a no-op.

If the project has `pnpm ship` that still runs `npx convex deploy` to
Cloud: skip that step (`--skip-convex` / `XUNFRAMED_SKIP_CONVEX=1`)
until the script is remapped. A Cloud function push during cutover is a
defect.

Grep the baked image:

```bash
docker exec <app> sh -c 'grep -R "<new-host>" /app | wc -l'
docker exec <app> sh -c 'grep -R "<cloud-deployment-name>" /app | wc -l'
```

New host count > 0. Cloud name count = 0.

## 6. Verify

Minimum, on the env you just flipped:

1. `/version` 200 on the public client URL
2. Login (WorkOS or whatever the app uses)
3. One mutation that writes a row you can read back
4. One file upload, then GET the returned URL (200, real bytes)
5. One cron or scheduled job if the project has one
6. A long action if the project has Companion-style actions
   (x-unframed: `_ops/longActionProbe` at 45s)

Login alone is enough to **pause** only when the user says so. The
report must still name what you did not verify.

## 7. Nginx / DNS

- Extra TLS ports published on the gateway compose and allowed on ufw
- Durable nginx snippet under `/opt/convex-…/` so the next
  `git reset --hard` cannot wipe it unless the snippet is also in git
- `api.` / site hostname `:443` no longer shows `convex-usher` or
  `cf-ray` for the droplet's IPv4
- No AAAA surprise: curl the A record you intend

## Prod-only projects

Skip the staging loop. Still do local `npx convex dev` first. Prod
export/import/rebuild/verify/pause. Same gates.

## After both envs

Remap `pnpm ship` / `pnpm ship:staging` so a future deploy pushes
functions to self-host (isolated CLI) and does not restore Cloud URLs.
Commit that in the project repo.
