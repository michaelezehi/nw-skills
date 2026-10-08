# The resilience harness moved into version control

`run.sh`, `scope-guard.sh`, `profiles/{flood,large-body,edos,dist-probe}.js`,
`slowloris.py`, `analyze.py`, `score-report.py` and `summary.py` now live at

    <optic-qa-ai>/packages/security-harness/resilience/

They left this directory on 2026-08-17, together with the pentest probes and the
load-test harness, so that CI and a droplet can run the same code an operator
runs, and so a scan that should have happened and did not leaves a record.

Every safety property is unchanged and still enforced in the tracked copy:
scope-guard before any traffic, paid and third-party hosts hard-blocked even with
`--authorized`, slow-loris and dist-probe localhost-only, EDoS asserting
rejection rather than measuring spend, and the Ctrl-C teardown.

One honest note for whoever reads the diff: `run.sh` was **rewritten** during the
move rather than copied, from the contract that `analyze.py` and the k6 profiles
declare (env names, `<profile>-result.json` filenames, argument order). It is
behaviour-equivalent, not byte-identical. `scope-guard.sh` is verbatim.

What is left here: `SKILL.md`, `harness-dir.sh`, and thin wrappers for `run.sh`
and `scope-guard.sh`.
