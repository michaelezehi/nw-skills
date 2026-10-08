# Storage host rewrite

Cloud file URLs baked into documents look like:

```
https://<deployment>.eu-west-1.convex.cloud/api/storage/<internalId-uuid>
```

`<internalId-uuid>` is `_storage.internalId`. It is **not** the Convex
`_id` (`kg2…`). Import copies the blob under the same internal id. A
rewrite that swaps the UUID for `_id` 404s.

## What to rewrite

Every string field (and nested object/array) that contains the Cloud
storage origin. Replace that origin with the self-host **client** origin
(the host that serves `/api/storage/…`, usually port 3210 / extra TLS
port).

x-unframed reference (copy into the project, change the two defaults):

- `apps/hr/convex-out/convex/_lib/rewriteCloudStorageHost.ts`
- `apps/hr/convex-out/convex/scripts/rewriteCloudStorageUrls.ts`

Dry-run first. Apply with an explicit confirm arg.

## Zip-first (preferred on prod)

Before `convex import`, rewrite the zip's document JSON so the live
mutation is unnecessary. Count replacements. Prod HR needed 2,858 host
rewrites. Staging that imported first then rewrote live also works, and
is slower.

## Proof

```bash
curl -fsSI "https://<self-host-client>/api/storage/<a-real-internalId>"
# 200, a real Content-Type (image/webp, application/pdf, …)
```

A 404 means the path used `_id` or the blob was not in the export.
