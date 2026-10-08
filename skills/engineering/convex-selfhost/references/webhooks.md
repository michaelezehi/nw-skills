# WorkOS and Stripe

## WorkOS

Login callbacks stay on the **app** origin. Convex moving does not
change them.

```
https://<app-host>/api/auth/callback
```

No WorkOS webhook httpAction exists on x-unframed. If this project has
one, it is an HTTP action and follows the site URL remap below.

The Convex deployment validates JWTs against **its** WorkOS client
(`WORKOS_ISSUER` / `WORKOS_JWKS_URI` on the backend). The droplet app
must use that same client. Prod app ↔ prod client. Staging app ↔
staging/dev client. A mismatch looks like "logged in, then hung":
Convex treats every query as logged-out.

## Stripe

List every HTTP route in `convex/http.ts` (or equivalent) that mentions
stripe. Those are the live destinations.

x-unframed lesson: an old Nest path can still be the URL in the Stripe
dashboard and 404 forever (`/api/webhooks/stripe`). The live handlers
were `/webhooks/stripe/` (Connect) and `/payment-webhooks/stripe`
(checkout). **Do not tell the user the old path works.**

After cutover:

| Kind | URL shape |
|---|---|
| ATS / default HTTP actions | `https://<existing-api-host><path>` on `:443` if you flipped the Cloud `.site` proxy |
| Extra backend (HR-style) | either extra TLS port (`:8445/stripe/webhook`) **or** a same-host prefix (`/hr/stripe/webhook`) that nginx rewrites to that container's `:3211` |

Bare POST without a valid signature should return the handler's auth
error (`BAD_SIGNATURE`), not nginx 404. That is how you prove the route
exists without firing a real event.

HR-style checkout often reads `STRIPE_WEBHOOK_SECRET` (no `_HR` suffix)
inside Convex even when the droplet `.env` uses a suffixed name. Set the
name the handler reads.

Do not upgrade the Stripe account Default API version during cutover.
SDKs pin different versions. A destination can use Latest on its own.

Connected-account destinations stay Connected. Platform-account
destinations stay on Your account. Copy the event list from the existing
destination. Do not invent events.

## User action list

The report ends with the destinations **the user must click** in Stripe
(and any other vendor). Agents cannot finish those.
