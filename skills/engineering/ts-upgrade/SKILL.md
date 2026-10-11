---
name: ts-upgrade
description: Move a repo's type checking to TypeScript 7 (the native Go compiler, about 3 to 10x faster) without breaking ESLint, tsup, Next, Expo, Remotion, Convex, CI or Docker builds. Detects each package's tools and install layout, installs TS 7 directly or beside 5.x/6.x, fixes the tsconfig options TS 7 removed, and measures before and after. Use when the user runs /ts-upgrade, asks to upgrade TypeScript, move to TS 7 / tsgo / the native compiler, or make type checking faster in a repo.
argument-hint: "[repo path, default: the current repo]"
---

# ts-upgrade

TypeScript 7.0 (npm `typescript@7.0.2`, July 2026) is the Go port of `tsc`. It checks the
same files and reports the same errors, 3 to 10x faster, on several cores. It has **no
JavaScript API** until 7.1: `require('typescript')` on 7 succeeds (it returns
`lib/version.cjs`), and the caller fails later with a TypeError such as
`reading 'Intrinsic'`. The whole job is deciding, per package, which side of that line it sits
on, and where the compiler actually gets installed.

Measured across eight repos (pnpm, bun, npm; same files, same error sets): small packages
5 to 11x, Next apps 4 to 8x (web 16.6s to 1.5s, 49.8s to 11.5s), Convex 3 to 5x, a
1,000-file Convex project 77s to 15s.

## Rules

- **Own your paths.** Run `git status --porcelain` first. `detect.mjs` also lists the files an
  upgrade edits (package.json, lockfiles, tsconfigs, Dockerfiles, CI, next.config) that are
  already dirty. If one you need is dirty, another session holds it: **stop and report**, or
  upgrade only the packages whose files are clean. Committing a path commits the whole file,
  so it would sweep their hunks. Never touch, revert, format or stage another session's work.
- **Commit by path**, one concern per commit, never `git add -A`, stash, reset, checkout or
  restore. A pre-commit hook that runs the type check counts as a type-check run (wrap it,
  below).
- **Never run the app, a dev server, a deploy or `ship`.** Typecheck, tests and lint only.
- **Measure, don't claim.** Every number comes from a command in this session. Time each
  package as a **back-to-back pair** (old then new, nothing in between) and note `uptime`.
  When anything else may be type-checking at the same time, wrap every check in
  `${CLAUDE_SKILL_DIR}/scripts/serial.sh` (`serial.sh sh -c 'cd pkg && ...'` for compound
  commands) so runs take turns. Write scratch files under a name that includes the repo.
  Run the shell snippets in bash; zsh does not word-split unquoted variables.
- **Same error set or explain it.** See step 5.

## Steps

### 1. Inventory

```bash
node ${CLAUDE_SKILL_DIR}/scripts/detect.mjs <repo>
```

Read all of it before editing. It reports:
- **Layout:** package manager; whether `node_modules` is hoisted; lockfiles; leftovers such as
  a `pnpm-workspace.yaml` in a bun repo; nested projects with their own lockfiles, which need
  their own installs.
- **Dirty files:** the upgrade files another session already holds.
- **Per package:** the `typescript` spec and the version actually installed (and where), the
  tsc scripts, the tools that load the TS API, and the strategy. It warns when a package has no
  `typecheck` script.
- **tsconfig:** options TS 7 rejects, and how many configs have no `types`.
- **Convex projects:** what typescript each one resolves, and **NONE** means `convex dev` has
  been silently skipping its check.
- **CI steps** that call `tsc` directly.
- **Dockerfiles** that build, and Next `ignoreBuildErrors`.

The API list is a list of direct dependencies. When unsure, confirm with a search:
`grep -rlE "require\(['\"]typescript['\"]\)|from ['\"]typescript['\"]|['\"]typescript['\"]\)" node_modules/<tool>`.

### 2. Baseline

Per package with a type check, resolve the compiler the way node does (hoisting included),
run it cold, and keep the output:

```bash
cd <pkg>
TSC=$(node -p "require.resolve('typescript/bin/tsc')")
serial.sh sh -c "/usr/bin/time -l node $TSC --noEmit --incremental false -p tsconfig.json > /tmp/<repo>.<pkg>.ts5.txt 2>&1"
```

`--incremental false` matters: Next tsconfigs set `incremental: true`, and a warm
`.tsbuildinfo` makes a run look 10 to 50x faster. Use the package's own `typecheck` flags if it
has extras. Record time, peak memory and the error list. Errors already on the branch stay.

### 3. Install, per strategy

| Strategy (from detect) | Do |
|---|---|
| **direct** (nothing loads the TS API) | `typescript` becomes `7.0.2`. Its `tsc` scripts run 7 with no edits. Convex in that package uses it automatically |
| **side-by-side** (ESLint via `eslint-config-next` / `typescript-eslint`, `tsup` dts, `ts-jest`, `ts-morph`, Expo, Remotion, cosmiconfig, Vue/Svelte/Astro/Angular checkers, typedoc, etc.) | Keep `typescript` as is. Add `"@typescript/native": "npm:typescript@7.0.2"` to devDependencies. Point `typecheck` (and any `check-types`, `lint: tsc --noEmit`) at the 7 binary **by path**. If there is no `typecheck` script, add one |

Where the alias lands decides the path:
- **Isolated layouts** (pnpm default): `node_modules/@typescript/native/bin/tsc` inside the
  package.
- **Hoisted layouts** (bun default, npm, yarn classic, pnpm `shamefully-hoist` /
  `node-linker=hoisted`): the alias lands in the **root** `node_modules`, so a package script
  uses `../../node_modules/@typescript/native/bin/tsc`. Check the real location with
  `node -p "require.resolve('@typescript/native/package.json')"` from the package.

Hoisted layouts have three more traps:
- **Root `tsc` flips.** Both packages ship a `tsc` bin, and the root `.bin/tsc` may now point
  at 7. Any package with no typescript copy of its own that runs plain `tsc` gets 7. Check with
  `<pm> run tsc -v` (or `npx tsc -v`) in each package and say which ones changed.
- **Keep the root `typescript` on 5.x/6.x** when shared tools load it. `ts-api-utils` (under
  ESLint) loads the root copy, and moving most packages to 7 can hoist 7 to the root and crash
  lint. Pin the old version in the root devDependencies.
- **Stale nested copies.** bun can leave old `node_modules/typescript` folders in packages.
  Report them; don't delete another session's state.

Package-manager notes:
- **pnpm with a root override** (`pnpm-workspace.yaml` `overrides: typescript: "5.9.3"` or
  `pnpm.overrides`): a plain bump is overridden. For direct packages add scoped overrides,
  `"<package-name>>typescript": "7.0.2"`. The npm alias is not touched by a `typescript`
  override.
- **bun**: aliases work the same. `bun install`, or `bun install --lockfile-only` to write
  `bun.lock` without touching `node_modules`.
- **Never `pnpm install --filter` to dodge dirty files.** It still writes the other session's
  manifest changes into the lockfile and can prune their packages from the store (it broke two
  Next apps' `next` link once). Use a scratch worktree with `--lockfile-only`, or stop.
- **Isolated pnpm has traps too.** A workspace package that loads typescript-eslint without
  declaring `typescript` gets the newest one in the tree (7.0.2) as its peer, even outside the
  peer range: give such packages (an eslint config package, for one) an explicit
  `"typescript": "^5.x"`. The root `typescript` is the fallback for any undeclared
  `require('typescript')` (Remotion's bundler hits it), so keep the root on 5.x/6.x when
  anything relies on that. A package's own `.bin/tsc` points at 7 once the alias is installed.
- **Splitting a lockfile across two commits:** run the install for the first concern, commit,
  then the second. If another session's dirty package.json would land in the lockfile, install
  in a scratch `git worktree` instead and copy only your lockfile hunks back, or stop.
- **Prove it after installing:** the 7 binary prints `Version 7.0.2`, and a side-by-side
  package's `typescript` still prints the old version. Check the lockfile diff and name any
  pruned entries in the commit.
- **Expo** pins `typescript ~6.0` and its CLI resolves typescript at runtime: always
  side-by-side.

### 4. tsconfig options TS 7 rejects

TS 7 stops with a config error on these. Fix them so the old compiler still accepts the file:

| Option | Fix |
|---|---|
| `baseUrl` | Remove. Every `paths` target becomes `./`-relative (`"src/*"` to `"./src/*"`). Bare imports that relied on baseUrl now fail; TS 7 reports them, so fix each import |
| `alwaysStrict: false` | Remove |
| `moduleResolution: node`/`node10`/`classic` | `bundler` for bundled apps. With `module: commonjs`, use `module` and `moduleResolution` both `nodenext` (`bundler` with commonjs is TS5095 on 5.x; nodenext gave byte-identical emit) |
| `module: amd`/`umd`/`system`/`none` | `esnext` or `nodenext` |
| `target: es5`, `downlevelIteration` | `es2015` or later; remove `downlevelIteration` |
| `esModuleInterop: false`, `allowSyntheticDefaultImports: false` | Remove |

TS 7 defaults: `strict` true, `module` esnext, `types` `[]`, `rootDir` `./`,
`noUncheckedSideEffectImports` true (CSS side-effect imports then report TS2882: add a
`declare module '*.css';` or set the option to false explicitly). **Set it before you push
for any app that imports CSS for side effects (Expo with NativeWind, Next, Vite)**: generated,
gitignored types (`expo-env.d.ts`, `.expo/types`, `.next/types`) can declare `*.css` on your
machine and be absent on a fresh CI checkout, so the local check passes and CI fails. A config with no
`types` loses ambient globals: a Convex project went from 0 errors to 36 (`process`,
`crypto`). Add `"types": ["node"]` (plus test globals where used) when TS 7 reports them.

After editing a tsconfig, run the **old** checker on it too. It must still pass, because Next,
ESLint and editors keep reading it with 5.x/6.x.

### 5. Check with TS 7 and compare

Run the new checker per package, cold, as the back-to-back partner of step 2, and diff the
error lists by file and code:

```bash
diff <(grep -o '^[^(]*([0-9,]*): error TS[0-9]*' ts5.txt | sed 's/([0-9,]*)//' | sort) \
     <(grep -o '^[^(]*([0-9,]*): error TS[0-9]*' ts7.txt | sed 's/([0-9,]*)//' | sort)
```

- **Same set:** done.
- **Known shifts, not new errors:** TS6133 points at the identifier rather than the
  declaration, an unused type-only import is TS6196, and some TS2322 become TS2353. Match them
  by message and line, then count them as the same error.
- **A real new error:** run the TS 7.1 nightly on the same tsconfig (`npm i typescript@next`
  in a scratch dir, call its `bin/tsc`). If 7.1 doesn't report it, it's a 7.0.2 bug: make a
  behaviour-preserving rewrite and say so in the commit. Known one: **TS2871 "This expression
  is always nullish"** on `(cond ? (x ?? null) : null) ?? y` and the `undefined` form. Rewrite
  to `(cond ? x : null) ?? y`; `null` and `undefined` both fall through `??`. If 7.1 reports it
  too, it's a real finding: report it, and fix it only when the user wants code changes.
- **Generated files:** a clean checkout lacks gitignored generated types (`.next/types`,
  `expo-env.d.ts`). Run `next typegen` (Next 16+) first, or note that the spurious error
  comes from the missing file.
- **Memory:** TS 7 runs 4 checkers by default, so peak memory can go **up** 25 to 50% even
  as time drops 4x. Also measure `--checkers 2` and `--checkers 1` on the largest package. On a
  memory-tight machine, put the cheaper setting in the `typecheck` script. Examples:
  - 13.3s at 1.9 GB on one checker, against 11.5s at 3.6 GB on four
  - 1.95s on two checkers with peak memory down 25%
- **Incremental cache:** a side-by-side `typecheck` that shares `tsconfig.tsbuildinfo` with
  the old compiler makes each one throw the other's cache away. Give the TS 7 script its own:
  `--tsBuildInfoFile node_modules/.cache/tsbuildinfo-ts7`.

### 6. Places that run their own type check

- **CI.** detect lists steps that call `tsc` directly (`npx tsc`, `bunx tsc`). Those still run
  whatever `tsc` resolves to. Change them to the package script (`<pm> run typecheck`).
- **Convex.** `convex dev` runs `node_modules/typescript/bin/tsc` relative to the Convex
  package. Recent CLIs (seen from 1.43) try `node_modules/@typescript/native/bin/tsc` first, so a
  side-by-side alias in that package also moves `convex dev` to 7.
  - In hoisted layouts a Convex folder with no typescript of its own resolves **nothing**,
    and the check has been silently skipped. Turning it on can surface existing errors on
    every push. Report the count and ask before enabling.
  - Remove `--typecheck disable` from dev scripts when it was there for speed, and drop
    `"typescriptCompiler": "tsgo"` from `convex.json`. Leave it on deploy scripts.
  - A Convex project that shares a side-by-side root package stays on the root's compiler;
    say so.
- **Next 16.3+ `next build`** type-checks with whatever `typescript` resolves from the app,
  so a side-by-side app's build still runs 5.x/6.x. In a Dockerfile that builds the app, skip
  Next's pass and run TS 7 after the build exits:

  ```dockerfile
  # Next's own type check would run the app's old typescript (kept for ESLint).
  ENV <FLAG_NEXT_CONFIG_READS>=1
  RUN <existing build>
  # After the build, so changing it never invalidates the build layer.
  ARG SKIP_TYPECHECK=0
  RUN if [ "$SKIP_TYPECHECK" != "1" ]; then <pm> exec next typegen && <pm> run typecheck; fi
  ```

  Wire the flag through the env var `next.config` reads for `typescript.ignoreBuildErrors`,
  or add one (`ignoreBuildErrors: process.env.X === '1'`). If `ignoreBuildErrors: true` is
  hard-coded, find out why (often the deploy script checks types first). Leave it, and add the
  TS 7 step only if the user wants it. Check `.dockerignore`: it may drop the folders that hold
  the errors, so the image check sees a different file set than local. TS 7's Linux binaries
  are static Go executables and run on Alpine. Docker changes can't be verified without a
  build: say so.
- **Turbo strict env mode** (`envMode: strict`) drops env vars a task does not declare, so a
  skip flag set in a Dockerfile never reaches `next build`. Add it to that task's
  `passThroughEnv` in `turbo.json`.
- **Committed emit.** A package whose `tsc` writes into the repo (`outDir: ./src`, committed
  `.d.ts`) will be re-emitted by 7 with different quoting. Say so; do not commit unrelated
  re-emits.

### 7. Commit and report

Commit each concern on its own, by path, with the numbers in the body and the words
"TypeScript 7":
1. Direct packages, with overrides and the lockfile.
2. Side-by-side packages, with tsconfig fixes, any 7.0.2 workaround lines and the lockfile.
3. CI steps.
4. Convex dev typecheck, only if it changes behaviour.
5. Dockerfiles, if any.

Report a table per package: before, after, speedup, peak memory, and errors before and after.
Include:
- the load averages
- which packages now get 7 from a plain `tsc`
- anything blocked by dirty files
- what wasn't verified (Docker, CI run, editor)
- the editor step: the VS Code "TypeScript 7" extension (`TypeScriptTeam.native-preview`)
  changes only the editor, not the repo

## Pitfalls already paid for

- A root `typescript` override silently wins over a package bump (pnpm). Check the version in
  the package after install.
- Hoisting moves the alias, `.bin/tsc` and the root copy that ESLint loads. Most surprises in
  bun and npm repos come from this.
- `next build` on 16.3+ uses the `tsc` CLI, not the API, so a direct-strategy Next app with no
  ESLint gets TS 7 in its build too.
- `@remotion/bundler` calls `readConfigFile` and silently skips your tsconfig without the
  API. Keep Remotion packages side-by-side.
- The Rust port `tsc-rs` (pingdotgg/ts-rust) was another 1.6 to 2.3x faster in testing, but it
  is unreviewed and tracks an unreleased TS build. Don't make it the default; mention it if
  asked.
