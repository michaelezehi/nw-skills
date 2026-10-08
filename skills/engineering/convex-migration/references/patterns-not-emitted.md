# Patterns NOT yet emitted by the converter

Moved verbatim from SKILL.md. Read when a wave surfaces a bug and you are deciding whether to patch the converter.

### Patterns NOT yet emitted (your next opportunity to feed upstream)

If you hit these and patch them in the user's project, also patch the converter:

1. **Auto-insert `requireCompanyMember(ctx, args.companyId)`** in stubs that take a `companyId` arg. Currently the emitter leaves these as plain `query()`/`mutation()` and relies on the porting agent to add the gate. The founder-x backend security audit caught 5 leaks because agents forgot.
2. **Warn on FE-supplied `user_id` args.** When a stub takes `user_id: v.string()` in args and the source method was called from an authenticated guard, emit a `// TODO REVIEW: derive identity from requireUserDoc(ctx).user._id — do NOT trust this arg as caller identity` comment. Single biggest security trap during the audit.
3. **Distinguish `mutation` vs `internalMutation`** at emit time. Cron-target functions and worker-only mutations should be `internalMutation`. The converter currently emits everything as public.
4. **Soft-delete-aware reads.** When a table has `removed_at` / `deleted_at` columns, every emitted query should filter them out by default.
5. **Differentiate `action()` env-missing throws.** Actions reading `process.env.STRIPE_SECRET_KEY` etc. should throw `STRIPE_NOT_CONFIGURED` (not `NOT_IMPLEMENTED`) when the env is missing. The FE can show a useful message instead of a generic "not implemented" banner.
6. **Detect the `getAuthenticatedClient` shim trap.** If the user's admin app has a shim wrapper hiding GraphQL callers, the converter could emit a scanner report listing every shim consumer that needs migration. Skipping this on founder-x cost a full extra wave.
7. **Test scaffold upgrades.** Emitted shape tests assert `rejects.toBeDefined()` against the stub throws. After porting, those assertions become wrong (functions no longer throw). The converter could emit smarter scaffold tests that branch on whether the function is a stub or real impl — or document the upgrade pattern alongside the test file.
8. **No-`users`-table identity model.** Customers like x-unframed key identity off `user_roles` (one canonical table per role) plus per-role profile tables, not a single `users` table. The emitted `_lib/auth.ts` should detect this layout (no `users` entity in the IR) and emit `requireUserRole`/`findUserRole`/`ensureUserRoleLinked` against the role table instead of failing to compile.
9. **Auto-split oversize emitted files.** Files like `candidate.ts` (2306 lines) or `referral.ts` (2288 lines) exceed the 600-line cap. The emitter could split per-controller (one source controller = one emitted file) instead of collapsing the whole module into one giant file.
