# The load-test harness moved into version control

`run.sh`, `ramp.js`, `analyze.py`, `baseline.py`, `report.py`, `summary.py`,
`ui.sh`, `scope-guard.sh`, `session-capture.sh`, the `loadtest` bootstrapper and
`tests/` now live at

    <optic-qa-ai>/packages/security-harness/loadtest/

They left this directory on 2026-08-17, together with the pentest probes and the
resilience drills. A harness that exists only in one operator's home directory
cannot be run by CI and cannot show an auditor that it ran on a cadence, which is
the whole point of the SOC 2 gap-coverage work.

This repo also had a second, byte-identical copy at `scripts/loadtest/`. That was
the same problem in a different place; it is the copy that moved, so the tracked
path changed and the count of copies went from three to one.

What is left here: `SKILL.md`, `harness-dir.sh` (path resolution, honours
`OPTIC_HARNESS_DIR`), and thin wrappers for `run.sh`, `session-capture.sh` and
`loadtest`. Nothing here holds logic any more.
