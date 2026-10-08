# Pause Cloud (never delete)

Docs: `POST /api/v1/pause_deployment` on the Cloud `.convex.cloud` host.
Auth: `Authorization: Convex <accessToken|deployKey>`. Empty 200 is
normal. `/pause_deployment` without `/api/v1` is 404.

## When

After that env's self-host is serving the rebuilt apps and the user has
signed off the check you agreed (login is enough if they say so).

Pause the Cloud names **that env used**. Do not pause prod while only
staging is live on self-host.

## Prove it

`/version` on Cloud still 200. Admin APIs (`list_environment_variables`)
still 200. Those do not mean "running".

Query the system UDF with the **deploy key** (admin). Print only
`state`:

```
POST https://<name>.eu-west-1.convex.cloud/api/query
Authorization: Convex <deploy-key>
{"path":"_system/frontend/deploymentState:deploymentState","args":{},"format":"json"}
```

Done: `value.state === "paused"`.

Unauthenticated user queries on **prod** often return a bare
`Server Error` when paused. Dev Cloud adds
`Cannot run functions while this deployment is paused.` Do not treat a
bare `Server Error` as proof. The system UDF is proof.

A user-function query **with** the deploy key should include the paused
sentence once the state is `paused`.

## Resume (rollback)

Dashboard Settings → Resume, or `POST /api/v1/unpause_deployment` with
the same auth. Then rebuild the apps with the old `*.convex.cloud`
URLs and point `:443` site proxy back at Cloud `.site`.

Keep the Cloud export zip. Pause is reversible. Delete is not this
skill.
