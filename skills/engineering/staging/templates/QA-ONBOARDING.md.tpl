# ${PROJECT} — QA Staging Onboarding

Welcome. Here is your QA staging environment.

## URLs

| What | URL |
|---|---|
| Marketing site | https://${STAGING_HOST} |
| App (the product) | https://${STAGING_APP_HOST} |
| API (for direct testing) | https://${STAGING_API_HOST} |
| API health | https://${STAGING_API_HOST}/health |

Use Chrome with DevTools open (Cmd+Opt+J → Console, Cmd+Opt+I → Network).

## Get an account

1. Go to https://${STAGING_APP_HOST}/signup
2. Use a real email so the auth flow works (we send via Resend; check your inbox or ask the team for Resend access if mail doesn't arrive).
3. Prefix your test org/company name with `qa-` so we can find and clean your data later.

## Test data conventions

- **Email pattern**: `qa+<feature>@kaleidotalent.com` (Gmail aliasing — all `qa+*` arrive in `qa@`).
- **Org name**: starts with `qa-` (e.g. `qa-acme-test`).
- **Don't** use real customer names, real candidate names, or real PII. Make up plausible-sounding fake data.
- Stripe is in **test mode** — use card `4242 4242 4242 4242`, any future date, any CVC.

## When something is broken

1. **Console errors**: Cmd+Opt+J → screenshot any red lines.
2. **Network failures**: Network tab → right-click failing request → "Save all as HAR with content".
3. **Reproduction steps**: write them down before you forget.
4. **File the bug** in <issue tracker URL — fill in>:
   - Title: short and specific (`signup fails when email contains plus sign`)
   - Body: steps + expected + actual + screenshots/HAR
   - Tag: `staging`, `<area>` (e.g. `auth`, `dashboard`, `jobs`)
5. **Tag @michael** for elevation needs (admin role, test data reset, environment issues).

## What's different from production

- Logs are verbose (`LOG_LEVEL=debug`).
- Stripe is test mode — no real charges.
- Email goes via Resend test domain — check sender for clarity.
- Database is wiped on schedule (TBD — confirm with team). Don't store anything you can't recreate.
- Some integrations (LinkedIn OAuth, Twilio) may be limited or test-mode.

## Useful endpoints for direct API testing

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /health/redis/diagnostics` | Redis status |
| `GET /health/status-board` | HTML dashboard, auto-refreshes |

For authenticated endpoints, sign in via the app first, then copy your session cookie from DevTools → Application → Cookies.

## Reset / lost access

- Lost password? Use `/forgot-password` on the app.
- Need admin? Ping @michael.
- Whole environment broken? Try https://${STAGING_API_HOST}/health first; if it fails, ping @michael.
