---
name: optics-qa
description: Install the Optic SDKs (browser and/or Node) in this project, wire up the init code, and connect the security bridge — a probe run whose findings upload into the project's Security tab. Detects framework (Next.js / Vite / vanilla HTML / NestJS / Express / Next.js API / generic Node), installs from the self-hosted tarballs at optics-qa.com/sdk/v1/, mounts a provider or initializes the server-side SDK, sets env vars for local/staging/prod, and adds the pentest preflight + CI upload. Idempotent — safe to re-run to upgrade.
disable-model-invocation: true
---
# /optics-qa — install Optic in this project

You are wiring the Optic SDKs into the user's current project. Optic captures errors, sessions, and network activity for QA / debugging, then surfaces them in the dashboard at https://optics-qa.com.

A project may need:
- **Browser SDK** (`@optic/browser`) — for any JS that runs in the user's browser (Next.js client code, Vite/React, Vue, plain HTML)
- **Node SDK** (`@optic/node`) — for anything running in a Node process (NestJS, Express, Fastify, Next.js API routes via `instrumentation.ts`, Convex actions, workers, scheduled jobs, CLI tools)
- **Both** — most full-stack apps want both, with separate keys (publishable for FE, secret for BE)

## Truth — what you're working with

### Browser SDK (`@optic/browser`)
- **Tarball install URL** — `https://optics-qa.com/sdk/v1/optic-browser-latest.tgz` (or pinned `optic-browser-{version}.tgz`).
- **CDN script tag** — `https://optics-qa.com/sdk/v1/optic.js` (~300 KB IIFE, exposes `window.Optic`).
- **Init API** — `Optic.init({ projectKey: 'pk_live_...', serviceName?, environment?, transport?: { endpoint }, ... })`. **Always `projectKey`, never `dsn`.**
- **Project keys** — `pk_live_*` / `pk_test_*` (publishable) from the dashboard at `optics-qa.com/<org>/<project>/settings/api-keys`. Plaintext is shown once at creation.
- **Defaults** — ingest endpoint `https://optics-qa.com/api/ingest` (built-in since 0.1.1). `serviceName` defaults to `window.location.hostname`.

### Node SDK (`@optic/node`) — v0.3.0+
- **Tarball install URL** — `https://optics-qa.com/sdk/v1/optic-node-latest.tgz` (or pinned `optic-node-{version}.tgz`).
- **No CDN bundle** — server-only, install via npm always.
- **Init API** — `Optic.init({ secretKey: 'sk_live_...', serviceName?, environment?, captureUnhandled?, ... })`. Use `secretKey`, not `projectKey` or `dsn`: the Node SDK takes only a secret key.
- **Server keys** — `sk_live_*` / `sk_test_*` (secret) from the same API Keys page. **Never expose secret keys client-side.** The SDK refuses to init with a `pk_*` key.
- **Auto-capture** — `uncaughtException` + `unhandledRejection` are captured automatically (default `captureUnhandled: true`); on capture the SDK flushes then exits the process (Sentry-standard pattern). Disable with `captureUnhandled: false` if the user has their own crash handler.
- **Service name** — defaults to `package.json` `name` field. Override per-service when one Optic project ingests events from multiple services (api/worker/cron).
- **Express adapter** — `import { opticRequestHandler, opticErrorHandler } from '@optic/node/express'` provides per-request scope (AsyncLocalStorage) so concurrent requests don't leak user/tag context.
- **Defaults** — ingest endpoint `https://optics-qa.com/api/ingest`, batch size 50, flush interval 5s.

### Cross-cutting
- **Env-aware** — typical pattern is one publishable key + one secret key per environment (local/staging/prod). Set in matching `.env*.local` files. The dashboard groups events by `environment` tag, so the same key + a per-env tag also works.
- **Init beacon** — both SDKs fire a one-shot `sdk_init` event on `Optic.init()` so the dashboard's Services widget shows the service the moment its first process boots, no errors required.

## Config reference — every prop both SDKs support

The full prop tables for `@optic/browser` and `@optic/node` `Optic.init({ ... })`, both SDKs' public methods, the Express adapter (`opticRequestHandler` / `opticErrorHandler`) options, and the "when to enable the optional knobs" table live in `reference.md` beside this SKILL.md. Read it when the user asks "what else can I configure?" or when their use case needs something beyond the default init. **Prefer the minimal init in Step 2 unless the user has a specific reason to enable more** — defaults are tuned for the common case.

## Step 1 — Detect what you're working with

Run these and read the outputs:

```bash
# Are we in a JS project?
ls package.json 2>/dev/null

# Is it a monorepo?
ls pnpm-workspace.yaml turbo.json nx.json lerna.json 2>/dev/null

# Which package manager? (presence of lockfiles)
# bun.lock is the text lockfile default since Bun 1.2; bun.lockb = older repos.
ls pnpm-lock.yaml yarn.lock package-lock.json bun.lock bun.lockb 2>/dev/null

# Framework hints — read package.json `dependencies` keys.
# Frontend:  next, vite, react-router (framework mode, ex-Remix), astro, svelte, react, vue
# Backend:   @nestjs/core, express, fastify, hono, @hono/node-server,
#            koa, polka, restify, convex
# Both:      next (App Router with API routes / instrumentation.ts)
```

For monorepos, list every app under `apps/*` (or wherever the workspace puts them) and classify each as Frontend, Backend, or Both. Ask the user which apps to instrument if there are several and the answer isn't obvious.

Branch on what you find:

| Project shape | Routes |
|---|---|
| Next.js (any router) — frontend only or full-stack | Step 2A (FE) and/or Step 2D (BE) |
| Vite + React/Vue | Step 2B |
| Plain HTML / static site | Step 2C |
| NestJS (Fastify or Express adapter) | Step 2D |
| Express / Fastify / Hono / Koa | Step 2D |
| Worker / CLI / scheduled job (no HTTP framework) | Step 2D, skip the framework adapter |
| Multi-package monorepo with several apps | Run the appropriate step for each app |

## Step 2A — Next.js frontend install

1. **Install the tarball.** Use the project's package manager and (if monorepo) the `--filter` for the right app.

   ```bash
   pnpm add https://optics-qa.com/sdk/v1/optic-browser-latest.tgz
   # monorepo: pnpm --filter <app-name> add https://optics-qa.com/sdk/v1/optic-browser-latest.tgz
   ```

2. **Next.js 15.3+ (including 16) — use `instrumentation-client.ts`.** Check the installed `next` version first. Create the file at the project root (or in `src/` — same level as any existing `instrumentation.ts`). It runs after the HTML loads and before hydration, so Optic captures errors from the earliest moment. No provider component, no `useEffect`, no layout edit:

   ```ts
   // instrumentation-client.ts
   //
   // Env (set in `.env.local` / per-environment files):
   //   NEXT_PUBLIC_OPTIC_KEY       Publishable key. Unset → SDK silently no-ops.
   //   NEXT_PUBLIC_OPTIC_SERVICE   Optional Source-filter label (default: window.location.hostname).
   //   NEXT_PUBLIC_OPTIC_ENV       Optional env tag, local/staging/prod (default: NODE_ENV).
   //   NEXT_PUBLIC_OPTIC_ENDPOINT  Optional ingest URL override.
   import { Optic } from '@optic/browser';

   const projectKey = process.env.NEXT_PUBLIC_OPTIC_KEY;
   if (projectKey) {
     const endpoint = process.env.NEXT_PUBLIC_OPTIC_ENDPOINT;
     Optic.init({
       projectKey,
       serviceName: process.env.NEXT_PUBLIC_OPTIC_SERVICE,
       environment:
         process.env.NEXT_PUBLIC_OPTIC_ENV ??
         process.env.NODE_ENV ??
         'development',
       ...(endpoint ? { transport: { endpoint } } : {}),
     });
   }
   ```

   Keep this file lightweight — Next.js dev warns when it takes >16ms. If the project already has an `OpticProvider` from an earlier install, migrate the init here and delete the provider — one init per surface.

3. **Older Next.js (<15.3) — fall back to a client provider.** Create `OpticProvider` in the project's provider directory convention (`src/providers/`, `src/components/Providers/` — don't invent a new one), with the same env-driven init as above wrapped in `'use client'` + a run-once `useEffect` returning `null` (keep the explicit `(): null` return for strict-TS projects). Mount `<OpticProvider />` among existing client providers: App Router — `src/app/layout.tsx` or `app/layout.tsx`, inside `<body>`; Pages Router — `src/pages/_app.tsx` or `pages/_app.tsx`, above `<Component />`. Do not create a wrapping div, do not change unrelated structure.

4. **Append env stubs.** Append to `.env.local` (and any `.env.staging.local` / `.env.production.local` the project already has):

   ```
   # Optic — QA capture & error tracking (browser)
   # Get a publishable key from https://optics-qa.com/<org>/<project>/settings/api-keys
   NEXT_PUBLIC_OPTIC_KEY=
   NEXT_PUBLIC_OPTIC_SERVICE=admin
   NEXT_PUBLIC_OPTIC_ENV=local
   # NEXT_PUBLIC_OPTIC_ENDPOINT=https://staging.optics-qa.com/api/ingest
   ```

   **Idempotent**: grep for `NEXT_PUBLIC_OPTIC_KEY` first; skip if already present.

5. **Verify** by running the project's existing build/typecheck.

## Step 2B — Vite + React/Vue

1. Install the tarball with the project's package manager (same URL).
2. Create `src/optic.ts` (or wherever the project keeps app-bootstrap modules):

   ```ts
   import { Optic } from '@optic/browser';

   const projectKey = import.meta.env.VITE_OPTIC_KEY;
   if (projectKey) {
     Optic.init({
       projectKey,
       serviceName: import.meta.env.VITE_OPTIC_SERVICE,
       environment: import.meta.env.VITE_OPTIC_ENV ?? import.meta.env.MODE,
       ...(import.meta.env.VITE_OPTIC_ENDPOINT
         ? { transport: { endpoint: import.meta.env.VITE_OPTIC_ENDPOINT } }
         : {}),
     });
   }
   ```

3. Import that module **once at the top of the app entry point** (`src/main.tsx`, `src/main.ts`), right after the React/Vue imports, before `createRoot` / `createApp`.

4. Append env stubs to `.env.local`:

   ```
   VITE_OPTIC_KEY=
   VITE_OPTIC_SERVICE=web
   VITE_OPTIC_ENV=local
   # VITE_OPTIC_ENDPOINT=https://staging.optics-qa.com/api/ingest
   ```

## Step 2C — Plain HTML / static site

Use the script tag (no build step). Add to the `<head>` of every entry HTML:

```html
<script src="https://optics-qa.com/sdk/v1/optic.js"></script>
<script>
  Optic.init({
    projectKey: 'pk_live_xxxxxxxxxxxxxxxxxxxx',
    serviceName: 'marketing-site',
    environment: 'production',
  });
</script>
```

## Step 2D — Backend install (NestJS / Express / Fastify / Next.js API / generic Node)

1. **Install the tarball** in the right app:

   ```bash
   pnpm add https://optics-qa.com/sdk/v1/optic-node-latest.tgz
   # monorepo: pnpm --filter <api-app-name> add https://optics-qa.com/sdk/v1/optic-node-latest.tgz
   ```

2. **Create an init module.** Pick a path that matches the project's convention — `src/common/optic.ts`, `src/lib/optic.ts`, `src/instrumentation/optic.ts`. Don't invent a new layout.

   ```ts
   /**
    * Optic Node SDK initialization.
    *
    * Captures server-side errors (uncaughtException, unhandledRejection,
    * any caller of Optic.captureException) into the Optic dashboard.
    *
    * Env (set in .env.local / per-environment files):
    *
    *   OPTIC_SECRET_KEY    Secret key (sk_live_* / sk_test_*) from
    *                       optics-qa.com. Required — init silently
    *                       no-ops without it.
    *   OPTIC_SERVICE       Optional service-name label for the
    *                       dashboard's Source filter. Defaults to
    *                       package.json `name`.
    *   OPTIC_ENV           Optional environment tag. Defaults to NODE_ENV.
    *   OPTIC_ENDPOINT      Optional ingest URL override.
    *
    * The SDK refuses to init with a publishable key (pk_*) — it requires
    * a secret key. Never expose OPTIC_SECRET_KEY to client-side code.
    */

   import { Optic } from '@optic/node';

   let initialized = false;

   export function initOptic(): void {
     if (initialized || Optic.isInitialized()) {
       initialized = true;
       return;
     }

     const secretKey = process.env.OPTIC_SECRET_KEY;
     if (!secretKey) return;

     const endpoint = process.env.OPTIC_ENDPOINT;

     Optic.init({
       secretKey,
       serviceName: process.env.OPTIC_SERVICE,
       environment:
         process.env.OPTIC_ENV ?? process.env.NODE_ENV ?? 'development',
       debug: process.env.NODE_ENV === 'development',
       transport: {
         ...(endpoint ? { endpoint } : {}),
         // Smaller batches in dev so events appear quickly while testing.
         batchSize: process.env.NODE_ENV === 'development' ? 1 : 50,
       },
     });

     initialized = true;
   }
   ```

3. **Wire init into the entry point.** Where depends on the framework — pick the right pattern:

   ### NestJS (`main.ts`)
   ```ts
   // Import + call initOptic FIRST, before NestFactory.create.
   // This ensures process-level handlers are registered before NestJS
   // (or your own setupProcessHandlers) attaches its own.
   import { initOptic } from './common/optic';
   initOptic();

   import { NestFactory } from '@nestjs/core';
   // ... rest of bootstrap
   ```

   For per-request scope (so `Optic.captureException(err)` automatically tags with the user / route), also wire the Express adapter inside the existing Nest exception filter, OR for Fastify use `Optic.withScope` inside an `onRequest` Fastify hook.

   ### Express
   ```ts
   import express from 'express';
   import { Optic } from '@optic/node';
   import { opticRequestHandler, opticErrorHandler } from '@optic/node/express';
   import { initOptic } from './common/optic';

   initOptic();

   const app = express();
   app.use(opticRequestHandler({
     // Optional: scrub additional headers / query params
     // additionalScrubHeaders: ['x-acme-token'],
     // additionalScrubQueryParams: ['custom_secret'],
   }));

   // ... your routes ...

   app.use(opticErrorHandler());   // captures errors passed to next(err)
   ```

   ### Fastify (standalone, not via NestJS)
   ```ts
   import Fastify from 'fastify';
   import { Optic } from '@optic/node';
   import { initOptic } from './common/optic';

   initOptic();

   const app = Fastify();

   // Wrap each request in a per-request scope so captureException
   // calls deeper in the call stack auto-tag with route/user.
   app.addHook('onRequest', async (req, reply) => {
     // Fastify's lifecycle is sync hooks; use Optic.withScope inline
     // around the rest of the request via reply.then if available, or
     // add per-route try/catch with explicit Optic.captureException.
   });
   ```
   Fastify integration is currently manual — there's no `@optic/node/fastify` adapter. Document that constraint to the user.

   ### Next.js API routes / Server Components / Server Actions (`instrumentation.ts`)
   ```ts
   // instrumentation.ts (project root)
   export async function register() {
     if (process.env.NEXT_RUNTIME === 'nodejs') {
       const { initOptic } = await import('./src/lib/optic');
       initOptic();
     }
   }

   // Next.js 15+: fires on every uncaught server error (route handlers,
   // server actions, server components, middleware/proxy) — no per-handler
   // try/catch needed. Await async work inside it.
   export async function onRequestError(
     err: unknown,
     request: { path: string; method: string }
   ) {
     if (process.env.NEXT_RUNTIME === 'nodejs') {
       const { Optic } = await import('@optic/node');
       if (Optic.isInitialized()) {
         Optic.captureException(
           err instanceof Error ? err : new Error(String(err)),
           {
             tags: { source: 'on-request-error' },
             extra: { path: request.path, method: request.method },
           }
         );
       }
     }
   }
   ```
   No separate package needed — the same `@optic/node` install works. Keep explicit `Optic.captureException(err)` only inside `catch` blocks for errors the code handles (those never reach `onRequestError`).

   ### Worker / CLI / scheduled job
   Just call `initOptic()` at the top of the entry script. Skip the framework adapter sections — there are no HTTP requests to wrap. Use `Optic.withScope({ ... })` to add per-job context manually.

4. **Hook into existing exception filters / error handlers.** If the project already has a centralized error handler (NestJS `@Catch()`, Express error middleware, custom logger), add `Optic.captureException(exception, { tags, extra })` inside it for severity=error cases. Do NOT replace the existing handler.

   Example NestJS exception filter addition:
   ```ts
   if (severity === 'error' && Optic.isInitialized()) {
     Optic.captureException(exception, {
       tags: { source: 'all-exceptions-filter', context_type: 'http' },
       extra: { status, path, method, request_id },
     });
   }
   ```

5. **Append env stubs.** Append to `.env.local` (and any per-env files):

   ```
   # Optic — server-side error tracking
   # Get a SECRET key (sk_live_* / sk_test_*) from
   #   https://optics-qa.com/<org>/<project>/settings/api-keys
   # Never commit a real value or expose this key to client-side code.
   OPTIC_SECRET_KEY=
   OPTIC_SERVICE=api
   OPTIC_ENV=local
   # OPTIC_ENDPOINT=https://staging.optics-qa.com/api/ingest
   ```

   **Idempotent**: grep for `OPTIC_SECRET_KEY` first; skip if already present.

6. **Verify** by running the app's typecheck. Restart the server. On startup, the Optic init beacon registers the service in the dashboard's Services widget — visible within seconds with no errors required.

## Step 3 — The security bridge (do this on every install)

Optic already receives what the app does wrong at runtime. The bridge sends what
the *code* does wrong: a deterministic probe run, uploaded to the project's
Security tab, scored server-side, re-scored on every re-upload so the run history
is the record of the codebase getting safer.

Run it as part of the install — not as a separate favour to ask for later. A
project that has just been wired for error capture is exactly the project nobody
has security-reviewed.

**1. Run the probes.** No network, no Docker, no API bill. Under 60 seconds on a
typical app, under 3 minutes on a large monorepo.

```bash
mkdir -p _security
python3 ~/.claude/skills/pentest/probes/run.py --root . --out _security/preflight.json
```

**2. Make sure the `optic` CLI is on PATH** (`which optic`). It is a plain npm
tarball served from the same origin as the SDKs — no registry, no auth:

```bash
which optic || npm i -g https://optics-qa.com/sdk/v1/optic-cli-latest.tgz
# pin instead: npm i -g https://optics-qa.com/sdk/v1/optic-cli-{version}.tgz
# in a repo, as a dev dep:  pnpm add -D https://optics-qa.com/sdk/v1/optic-cli-latest.tgz  → npx optic …
```

If the URL 404s (staging Optic, or the tarball not yet deployed), build it from
the monorepo instead: `pnpm --filter @optic/cli publish:public` in
`optic-qa-ai`, then `npm i -g apps/web/public/sdk/v1/optic-cli-latest.tgz`.
Never skip the upload silently — if the CLI cannot be installed, say so and
leave `_security/preflight.json` on disk for a manual upload.

**3. Upload.** `--engine preflight` is the label for a probes-only file. A full
pipeline file (`_security/findings.json`, probes merged in) uploads as
`--engine native` — never label that one `preflight`.

```bash
optic upload-pentest --findings _security/preflight.json --engine preflight
# or: optic preflight
```

**4. Gitignore the reports.** They quote real payloads and, occasionally, a real
secret. Append to `.gitignore` if absent (grep first — idempotent):

```
_security/
```

**5. Wire CI.** Add a step to the existing workflow — do not create a new one if
the project already has `.github/workflows/ci.yml`:

```yaml
- name: Security preflight
  run: |
    npm i -g https://optics-qa.com/sdk/v1/optic-cli-latest.tgz
    python3 ~/.claude/skills/pentest/probes/run.py --root . --no-history --out _security/preflight.json
    optic upload-pentest --findings _security/preflight.json --engine preflight
  env:
    OPTIC_SECRET_KEY: ${{ secrets.OPTIC_SECRET_KEY }}
```

`--no-history` skips the git-log probe, which CI does not need and which is the
slow one.

**6. Read what came back, fix criticals, then offer the full review rather
than starting it.** The probes are the cheap half. For the classes a regex cannot prove
(object-level access, cross-tenant reads) the full `/pentest` run fans out to
Security Engineer agents, freezes a baseline, and holds the fix loop to a
`/reviewer` gate — that is a session of work, not an install step. End the
install by reporting the preflight grade and asking: "Run `/pentest` now?"
Only run it if the user says yes.

### What the probes will find, because they found it everywhere else

Six repos audited in August 2026. **Four exposed personal data to callers with no
account.** None of it was reported by a user; all of it was found by reading the
code. Assume this project has at least one until the run says otherwise:

| Class | The shape |
|---|---|
| Authenticated ≠ authorized | `requireUser()` then `ctx.db.get(args.id)` — signed in, but nothing proves the row is theirs. In five of six repos. |
| Storage is one namespace | A handler resolving a caller-supplied storage id returns *any* blob in the deployment — video, avatars, ID documents, exported PDFs. |
| Opt-in authorization | An optional identity arg with the check inside `if (args.userId)`. Omitting the argument is the exploit. |
| Fallback on a gate | `identity?.subject ?? args.userId`. The caller never defeats the token — they route around it. |
| Dev identity shipped | An admin returned when `NODE_ENV !== "production"`, in a container nobody checks. |
| Entitlement self-service | A public mutation writing `plan` / `subscriptionStatus`. Billing bypass from the browser console. |
| Unscoped bulk read | A gated `query("t").collect()` with no index: every tenant's rows in one call. |
| Free amplifier | Unauthenticated contact/waitlist writes with no throttle. |
| HTML into your own inbox | A contact form composing HTML mail from unescaped input. |

**Test every endpoint twice** — unauthenticated, and as a valid member of a
*different* tenant. The second test is the one that fails. When you fix one, fix
the whole shape: in four of five projects a sibling helper held a strictly wider
version of the same hole, and closing only the cited location would have left the
bigger one open.

**Report honestly.** Say what you did not fix and why. A partial fix that reads as
complete retires the ticket and leaves the hole.

## Step 4 — Tell the user what's next

After the install, end with a short summary:

- **Files added** (`instrumentation-client.ts` or provider component, init module, env additions, framework adapter wire-up, `_security/` gitignore entry, CI preflight step).
- **The security run** — findings by severity, what the probes cleared, and the criticals that need a decision now. Link the project's Security tab.
- **Where to fetch keys** — if you've seen the org/project slug in the project (existing `.env`), construct the URL: `https://optics-qa.com/<org>/<project>/settings/api-keys`. Otherwise: `https://optics-qa.com → pick org → pick project → Settings → API Keys → Create API Key → copy the plaintext (only shown once) → paste into env`.
- **Which key type for which surface**:
  - Frontend → publishable (`pk_live_*`) → `NEXT_PUBLIC_OPTIC_KEY` / `VITE_OPTIC_KEY`
  - Backend → secret (`sk_live_*`) → `OPTIC_SECRET_KEY`
- **How to test**:
  1. Set the env keys, restart the dev servers.
  2. Open the app, browse / make API calls.
  3. Open `optics-qa.com → <org>/<project>` — within ~5s you should see:
     - Services widget on the project home: live dot for each service that just initialized
     - Errors page: any captured errors with `Source` filter chips for FE / BE
     - Settings → Services: full registry of every initialized service with sdk version
- **How to split local / staging / prod**:
  - **Different keys per env** (recommended): create separate keys in the dashboard, set in `.env.{environment}.local`.
  - **Same key + env tag**: set `*_OPTIC_ENV` to `local` / `staging` / `production` per environment so the dashboard can filter.

## Hard rules

- **Never invent project structure.** Read existing providers/init modules and follow that layout. If `src/providers/` exists, use it. If the project uses `src/common/`, use that for the Node init module.
- **Never write keys into source.** Always env-driven. Frontend = publishable (`pk_live_*`); backend = secret (`sk_live_*`). Mixing them up is one of the most common mistakes — the SDKs both reject the wrong type at init.
- **Don't run `npm publish` / `pnpm publish`.** The tarball install URLs are the public install paths — no registry involvement.
- **Idempotent.** Re-running the skill on a project that already has Optic installed should:
  - Skip the install if the dep is already present at the latest tarball URL.
  - Skip the `instrumentation-client.ts` / provider / init-module create if the file already exists.
  - Skip the env-stub append if the key name already appears in the file.
  - Skip the framework adapter wire-up if `opticRequestHandler` or `initOptic()` is already imported in the entry file.
- **Don't gate the SDK behind try/catch boilerplate.** Both SDKs silently no-op when the key is missing — that's enough.
- **Don't auto-fill keys** even if you've seen one in this conversation. Keys are environment-specific; let the user paste.
- **One Optic.init per surface.** If you find an existing `Optic.init(...)` somewhere, edit it instead of duplicating. The Node SDK throws a warning on double-init and bails (it's safe but pointless); the browser SDK does the same.
- **Backend init goes before the framework boots.** In NestJS that means `initOptic()` is called before `NestFactory.create()`. In Next.js that means `instrumentation.ts` (which runs before any route). This ordering ensures Optic's `uncaughtException` / `unhandledRejection` handlers register before competing handlers from the framework or your own crash logger.
- **Don't disable `captureUnhandled` unless asked.** It's the highest-signal capture path — the bug that crashes the process. Default-on is correct.
- **Never commit `_security/`.** Reports quote real payloads and sometimes a real secret. Gitignore it as part of the install; commit the *fixes*, one commit per class closed.
- **Never claim a finding is fixed because a probe stopped firing.** The probe proves the shape changed. Whether the hole closed is a separate question, and the answer lives in a test that fails against the pre-fix code.
- **Don't accidentally expose `sk_live_*` to the browser.** If a project has both FE and BE in the same Next.js app: secret key goes in `OPTIC_SECRET_KEY` (server-only env), publishable goes in `NEXT_PUBLIC_OPTIC_KEY` (browser-readable). Never use the `NEXT_PUBLIC_*` prefix on the secret.

## Local dev — pointing the SDKs at a local Optic deployment

If the user is running the Optic dashboard itself locally (i.e., they're a contributor to the optic-qa-ai repo, not just a customer), they may want events to flow to `http://localhost:3000/api/ingest` instead of production. In that case:

```
# Frontend
NEXT_PUBLIC_OPTIC_ENDPOINT=http://localhost:3000/api/ingest
# (or VITE_OPTIC_ENDPOINT for Vite projects)

# Backend
OPTIC_ENDPOINT=http://localhost:3000/api/ingest
```

The local Optic dashboard's `/api/ingest` route already sets `Access-Control-Allow-Origin: *` so cross-origin browser calls work out of the box. Backend → backend calls have no CORS constraint.
