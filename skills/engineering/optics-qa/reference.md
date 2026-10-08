# Optic SDK config reference

Moved verbatim from SKILL.md. Every prop both SDKs support, public methods, the Express adapter options, and the "when to enable the optional knobs" table.

## Config reference — every prop both SDKs support

Use this when the user asks "what else can I configure?" or when their use case needs something beyond the default init. **Prefer the minimal init in Step 2 unless the user has a specific reason to enable more** — defaults are tuned for the common case.

### `@optic/browser` — `Optic.init({ ... })`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `projectKey` | `string` | — | **Required.** Publishable key (`pk_live_*` / `pk_test_*`). |
| `serviceName` | `string` | `window.location.hostname` | Labels this client in the dashboard's Source filter. |
| `environment` | `string` | — | `'production'` / `'staging'` / etc. Surfaces on captured events. |
| `release` | `string` | — | App version for release tracking. |
| `captureErrors` | `boolean` | `true` | Auto-capture `window.onerror` + `unhandledrejection`. |
| `captureConsole` | `boolean` | `false` | Capture `console.error` calls as events. |
| `ignoreErrors` | `Array<string \| RegExp>` | `[]` | Drop events whose message matches any pattern. |
| `sessionRecording.enabled` | `boolean` | `false` | rrweb DOM recording for session replay. |
| `sessionRecording.sampleRate` | `number` (0-100) | `100` | Percent of sessions to record. |
| `sessionRecording.recordOnError` | `boolean` | `true` | Force-record on whenever an error fires. |
| `sessionRecording.privacy.maskAllInputs` | `boolean` | `true` | Mask all `<input>` values (passwords always masked regardless). |
| `sessionRecording.privacy.blockSelector` | `string` | `'.optic-block'` | CSS selector for elements to block from recording. |
| `sessionRecording.privacy.maskSelector` | `string` | `'.optic-mask'` | CSS selector for elements to mask text content. |
| `network.captureFetch` | `boolean` | `true` | Capture `fetch()` calls as breadcrumbs. |
| `network.captureXHR` | `boolean` | `true` | Capture `XMLHttpRequest` as breadcrumbs. |
| `network.captureBody` | `boolean` | `false` | Include request/response bodies (privacy risk — opt in). |
| `network.ignoreUrls` | `Array<string \| RegExp>` | `[]` | Skip these URLs from network capture. |
| `privacy.maskAllInputs` | `boolean` | `true` | Top-level fallback for `sessionRecording.privacy.maskAllInputs`. |
| `privacy.blockSelector` | `string` | `'.optic-block'` | Top-level fallback. |
| `privacy.maskSelector` | `string` | `'.optic-mask'` | Top-level fallback. |
| `beforeSend` | `(event) => event \| null` | — | Mutate or drop events before send. Return `null` to drop. |
| `transport.endpoint` | `string` | `'https://optics-qa.com/api/ingest'` | Override ingest URL. |
| `transport.batchSize` | `number` | `100` | Max events per HTTP batch. |
| `transport.flushInterval` | `number` (ms) | `5000` | How often to flush the queued events. |
| `transport.maxRetries` | `number` | `3` | Retries on transient failures. |
| `transport.projectId` | `string` | — | **Dev-mode only**: bypass key validation by passing project ID directly. Don't use in production. |
| `debug` | `boolean` | `false` | Verbose console logging. |

**Public methods after init:**
`Optic.captureError(error, context?)`, `Optic.identify(userId, traits?)`, `Optic.setUserTraits(traits)`, `Optic.reset()`, `Optic.addBreadcrumb(message, category, data?)`, `Optic.startRecording()` / `stopRecording()` / `pauseRecording()` / `resumeRecording()` / `isRecording()`, `Optic.flush()`, `Optic.getSessionId()`, `Optic.getUser()`, `Optic.isIdentified()`, `Optic.isInitialized()`, `Optic.openBugReport(options?)`.

### `@optic/node` — `Optic.init({ ... })`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `secretKey` | `string` | — | **Required.** Secret key (`sk_live_*` / `sk_test_*`). Init throws on `pk_*`. Never expose client-side. |
| `serviceName` | `string` | `package.json` `name` | Labels this service in the dashboard's Source filter. |
| `environment` | `string` | — | `'production'` / `'staging'` / etc. |
| `release` | `string` | — | App version for release tracking. |
| `captureUnhandled` | `boolean` | `true` | Auto-capture `uncaughtException` + `unhandledRejection`. After capture, flushes then `process.exit(1)` (Sentry-standard). |
| `captureConsole` | `boolean` | `false` | Capture `console.error` calls as events. |
| `ignoreErrors` | `Array<string \| RegExp>` | `[]` | Drop events whose message matches any pattern. |
| `beforeSend` | `(event) => event \| null` | — | Mutate or drop events before send. |
| `debug` | `boolean` | `false` | Verbose console logging. |
| `transport.endpoint` | `string` | `'https://optics-qa.com/api/ingest'` | Override ingest URL. |
| `transport.batchSize` | `number` | `50` | Max events per HTTP batch. |
| `transport.flushInterval` | `number` (ms) | `5000` | Periodic flush cadence. |
| `transport.maxRetries` | `number` | `3` | Retries on transient (5xx, network) failures. |
| `transport.maxQueueSize` | `number` | `1000` | Drop oldest beyond this when transport is backed up. |
| `transport.shutdownTimeout` | `number` (ms) | `2000` | How long to wait for in-flight flush on `beforeExit`. |

**Public methods after init:**
`Optic.captureException(error, scope?)`, `Optic.captureMessage(message, options?)`, `Optic.setUser(user)` / `setTag(k, v)` / `setExtra(k, v)` / `setContext(k, data)` (all scoped to current AsyncLocalStorage scope), `Optic.addBreadcrumb(message, category, data?)`, `Optic.withScope(fn, initial?)`, `Optic.getCurrentScope()`, `Optic.flush(timeoutMs?)`, `Optic.close(timeoutMs?)`, `Optic.isInitialized()`, `Optic.getQueuedEventCount()`.

**Express adapter (`@optic/node/express`):**
- `opticRequestHandler(options?)` — `options.requestIdHeader` (default `'x-request-id'`), `options.additionalScrubHeaders: string[]`, `options.additionalScrubQueryParams: string[]`. Wraps each request in a fresh AsyncLocalStorage scope; auto-scrubs `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, `X-Optic-Key`, `Proxy-Authorization` headers and `token` / `access_token` / `refresh_token` / `id_token` / `auth` / `api_key` / `password` / `secret` / `credential` / `session` / `reset_token` query params.
- `opticErrorHandler()` — Express error middleware. Mount AFTER routes, BEFORE existing error handlers. Captures `next(err)` then forwards to the next handler unchanged.

### When to enable the optional knobs

| User says… | Add this to init |
|---|---|
| "I want to record sessions for replay" | `sessionRecording: { enabled: true, sampleRate: 100, recordOnError: true }` |
| "I want to record only sessions that errored" | `sessionRecording: { enabled: true, sampleRate: 0, recordOnError: true }` |
| "Sample 10% of sessions" | `sessionRecording: { enabled: true, sampleRate: 10 }` |
| "I have a noisy ResizeObserver warning" | `ignoreErrors: [/ResizeObserver loop/]` |
| "Scrub PII from event payloads" | `beforeSend: (event) => { event.message = event.message.replace(/email-regex/, '[email]'); return event; }` |
| "Don't capture network bodies for privacy" | Already the default (`network.captureBody: false`). |
| "Capture console.error too" | `captureConsole: true` |
| "Have a custom auth header to scrub on the API" | `opticRequestHandler({ additionalScrubHeaders: ['x-acme-token'] })` |
| "I want to handle uncaught exceptions myself" | `captureUnhandled: false` (Node) — but document that this loses the highest-signal capture path. |
| "Pin to a specific SDK version" | Use `optic-{browser,node}-{version}.tgz` instead of `-latest.tgz` in install URL. |
| "Send events to my staging Optic, not prod" | Set `*_OPTIC_ENDPOINT` env var (browser) or `OPTIC_ENDPOINT` (node). |
| "Larger batches in prod" | `transport: { batchSize: 200, flushInterval: 10000 }` |
| "I'm in dev — I want events immediately" | `transport: { batchSize: 1 }` |

