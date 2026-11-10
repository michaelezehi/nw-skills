---
name: deployment-build-speed
description: >
  Install the house fast-ship pattern in a Docker project that deploys to a
  server with `pnpm ship`, `bun ship` or a deploy script: rebuild only the
  images whose inputs changed, pull CI-built images instead of compiling on
  the server, fall back to the on-server build when the registry has nothing,
  and never keep a registry token on the server. Use when the user says
  /deployment-build-speed, /dbs, "make ship faster", "ship is not using the
  cache", "only deploy what changed", or asks to roll the ship fix out to a
  repo. Alias: dbs. For a first audit with measurements, build-speed is the
  checklist; this skill is the fix that audit usually ends in.
---

# Deployment build speed

A ship gets faster by not doing work. Measured on a three-app monorepo:
8m 25s and still compiling on the server before, 3m 57s end to end after,
with all three images replaced (83s to pull them). A change that touches no
image input skips the image step entirely.

The pattern has five parts. Install the ones the repo is ready for, in this
order, and stop where the next part has nothing to stand on. Snippets for
every part are in [references/snippets.md](references/snippets.md).

## Before you edit

1. Read the ship entrypoint in `package.json`, the deploy script end to end,
   every Dockerfile it builds, the prod compose file and any workflow that
   builds images. Do not edit a script you have not read to the end.
2. Find what the user waits on. If a build log is to hand, the first step
   that is not `CACHED` names the input that changed. "The cache is broken"
   is usually a change map that selects too much.
3. Run `git status --porcelain`. Edit only your own paths. If the checkout is
   on a feature branch or holds someone else's work, make the change in a
   worktree of the default branch (`git worktree add <scratch> origin/<default>`)
   and push from there.
4. Never run the ship, a deploy, a build on the server, or anything over SSH
   that writes. Read-only SSH checks are allowed when the host alias works.
5. Answer three questions before choosing parts. They decided the outcome in
   most of the 15 repos this was rolled out to.
   - **Is there an image in the ship path at all?** A ship that pulls code and
     reloads a process manager has nothing for this pattern to speed up.
   - **Does the ship deploy a commit or the laptop's working tree?** A ship
     that copies the working tree can deploy uncommitted edits. A CI image
     holds only the commit, so a dirty tree must always build on the server.
   - **Where does the server build get its build-time config?** List every
     public variable the app code reads, then find where each comes from on
     the server. If any comes from a file git does not track (a hand-made
     `.env` in the build folder) or from a secret kept only on the server
     (a Server Actions encryption key), a CI image would be built without
     it and no URL label would notice. Then parts 3 to 5 stay out until that
     config is tracked, or the ship must refuse the pull whenever such a file
     exists.

## Part 1: no cache-busting

Delete any timestamp or random value fed to a build `ARG` above the compile
(`CACHEBUST`, `date +%s`). Move commit-SHA args to the final stage, after the
heavy `COPY --from=builder` lines. Remove the dangling `--build-arg` from the
compose file and the deploy script as well. Keep `--no-cache` as a documented
escape hatch.

Look for the quieter forms too: a `build --no-cache` in the deploy script, a
file the ship rewrites on every run sitting inside the build context (a
deployed-SHA marker), and a flag left behind with no value after an earlier
clean-up, which makes Docker read the next argument as a service name. Before
moving a commit-SHA arg out of the build stage, check whether the build reads
it (`generateBuildId`, a deployment id). If it does, leave it or accept that
the id becomes a per-build random value.

## Part 2: build only what changed

Applies when the repo deploys more than one image, or has a backend that is
pushed separately from the web image.

- A change-detection script maps changed paths since the last deployed SHA
  to services. It fails open (an undiffable SHA selects everything) and takes
  `CHANGED_FILES_OVERRIDE` so it can be tested with fixtures.
- Files the Dockerfiles `COPY` are matched before any blanket skip.
- Backend-only paths select no image. The ship still pushes the backend.
- Files `.dockerignore` drops (tests, docs, stories) select no image.
- A shared package is not one input. Look inside it for content only the
  backend consumes (email copy and templates, seed data, server-only code),
  grep the web apps for what they import from it, and skip the rest.
- Every narrowing gets a guard test that greps the app sources and fails,
  naming the row to widen, the day an app starts using that content.
- Prove the change on real history: run the last few deployed ranges through
  the old and the new script and put both outputs in the commit message.

A single-image repo with no separately pushed backend has nothing to select.
Say so and move on.

## Part 3: CI builds the images

Applies when the repo is on GitHub and deploys from the default branch.

- One workflow builds each service image on push, tags it with the commit
  SHA and `latest`, and uses a registry cache (`type=registry`, `mode=max`).
- The registry path is lowercase, computed in a shell step.
- Every commit ends with a tag for every service: unchanged services get a
  registry-side retag of `latest`, and a missing `latest` means build.
- "Unchanged" is measured against the commit `latest` was built from, read
  from an `org.opencontainers.image.revision` label, and decided by the
  ship's own change map. Never against the previous push with a separate path
  filter: a cancelled or failed build leaves `latest` one build behind, and
  the next push that does not touch the service copies that stale image onto
  a new SHA, which a pull-first ship then deploys. No readable label means
  build. Runs queue, they do not cancel each other.
- CI and the ship use one change map. A second filter drifts: one repo's CI
  had skipped 20 of the last 84 builds its own ship map called for.
- The workflow that builds images is not gated behind lint or tests that are
  already red, or no image is ever pushed. Check the last runs first.
- A `force_build` dispatch input exists, because editing a CI variable
  touches no file.
- A step frees runner disk before checkout. Large images run a hosted runner
  out of space during export.
- Build args mirror the compose `build.args` one for one, including the ones
  that only skip work.
- Public build-time config lives in repo variables, never secrets, and is
  validated before the build. The validator accepts the backend the project
  uses today, and rejects the one it left.
- Each image carries a label holding the backend URL it was built for.
- The workflow needs no secret beyond `GITHUB_TOKEN` and no access to the
  server.

If the repo already has a workflow that builds and deploys in one job over
SSH, leave that job alone. Add the image labels and the disk step, and note
that the build is already off the waiting path.

## Part 4: the ship prefers the registry

- The compose services name both `image: <registry>/<svc>:${IMAGE_TAG:-latest}`
  and `build:`.
- `--pull` is strict: a missing tag stops the deploy.
- `--prefer-pull` is what the default `ship` script passes. It checks the
  registry for the commit's tag for each service being deployed. A miss
  (CI still running, no login) falls back to the on-server build and restores
  `IMAGE_TAG` to what the caller gave.
- After a pull and before any container is replaced, the script reads the
  backend-URL label from each pulled image and compares it with the server's
  own env. A mismatch falls back to the build under `--prefer-pull` and stops
  under `--pull`.
- The check loops over the services actually being deployed.
- The ship also builds on the server, without trying the registry, when the
  working tree has uncommitted changes to image inputs (for a ship that
  copies the working tree) and when an env file the framework loads sits in
  the build context but is not tracked by git. Name the file in the warning,
  never print its contents.
- A pulled image is tagged with the local name the compose file and the
  rollback step already use, so nothing downstream changes.
- Pulled SHA-tagged images are never dangling. Add them to whatever clean-up
  the script already does, with the same age window.

## Part 5: no registry token on the server

The laptop half of the ship pipes the operator's own `gh` token to
`docker login` on the server over SSH stdin before the deploy, and logs the
server out when the deploy returns, on success and on failure. The token
needs `read:packages` (`gh auth refresh -h github.com -s read:packages`,
a one-time browser approval the user gives). Without `gh` or the scope the
ship warns and builds on the server.

## What stays out

- Staging keeps its on-server build unless CI builds a second set of images
  with staging URLs. One environment's images are not another's.
- Do not add a paid build service. The server's warm layer cache is the same
  thing a persistent builder sells.
- Do not change what the deploy does to containers: health gates, rolling
  order, rollback tags and env handling stay as they are.

## Verify, then stop

- `bash -n` on every touched script. Parse every touched workflow as YAML.
  Run `actionlint` when it is installed.
- Fixture-test the change map with `CHANGED_FILES_OVERRIDE`: one case per
  row you added, a backend-only case, a mixed case.
- Exercise the label check with a stubbed `docker` function: match,
  mismatch, unlabelled.
- Commit one concern per commit, by path, and push the default branch.
- Do not ship. Hand over the command. The first ship after this lands is the
  proof, and the report says it has not been run.

## Report

Per repo: which parts were installed, which did not apply and why, the
commits, what was checked and what was not, and anything the user must do
(a repo variable to set, the `read:packages` approval, a first forced image
build).
