---
name: build-speed
description: Audit and fix any project's build + deploy pipeline for speed — kill cache-busting, move builds off the deploy box into CI, wire registry pull mode, and prove every fix with measurements. Use when the user runs /build-speed, says a build/deploy/ship is slow, or asks to optimise shipping on any project.
---
# Build Speed

Make a project's ship path as fast as it can honestly be, and **prove each number**.

Supersedes `ship-optimisation` as the entry point: it carries that checklist (sections A–F) and adds the CI/registry correctness layer, which is where every real failure in practice has landed. If `ship-optimisation` is installed, you do not need to run it separately.

**Calibration from real runs** (use to sanity-check your own numbers, not to quote as the user's):

| Pipeline | Before | After |
|---|---|---|
| 5-project sweep, CACHEBUST removal | 256s every deploy | 9s on an unchanged-source commit (21 layers CACHED) |
| 3-app monorepo, build moved to CI | 7m31s deploy (7m13s build) | build leaves the deploy path; CI cold 12m13s / warm ~2m / retag-only 51s |

## The one rule

**A green run that did nothing proves nothing.** The most expensive mistake in this work is believing a pipeline works because it exited 0. Force the real path — a real build, a real cache hit, a real pull — or report it as unverified. Say which.

## Phase 0 — Baseline before touching anything

Without a before-number, every "improvement" is a guess.

1. Get the current timings from the user's own output (deploy summary, CI run durations) or run the deploy once if they've authorised it.
2. Split the total into **build vs everything else**. The split decides the whole strategy: build-dominated → move it off the box (§C); deploy-dominated → probes and parallelism (§B, §D).
3. Record cold vs warm separately. One number hides which you measured.

Capture exit codes directly. `st=$( { time cmd; } | grep real )` captures **grep's** status, not the command's — a bug that has twice produced false "exit=1" reports.

## Phase 1 — Locate the pipeline

Find: deploy entrypoint (`package.json` ship/deploy scripts, `Makefile`, `scripts/deploy*.sh`), every Dockerfile for a deployed service, the prod compose file, any change-detection script, and CI workflows that build images. Confirm the SSH host if the deploy is remote — several checks are only provable there.

**Read each script's input contract before judging it.** A detector that takes `CHANGED_FILES_OVERRIDE` as an env var will fail open and print every service when you call it with positional args — that looks exactly like a bug and is not one.

## Phase 2 — Audit. Evidence first, fixes second.

Record FOUND/CLEAN with `file:line` for every item before changing anything.

### A. Cache-busting (usually the biggest single win)

- [ ] `grep -rn "CACHEBUST\|date +%s\|RANDOM" <Dockerfiles, compose, deploy scripts>` — any timestamp fed to an `ARG` above the compile forces a 100% cold build on **every** deploy, forever. **Delete it.** BuildKit content-hashes `COPY`; unchanged source caches by itself. Document `--no-cache` as the escape hatch.
- [ ] Commit-SHA args (`GIT_SHA`, `VCS_REF`, `BUILD_ID`) declared in the **builder** stage bust the compile on every commit even with identical source. **Move the `ARG` to the final runner stage, AFTER the heavy `COPY --from=builder` lines** — before them, a new SHA re-exports those layers too.
- [ ] After removing a build arg from a Dockerfile, **grep the compose file and deploy script for it too**. A dangling `--build-arg` is only a warning, so it survives silently and misleads the next reader.
- [ ] `.dockerignore` excludes state that poisons content hashing: `node_modules`, `**/.turbo`, `**/*.tsbuildinfo`, `.next`, `dist`.
- [ ] Dependency layers: lockfile-only `COPY` + install before source `COPY`; compiler caches in `RUN --mount=type=cache`.
- [ ] Duplicated work: a `prebuild` hook plus an explicit pre-step runs it twice (pnpm `enable-pre-post-scripts=true` does this quietly).

### B. Health probes (silent minutes)

- [ ] `grep -n localhost <deploy script, compose healthchecks>` — in Alpine/musl, `localhost` resolves `::1` first and most servers bind IPv4 only, so probes fail until timeout on a container that is already healthy. **Use `127.0.0.1`.** Prove both forms with `docker exec`.
- [ ] Poll at ~1s to a ~90s cap, not long sleeps.

### C. Build off the deploy box (the structural win)

Moving the build to CI doesn't make building faster — it removes it from the path the user waits on. That is usually the largest improvement available.

- [ ] CI: matrix over services, per-service path filters, `cache-from/to: type=registry,ref=<image>:buildcache,mode=max`. **Not `type=gha`** — the 10 GB repo cap thrashes on multi-app repos and silently degrades to cold builds.
- [ ] **Lowercase the registry.** `ghcr.io/${{ github.repository }}` fails if the org has capitals: `invalid tag ...: repository name must be lowercase`. GitHub expressions have no lowercase function — compute it in a shell step into `$GITHUB_ENV`. Verify it byte-matches the deploy script's default registry, or CI pushes one place and the server pulls another.
- [ ] **Every commit must carry a tag for every service.** CI computes "changed" against the **previous commit**; the deploy script computes it against the **last deployed SHA**. Those diverge the instant two commits land between deploys, and the server asks for a tag CI never built. Fix: unchanged services get `docker buildx imagetools create --tag <reg>/<svc>:<sha> <reg>/<svc>:latest` — a registry-side manifest copy, seconds, no layers move. It is semantically correct: unchanged sources mean the previous image *is* this commit's image.
- [ ] **Bootstrap path.** If `:latest` doesn't exist there is nothing to copy, so build instead. Without this the first run leaves the registry empty and pull mode can never succeed.
- [ ] **A manual rebuild trigger.** Build-time config lives in CI variables; changing one touches no file, so nothing rebuilds and images silently keep stale values (e.g. after an auth-client rotation). Add a `force_build` dispatch input.
- [ ] `provenance: false` on build-push unless something consumes attestations — keeps tags plain single-platform manifests.
- [ ] Compose services carry BOTH `image: <reg>/<svc>:${IMAGE_TAG:-latest}` and `build:` (on-box fallback).
- [ ] Deploy `--pull` mode: registry-auth precheck **before** spawning background jobs, `compose pull`, same health-gated rolling update. Default the pull tag to the checked-out SHA so the server can never run a different commit than its HEAD.
- [ ] Precheck loops over **the services actually being deployed**, never a hardcoded one.

### D. Config: secrets vs variables

- [ ] **Public config belongs in CI variables, not secrets.** Anything `NEXT_PUBLIC_*`, an issuer, a client id — it already ships in the browser bundle. Secrets are worse than useless here: CI redacts any step output matching a secret, so routing public config through them bakes **empty strings** with no error.
- [ ] **Never put a write-capable credential in a build runner to read a public value.** A Convex/Vercel/cloud deploy key can push code to production. Fetching one public string with it trades a real blast radius for a cosmetic single-source-of-truth. Put the value in a variable and **check drift at deploy time** using the operator's own read-only session — that catches the same mistake at the only moment it matters, before the image goes live.
- [ ] Validate config in CI **before** the expensive build, and fail with `::error::`. An empty issuer or backend URL compiles clean and fails at runtime with nothing in the build log.
- [ ] Derive rather than store what can be derived (client id = last path segment of the issuer) so two values can't disagree.

### E. Compose portability

- [ ] `grep -n '\${[A-Z_]*:-\${' <compose>` — **nested `${A:-${B:?msg}}` is version-dependent.** Compose v5.0.1 evaluates the inner `:?` even when `A` is set and aborts; v5.3.1 resolves it fine, so it never reproduces on a laptop. Express "at least one of" in **bash** in the deploy script, where it is unambiguous on every host and fails before any image is built.
- [ ] `environment:` blocks using `${VAR:-}` **override** `env_file`. A bare `docker compose up` without a populated shell env silently blanks config. Always recreate through the deploy script (which does `set -a; source .env`).

### F. Deploy only what changed

- [ ] Change detection exists, and its path→service map matches the **current** services and the Dockerfiles' actual `COPY` inputs. Stale maps rot fast.
- [ ] Files a Dockerfile copies in must be matched **before** any blanket skip (a `scripts/*` skip silently swallows `scripts/lib/foo.cjs` that all images embed → images change, ship deploys nothing).
- [ ] Backend-only changes skip container work but still push the backend.
- [ ] **Fail open**: an undiffable SHA outputs ALL services, never none.
- [ ] `CHANGED_FILES_OVERRIDE` supported so the map is fixture-testable.
- [ ] Keep the CI path filters and this map in sync; say so in a comment in both.

### G. Parallelism and image diet

- [ ] Backend push and image build/pull share no state until cutover — run concurrently, capture **both** exit codes explicitly (never trust `set -e` with background jobs), abort before replacing any container.
- [ ] Rolling order respects `depends_on` or containers restart twice.
- [ ] `du -sh <app>/public` — hundreds of MB of media inflate every layer export and first pull. Flag it; don't block speed fixes on it. Check whether it's tracked in git (untracked media means CI and on-box images differ — a correctness bug, not just weight).
- [ ] Runtime image uses the framework's minimal output (`output: 'standalone'`).
- [ ] Disk headroom on the deploy box vs the prune threshold.

## Phase 3 — Verify. Mandatory, in this order.

1. `bash -n` every touched script. Parse workflow YAML. Run `actionlint` if available.
2. Fixture-test change detection via `CHANGED_FILES_OVERRIDE`: one case per mapping row, plus backend-only → empty, docs-only → empty, mixed, and fail-open.
3. **Cache proof** — temp clone, throwaway tags, never prod image names. Three results required:
   - cold build (baseline),
   - **new commit SHA, unchanged source → must be seconds and the compile step must print `CACHED`**. Grep the log for it; do not infer it from wall time,
   - edit one source file → must recompile.
   Then confirm the SHA still landed: `docker inspect` the image and check the env var. Removing it from the cache key must not remove it from the image.
4. **Registry proof.** Unauthenticated `docker manifest inspect` returns `denied` for a private image, which is **indistinguishable from absent**. Check auth first (`~/.docker/config.json`, token scopes — GHCR needs `read:packages`; `repo` scope is denied). Otherwise read the CI log for `pushing manifest for ...@sha256:` — that is authoritative.
5. **Exercise both CI branches.** A push touching only CI config skips every service and goes green having built nothing. Force a real build, and separately force the retag path (a commit touching only unmatched paths), and confirm which ran per service (`Retag=success Build=skipped`). Verify the retag copied the **same digest** the build pushed.
6. Health-probe proof in a running container, using the exact URL the script uses.
7. `docker compose config` with dummy env resolves every `image:` and `IMAGE_TAG`.
8. **Never run a production deploy to "test" this** unless the user explicitly asks. Hand over the command and what to watch. If they do ask, first check what a deploy would actually ship — another session's commits may be sitting on main.

## Output

1. **Findings table**: finding → `file:line` → time cost per deploy → fix → verification evidence.
2. **Before/after budget**, cold and warm separately, marking anything unmeasured as unmeasured.
3. **User-side activation** — registry login, CI variables, account-level things (larger or Blacksmith runners need a subscription; setting a runner label that doesn't exist makes jobs **queue forever** rather than fail, so never set one blind).
4. State plainly what you did **not** verify.

## Working rules

- Commit each fix as it verifies; one commit per concern. Check `git status` first and stage by pathspec — these repos often have concurrent sessions, and `git add -A` commits someone else's half-finished work under your message.
- Don't touch unrelated uncommitted changes.
- Two failed attempts at the same fix = stop and ask. Don't retry a third time.
- When a measurement contradicts your hypothesis, say so and correct it. A wrong root cause that "worked" will be re-applied by the next reader.
