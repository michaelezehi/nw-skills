---
name: convex-backup-cron
description: Install a 4x-daily production backup cron for Convex + DigitalOcean Spaces projects. Inspects .env files and the deploy setup, then drops in a Node backup script (Convex snapshot export + droplet state tar → DO Spaces, retains latest N), a cron installer, and package.json scripts. Prompts at the end for any missing prerequisites (DO Spaces bucket, Convex deploy key). Idempotent — safe to re-run to upgrade.
disable-model-invocation: true
---
# /convex-backup-cron — install prod backup cron for Convex + DO Spaces

You're installing an automatic backup cron into the user's current project. The pattern: every 6 hours, snapshot Convex prod data plus critical droplet state, upload to a DigitalOcean Spaces bucket under `backups/<UTC-iso>/`, and prune to the latest N folders. (Convex Pro's built-in dashboard backups are daily/weekly with 7/14-day retention — this cron covers what those don't: 4x-daily frequency, your own bucket + retention policy, and droplet state.)

## When this skill applies

- Database is **Convex** (presence of `convex/`, `packages/convex/`, or `"convex"` in `package.json` deps).
- Object storage is **DigitalOcean Spaces** (`DO_SPACES_KEY` / `DO_SPACES_SECRET` / `DO_SPACES_ENDPOINT` in any `.env*` file).
- App deploys via **SSH to a single server** (typically a DO droplet) — i.e. there's a `scripts/deploy*.sh` or similar that uses `rsync`/`ssh` to push to a host.

If any of these is missing, surface what you found and what's missing, then ask the user before proceeding. Do not bolt this onto a non-matching stack.

## Step 1 — Detect

Run these inspections in parallel before writing anything:

1. **Convex?**
   ```bash
   ls convex packages/convex 2>/dev/null
   grep -l '"convex"' package.json packages/*/package.json 2>/dev/null
   ```
2. **DO Spaces creds present?** (grep, never print values)
   ```bash
   grep -lE '^(DO_SPACES_KEY|DO_SPACES_SECRET|DO_SPACES_ENDPOINT)=' .env* 2>/dev/null
   ```
   Note which env file(s) hold them.
3. **Convex deploy key present?**
   ```bash
   grep -lE '^CONVEX_DEPLOY_KEY=' .env* 2>/dev/null
   ```
4. **Deploy server & dir?** Look at `scripts/deploy*.sh` for `OPTIC_DEPLOY_SERVER`/`DEPLOY_SERVER` env defaults and `DEPLOY_DIR`. Extract `user@host` and `/opt/<app>`. If absent, ask the user.
5. **Env-file convention on the droplet?** SSH and list:
   ```bash
   ssh <user@host> 'ls -la /opt/<app>/.env* 2>/dev/null'
   ```
   Map which file holds DO_SPACES vs CONVEX_DEPLOY_KEY. Standard pattern after the 2026-05 refactor is `.env.production` (synced) + `.env.do` (droplet-only). If the project uses different names, **respect what's there** — don't force a rename mid-flow. Note the convention and use it in script lookups.
6. **AWS SDK installed?** `grep '@aws-sdk/client-s3' package.json` — if absent or only in `devDependencies`, it must move to `dependencies` (cron runs in prod without dev deps).

## Step 2 — Write `scripts/backup-prod.mjs`

This is the backup runner. Copy `templates/backup-prod.mjs` (beside this SKILL.md) to `scripts/backup-prod.mjs` verbatim, then substitute:
- `<project>` in the header comment and `/opt/<APP>` (two places: `loadEnv()` and `main()`) with the real deploy dir.
- The `loadEnv()` candidate list (marked `// ADJUST`) to match the project's env-file naming convention.
- The droplet-tarball `candidates` array if the project uses different paths (e.g. no nginx, no certbot).

## Step 3 — Write `scripts/install-backup-cron.sh`

Copy `templates/install-backup-cron.sh` to `scripts/install-backup-cron.sh` verbatim, then substitute `<USER@HOST>`, `/opt/<APP>`, `<app>` (cron/log/lock file names) and `<project>` (cron header comment). Adjust `ENV_FILES` if the droplet uses a different env-file convention. It is idempotent, rsyncs + SSHes from the laptop, and supports `--test` / `--uninstall`.

## Step 4 — `package.json` scripts

Add (don't duplicate if present):
```json
"backup:run": "node scripts/backup-prod.mjs",
"backup:install-cron": "bash scripts/install-backup-cron.sh",
"backup:test": "bash scripts/install-backup-cron.sh --test",
"backup:uninstall-cron": "bash scripts/install-backup-cron.sh --uninstall"
```

## Step 5 — Move `@aws-sdk/client-s3` to dependencies

If it's currently in `devDependencies` (or missing), move/add it under `"dependencies"` in root `package.json` with `^3.x`. The cron runs without dev deps installed, so it has to be a runtime dep. After editing, run `pnpm install --ignore-scripts` to update `pnpm-lock.yaml`.

## Step 6 — Auto-install hook on every deploy

If the project has a deploy script (e.g. `scripts/deploy-app.sh`, `scripts/deploy.sh`), insert a step at the very end that refreshes the cron — non-fatal:

```bash
# Refresh backup cron (idempotent, non-fatal).
if bash scripts/install-backup-cron.sh 2>&1; then
    echo "[OK] Backup cron up to date"
else
    echo "[WARN] Backup cron install skipped — set CONVEX_DEPLOY_KEY in .env.do/.env.production"
fi
```

Place it AFTER the rolling update but BEFORE the final container-status report.

## Step 7 — Run the test if prerequisites are met

If all 4 required env vars (`DO_SPACES_*`, `CONVEX_DEPLOY_KEY`) are present on the droplet, run:
```bash
pnpm backup:test
```
and report the result, confirming the script's output lists the new `backups/<stamp>/` folder.

## Step 8 — Prompt for missing pieces

After the install, generate a checklist of anything missing, because a cron with a missing secret fails quietly at 6-hour intervals. Print exactly which secrets the user needs to create, where to create them, and the one-line shell command that puts them in the right place.

### If `DO_SPACES_*` are missing or no bucket is set

Tell the user:
> The backup needs a DigitalOcean Spaces bucket. Create one:
> 1. Go to https://cloud.digitalocean.com/spaces/new
> 2. Region: same as your droplet (e.g. `lon1`)
> 3. Name: e.g. `<app>-backups` (private, restricted file listing)
> 4. Generate Space access keys at https://cloud.digitalocean.com/account/api/spaces — copy the key + secret.
> 5. Add to `/opt/<app>/.env.do` on the droplet:
>    ```
>    DO_SPACES_KEY=...
>    DO_SPACES_SECRET=...
>    DO_SPACES_ENDPOINT=https://<bucket>.<region>.digitaloceanspaces.com
>    ```
>
> Or, to paste without it landing in this chat:
> ```
> ssh <user@host> 'cat >> /opt/<app>/.env.do' <<EOF
> DO_SPACES_KEY=...
> DO_SPACES_SECRET=...
> DO_SPACES_ENDPOINT=...
> EOF
> ```

### If `CONVEX_DEPLOY_KEY` is missing

> The backup needs a Convex prod deploy key to authenticate `convex export`. Generate one:
> 1. Go to your prod deployment in https://dashboard.convex.dev
> 2. Settings → General → "Deploy keys" → generate one (scope its permissions minimally if offered) → copy the `prod:<name>|<key>` value.
> 3. Add it to `/opt/<app>/.env.do` without echoing to your shell history:
>    ```bash
>    ssh <user@host> 'read -rsp "Paste Convex prod deploy key: " K && echo && \
>      sed -i "/^CONVEX_DEPLOY_KEY=/d" /opt/<app>/.env.do && \
>      printf "\nCONVEX_DEPLOY_KEY=%s\n" "$K" >> /opt/<app>/.env.do'
>    ```
> 4. Then re-run `pnpm backup:test` to validate.

### If env file convention is ambiguous

Tell the user what files exist and which currently hold what, then ask: "Should `CONVEX_DEPLOY_KEY` live in `.env.do` (server-only) or `.env.production` (synced by deploy)?" Default recommendation: `.env.do` for tier-1 secrets.

## Pitfalls — common things that bite during install

1. **`@aws-sdk/client-s3` in devDependencies** — `pnpm install --prod` skips it, cron fails with `ERR_MODULE_NOT_FOUND`. Always move to `dependencies`.
2. **S3 PUT with stream Body** — without explicit `ContentLength`, DO Spaces rejects with `ERR_HTTP_INVALID_HEADER_VALUE` on `x-amz-decoded-content-length`. Always pass a `Buffer` and set `ContentLength: body.length`.
3. **`runStep` not awaiting** — wrap with `async fn() { await ... }`. Otherwise prune runs before uploads finish, and "backup complete" logs prematurely.
4. **Partial rsync from install script** — only syncing scripts without `package.json`/workspace manifests causes pnpm lockfile-mismatch errors. Either rsync the whole working tree, or accept that the script depends on a prior `pnpm ship` having landed the manifests.
5. **Build-arg env vars in `.env.do`** — if `docker-compose.yml` interpolates a var like `${SOME_KEY}` at build time and that var only lives in the server-only `.env.do`, the deploy script must source BOTH `.env.production` AND `.env.do` (in that order, so `.env.do` wins). Check this when standardizing env file names.
6. **Bucket parsing from endpoint** — DO Spaces endpoints come as `<bucket>.<region>.digitaloceanspaces.com` OR `<region>.digitaloceanspaces.com` (no bucket). The script must handle both; require `BACKUP_BUCKET` override only when bucket isn't in the URL.
7. **Cron PATH** — `cron` runs with a sparse env. Set `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` and `SHELL=/bin/bash` at the top of `/etc/cron.d/...` so `node`/`npx`/`flock` resolve.
8. **Convex `--prod` vs deploy key** — `npx convex export --prod` requires interactive auth. Use `CONVEX_DEPLOY_KEY=prod:...|...` as an env var and call `npx convex export --path ...` (no `--prod` flag); the deploy key scopes it to prod automatically.

## Restore (include in the summary you give the user)

```bash
# Download the snapshot
aws s3 --endpoint-url https://<region>.digitaloceanspaces.com \
  sync s3://<bucket>/backups/<timestamp>/ ./restore/

# Restore Convex — --replace-all mirrors the snapshot exactly (deletes tables
# not in the zip); use --replace to only overwrite tables present in the zip.
cd packages/convex
CONVEX_DEPLOY_KEY=prod:... npx convex import --replace-all -y ../restore/convex.zip

# Restore droplet state (env + certs)
scp restore/droplet.tar.gz <user@host>:/tmp/
ssh <user@host> 'tar -xzf /tmp/droplet.tar.gz -C /'
```

## What "done" looks like

You finish only after:
1. `scripts/backup-prod.mjs` + `scripts/install-backup-cron.sh` exist and have correct paths/server/app-name substitutions for THIS project.
2. `package.json` has the 4 backup scripts + `@aws-sdk/client-s3` in `dependencies`.
3. The deploy script (if present) has the auto-install hook.
4. Either: a test backup ran successfully AND the bucket has the new folder, OR a clear checklist of missing secrets is printed with copy-pasteable commands.
5. A one-paragraph summary: cron schedule, log location, retention, restore command.

Written files are not the finish line. The success criterion is "the cron will fire and back up successfully", so verify with `pnpm backup:test` whenever the prerequisites are in place.
