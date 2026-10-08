---
name: ddos
description: Authorized, self-owned application-layer (L7) DDoS-RESILIENCE testing of our OWN infrastructure — the third leg after /pentest and /loadtest. Throws hostile traffic shapes (HTTP flood + cache-buster, slow-loris, oversized-body, EDoS cost-flood, distributed XFF fan-out) at a self-owned target and asks one question: did our controls SHED the abuse (429/503) while a legitimate user kept getting served a fast 2xx? Scores on the shared weighted engine and writes _resilience/ddos.json + an HTML scorecard. Defensive only — scope-guard refuses production, third-party, and paid hosts; live-fire is localhost. Use when the user says /ddos, "resilience test", "can we survive a DDoS", "test our rate limits / slow-loris / cost-flood defence".
---
# /ddos — DDoS resilience harness

## Where the code lives

The harness is **tracked in git** at
`<optic-qa-ai>/packages/security-harness/resilience/`, not in this skill
directory. `harness-dir.sh` resolves it and `OPTIC_HARNESS_DIR` overrides the
default checkout path. `run.sh` and `scope-guard.sh` here are wrappers that hand
every argument through, so every command below is unchanged and every safety
property still fires before any traffic. See `MOVED.md`.

## The one question this answers

Not "how many users can we serve" (that is `/loadtest`). This asks the **hostile**
question: when abusive traffic arrives, do our controls **shed** it (429/503)
while a legitimate user on another path still gets a fast 2xx — or does the app
**fold** (5xx, timeouts, OOM, everyone locked out)?

The pass condition is **inverted** from the load test. There, a proxy refusal
(429/503) is "not a failure." Here:

- attacker **refused** (429/503) → **GOOD**, a control fired
- attacker **reached origin unshed** → the control is inert (finding)
- legit **2xx within budget** → **GOOD**, graceful degradation
- legit **5xx / timeout / slow** → the app folded (the real failure)

The number it produces is **graceful degradation**, scored on the same weighted
engine as Pentest and Load (SEV critical 40 / high 30 / medium 12 / low 4,
passed check 6, A+≥95 A≥90 B≥75 C≥60 D≥40 F).

## Golden rules

1. **scope-guard runs before any traffic.** Local (`localhost`/`127.0.0.1`/
   `*.local`) is free. A remote host needs `--authorized` **and** a signed
   `_resilience/SCOPE.md` naming it. Paid/third-party hosts (`*.convex.cloud`,
   `openrouter.ai`, `*.stripe.com`, `elevenlabs.io`, `*.amazonaws.com`,
   `*.vercel.app`, …) are **hard-blocked even with `--authorized`.**
2. **Live-fire is localhost.** Do not point a profile at staging/production for
   real. The remote path exists only for a host you own with a signed scope.
3. **EDoS is reject-not-spend.** It sends an INVALID/absent token and asserts
   the request is rejected (401/403/429) **before** any paid call. Never run it
   against an instance wired to live provider keys; it never measures spend.
4. **No spoofing, no volumetric.** No source-IP spoofing, no L3/L4
   (SYN/UDP/reflection/amplification). The distributed case is XFF fan-out on
   localhost only. Volumetric is edge-absorbed (a rule of record, not a test).
5. **A CDN/WAF in front invalidates results.** `run.sh` detects it and refuses
   to report numbers unless `--allow-cdn` — otherwise you measure their
   protection, not yours. Point at the origin.
6. **Everything is bounded** — capped intensity, max duration, Ctrl-C kill
   switch that tears down connections. First run against a new target should be
   a `--sanity` pass.

## How to run

```bash
# bounded low-intensity sanity pass first
run.sh -t http://localhost:3000 --sanity

# full pass 1 (baseline, un-hardened)
run.sh -t http://localhost:3000 --pass 1

# a subset only
run.sh -t http://localhost:3000 --only flood,edos

# after hardening the gateway, prove the flip
run.sh -t http://localhost:3000 --pass 2
```

Output: `_resilience/ddos.json` (upload shape) + `_resilience/ddos-report.html`
(self-contained scorecard) + a terminal panel. Upload with:

```bash
optic upload-ddos --findings _resilience/ddos.json   # DRY-RUN unless configured
```

## Profiles

| Profile | Engine | What | Pass |
|---|---|---|---|
| `flood` | k6 | HTTP flood + cache-buster on a hot path, concurrent legit probe | attacker shed **and** legit 2xx within budget |
| `large-body` | k6 | near-cap POST to a non-upload route | 413, cheaply |
| `edos` | k6 | unauthenticated flood of billable routes | rejected before any paid call |
| `slowloris` | python | many slow-header connections (localhost-guarded) | dropped by timeout / capped by `limit_conn` |
| `dist-probe` | k6 | XFF fan-out vs. single client (localhost) | fan-out does not bypass shedding |

## Severity rubric (matches `lib/ddosScore.ts`)

- **critical** — app fell over for everyone (legit 5xx/timeouts), OOM, or a
  control entirely inert when its attack lands.
- **high** — legit badly degraded (p95 > 3× budget), or a billable route
  reachable unauthenticated (EDoS).
- **medium** — no slow-loris timeout, no body cap, per-IP-only limiting with no
  distributed tier, retry-amplification.
- **low** — verbose errors under load, missing `Retry-After`, missing cache
  headers on a floodable route.

## Files

- `scope-guard.sh` — refuse out-of-scope targets before any traffic.
- `run.sh` — orchestrate profiles, preflight, kill switch, write outputs.
- `profiles/{flood,large-body,edos,dist-probe}.js` — k6 profiles.
- `slowloris.py` — slow-header client, localhost-guarded, bounded.
- `analyze.py` — per-profile results → findings + checks + metrics → ddos.json.
- `score-report.py` — self-contained HTML scorecard (grade badge + donut).
- `summary.py` — terminal panel.

Backend + hardening for this repo: see `architecture/DDOS_RESILIENCE_PRD.md`.
