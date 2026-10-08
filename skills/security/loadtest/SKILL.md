---
name: loadtest
description: Authorized load and stress testing of our OWN apps with k6. Runs a stepped ramp (50 → 100 → 250 → 500 → 1000 → 3000 concurrent users), finds the capacity knee — the highest level where p95 stayed under threshold — and writes a scored findings file that uploads to Optic's Load tab. Use when the user says /loadtest, "stress test this", "how many users can we handle", "will this survive launch", "k6". Defensive and self-owned only; scope-guard refuses remote hosts without a signed scope file naming them.
---
# /loadtest — how many users does this app hold?

The performance twin of `/pentest`, and deliberately the same shape: a run is a
set of severity-weighted findings plus passed checks, the server computes the
score, and re-running after fixes raises it. Same weights, same grade bands, so
"82, grade B" means the same thing on both tabs.

The one number this exists to produce is **capacity**: the highest concurrency
where the 95th percentile stayed under the threshold. Not requests per second —
nobody can act on that.

## Where the code lives

The harness is **tracked in git** at
`<optic-qa-ai>/packages/security-harness/loadtest/`, not in this skill directory.
`harness-dir.sh` resolves it and `OPTIC_HARNESS_DIR` overrides the default
checkout path. The commands below still work: `run.sh`, `session-capture.sh` and
`loadtest` in this directory are wrappers that hand every argument through. See
`MOVED.md`.

## Golden rules

1. **Scope-guard is non-negotiable, and stricter than the pentest's.** A
   pentest reads code. This sends thousands of requests per second at a
   hostname, which pointed at a host you do not own is a denial-of-service
   attack whatever the intent. Local targets are free; a remote host needs
   `--authorized` **and** a `_perf/SCOPE.md` containing "I authorize" that
   **names that host**. A scope file for staging does not authorize production.
2. **Never report the peak as the capacity.** A run that reached 3,000 VUs with
   a p95 of eight seconds has a capacity of whatever it was before it broke.
   `analyze.py` walks up and stops at the first break for exactly this reason.
3. **Start small and climb.** First run against a new target: `--levels 10,25,50
   --duration 15s`. Confirm the numbers look sane before asking for thousands.
4. **Prefer staging.** Against production you are competing with real users for
   the same capacity, and on serverless hosting every request is billable.
5. **A CDN or WAF invalidates the result.** Cloudflare, Fastly and AWS Shield
   rate-limit load tests. If one is in front of the target you are measuring
   their protection, not the app — say so rather than reporting the numbers.
6. **Never widen a threshold to clear a finding.** That is a decision to accept
   the risk, so mark it `accepted` and write why. Silently moving the line
   destroys the only thing the score is good for.

## How to run

```bash
# Local, quick sanity pass
~/.claude/skills/loadtest/run.sh -t http://localhost:3000 --levels 10,25,50 --duration 15s

# Local, full ramp across real routes
~/.claude/skills/loadtest/run.sh -t http://localhost:3000 \
  --levels 50,100,250,500,1000 --duration 30s \
  --paths /,/pricing,/api/health

# Remote — needs _perf/SCOPE.md naming the host
~/.claude/skills/loadtest/run.sh -t https://staging.example.com --authorized \
  --levels 50,100,250,500,1000,2000,3000 --duration 30s --threshold 800
```

Flags: `--levels` (comma-separated VU counts), `--duration` (per level),
`--paths` (rotated per iteration), `--threshold` (p95 ms, default 1000),
`--sleep` (VU think time, default 1s), `--out` (default `_perf/loadtest.json`).

## Testing as a signed-in user

An anonymous ramp only ever measures public routes, which for most apps is the
cheapest thing they serve. The interesting question is the dashboard.

The session cookie is **httpOnly** — that is the point of it, so an XSS payload
cannot read it — which means `document.cookie` in the console shows nothing.
It has to come off a real request:

1. Sign in, open DevTools → Network, reload, click the top document row.
2. Right-click → Copy → **Copy as cURL**.
3. `bash session-capture.sh` (reads the clipboard on macOS, or pipe it in).

That writes `_perf/session.txt` at mode 600 and verifies the cookie against the
host it came from. Then point `--paths` at a route that actually needs auth.

`run.sh` picks the file up automatically and preflights it, asking two things
before a single VU starts: does the session work, and is the route even
protected? Both matter. An expired cookie means every request redirects to the
login page — which is cheap and static, so the ramp reports wonderful numbers
for a page nobody wanted to test. A public route means the cookie is doing
nothing and "signed-in load test" is a fiction. `ramp.js` also aborts if the
session dies mid-ramp, because otherwise the results get *better* as they get
worse.

Treat `_perf/session.txt` as the credential it is: anyone holding it is signed
in as you until it expires. It is gitignored, mode 600, and never printed.

## What it does

Each level is a **separate steady-state k6 run**, not one long ramp. That way
k6 computes each level's percentiles over that level's own requests, which is
what "capacity at N users" actually means. `analyze.py` then:

- finds the knee (first level where p95 breaks threshold or errors exceed 1%)
- writes one finding per broken level, with severity from the shared rubric
- writes one passed check per level that held
- records the peak level's percentiles as the run metrics

## Severity rubric

Shared with `packages/convex/convex/lib/loadTestScore.ts`. Change it in one
place and the dashboard grades differently from the report that produced it.

| Severity | Meaning |
|---|---|
| `critical` | It stopped serving — 5xx, connection refused, timeouts above a 1% error floor. |
| `high` | Up but unusable: p95 past 3× threshold, or breaking below half the target range. |
| `medium` | A real regression short of unusable: p95 past the threshold. |
| `low` | Worth knowing, not worth blocking a release. |

`accepted` is for slowness the team has consciously decided to live with. It is
excluded from **both** sides of the score, so a deliberate trade-off never drags
the number down forever.

## Upload

```bash
optic upload-loadtest --findings _perf/loadtest.json
```

Needs `OPTIC_SECRET_KEY` (Developer → API Keys, scope `ingest:loadtest` or
`write`). The command prints exactly what it will send first — findings name
the endpoints that fall over and the load that breaks them.

The score is computed server-side from the findings; it cannot be set from the
payload. Metrics are taken as reported, because the run happened on your
machine — we can verify arithmetic, not someone else's stopwatch.

## Reading the output

- **p50 low, p95 high** — most requests were fine and a subset queued. Look for
  contention (locks, pools, a single hot row), not slow code.
- **p50 and p95 both climb together** — the whole app is saturated. CPU, or a
  dependency that is itself at capacity.
- **Errors before latency** — something refused rather than queued. Pool size,
  worker count, or the host's own concurrency cap.
- **capacity_vus: null** — it held the entire ramp. That is a pass. Raise the
  levels if you want to find the actual ceiling.

## Interpreting a run honestly

A load test measures the path between the generator and the app, not the app
alone. Before reporting a number, say what else was in that path: your uplink,
the CDN, the region you ran from, and whether the target was warm. A capacity
figure without those caveats is a claim the run cannot support.

## A note on the browser

There is no browser-based version of this and there cannot be. Chrome allows
six TCP connections per origin (or one multiplexed HTTP/2 connection), so a
"3,000 user" browser test would be 3,000 streams sharing one congestion window.
Web Workers do not help — they share the same connection pool. If someone asks
for load testing in the browser, explain the connection limit rather than
building something that produces a confident wrong number.
