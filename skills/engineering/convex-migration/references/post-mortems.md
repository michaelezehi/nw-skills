# Post-mortems — what landed upstream from live migration runs

Moved verbatim from SKILL.md ("Feeding learnings back upstream"). Read when a porting wave reports converter bugs, to check whether the fix already exists.

### What landed upstream from the founder-x run

The first end-to-end customer (founder-x, 35 modules + web + admin) surfaced patterns that are now emitted by default. If you're reading this while running a migration, check the converter's git log around these areas — your scaffolding may already include them:

| Patch | Where | Why |
|---|---|---|
| `ensureUserDoc(ctx)` helper | `src/map/auth-config.ts` → `emitAuthHelpersFor` | Every WorkOS-backed Convex app needs idempotent provisioning — hand-patching this in `_lib/auth.ts` was step zero of every port. |
| `tryUser`, `findUserDoc`, `fullName` | same file | Used across every module. |
| Extended `ResolvedIdentity` (firstName/lastName/pictureUrl) | same file | NestJS guards read these; the original emitter dropped them. |
| `_lib/membership.ts` emitter | `src/map/auth-config.ts` → `emitMembershipHelpers`, wired in `src/lib/convert.ts` | Without these gates, every per-tenant query was a potential cross-tenant leak. The founder-x security audit caught 4 🔴 cross-tenant bypasses that this emitter prevents. |
| Auto `by_<fk>` indexes on every FK column | `src/parse/entities.ts` → `parseTable` | Founder-x added ~60 of these by hand in a single batch commit. Now emitted by default. Saves a full Phase 5 round trip. |
| `fe-lib/convex-mutation.ts` (`useMutationCompat` + `useActionCompat`) | `src/map/auth-config.ts` → `emitFeMutationCompat` | The single most valuable FE adapter. Without it, the GraphQL → Convex cutover would touch every form/mutation call site (100+ files on founder-x). Localises the swap to the hook layer. |
| `fe-lib/convex-server.ts` (server-side ConvexHttpClient) | `src/map/auth-config.ts` → `emitFeServerHelper` | For Next.js server actions + API routes. Includes a TODO for wiring the WorkOS access token via `setAuth()`. |
| Value-coercion fixes (decimal strings, NUMERIC column patterns, both `T`/space ISO separators, non-printable JSON key sanitisation) | `src/map/migrate.ts` → `normaliseValue` | Each was a multi-hour bug during the founder-x data migration. |

### What landed upstream from the x-unframed run

Second end-to-end customer (x-unframed, 65 modules, REST not GraphQL, no `users` table, 1023 stubs). Patched mid-run while the next wave was dispatching:

| Patch | Where | Why |
|---|---|---|
| Reserved-word identifier rename (`delete` → `remove`, `export` → `exportData`) | `src/map/functions.ts` function name normaliser | Emit was producing `export const delete = …` which fails TS parse — blocked porting of `feature_flags`, `job`, `referral`, `video_jd` until hand-patched. |
| REST-array path comment block | `src/emit/` function comment emitter | `@Get(['path1','path2'])` leaked unquoted TS code into the comment block in `job.ts:847` — file failed to parse. |
| Failed table-name resolution fallback | `src/emit/schema/` or `src/parse/entities.ts` | Emit produced `__name___chat_message_reads___` / `__name___chat_participants___` when entity name resolution failed. Fallback: snake_case the entity class name. |
| Typed DTO arg validators | `src/transpile/` body/arg validator emitter | When a route body is a typed class (`UpdateFeatureFlagDto`), emit `v.object({...})` from the class properties, NOT `v.number()` or `v.string()`. Fall back to `v.any()` if class walk fails. |
| Duplicate-export collision in flat module files | `src/map/functions.ts` collation step | Multiple controllers in one NestJS module folder declaring the same name (e.g. two `findAll` in `referral/controllers/*.ts`) produced TS duplicate-declaration errors. Disambiguate with controller-scope prefix. |

