# Localhost → `npx convex dev`

Today most `__new-world__` apps set `.env.local` to the Cloud `dev:` or
staging deployment. That deployment is what we pause. Local must leave
Cloud **before** that pause.

`talent-spotter` already uses `CONVEX_DEPLOYMENT=anonymous:anonymous-convex`.
That is the target shape.

## What to run

From the directory that holds `convex.json`:

```bash
npx convex dev
```

That process writes a local backend URL into `.env.local` (or prints one).
The Next (or Expo) app's `NEXT_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_URL`
must be that local URL, not `*.convex.cloud`.

Keep `npx convex dev` running while `pnpm dev` runs.

## Files to edit

In **every** app package that reads a Convex URL:

| File | Change |
|---|---|
| `.env.local` | Remove `CONVEX_DEPLOYMENT=dev:<cloud-name>` and any `https://<name>.*.convex.cloud`. Leave the values `npx convex dev` writes, or set `NEXT_PUBLIC_CONVEX_URL` to the printed local URL |
| `.env.example` | Document local `npx convex dev`. Do not document a Cloud staging URL as the local default |
| README / CLAUDE.md | One line: local backend is `npx convex dev`, not staging Cloud |

Do not commit secrets from `.env.local`. Commit the example.

## Seed / data

Local is empty after the first `convex dev`. Options, pick one and say
which:

1. **Empty + seed.** Run the project's seed mutation. Fastest.
2. **Export a thin slice.** Cloud export is large. Prefer a seed. If you
   import, isolate the CLI (skill § Isolate) and never `--replace-all`
   against Cloud.
3. **Docker local stack.** Only if the project already has
   `docker/convex-gcc` style local compose. Still not Cloud.

Do not point laptop `pnpm dev` at the droplet self-host. That is staging
or prod.

## Auth

WorkOS (or Clerk) on localhost stays `http://localhost:<port>/api/auth/callback`.
The Convex deployment changes. The login origin does not.

The local backend must have the same WorkOS issuer / JWKS the local app
uses, or every query looks logged-out. Copy those **names** from the
Cloud `dev:` env onto the local backend with `npx convex env set` against
the local process. Isolate so you do not set them on Cloud.

## Mobile

`EXPO_PUBLIC_CONVEX_URL` is inlined at bundle time. `expo start` can use
the local URL. A release APK/IPA still needs a rebuild after prod
cutover. Call that out. Do not silently leave prod Cloud in `eas.json`.

## Done

```bash
rg "convex.cloud" --glob ".env.local" --glob ".env" .
# 0 hits in local env files
```

`pnpm dev` plus `npx convex dev` loads the app. One login on localhost.
