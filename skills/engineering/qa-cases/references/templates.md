# qa-cases output templates

Read at step 5. The default skeleton is the whole file; in `-v` mode keep its top and bottom sections and swap each ticket body for the verbose one.

## Default (high-level) feature file

Replace placeholders. Drop sections that do not apply.

```markdown
# <App>: <feature title>

**Version:** 1.0
**Date:** <YYYY-MM-DD>
**Owner:** Engineering → QA handoff
**Scope:** <one-line scope statement.>

---

## How to use this document

Each ticket covers one user journey at a high level. Test the listed pages in order, exercise the listed behaviours, and confirm the outcomes match. Treat each ticket as one journey, not every behaviour as a separate test case.

**Severities:** P0 (blocker), P1 (must fix before release), P2 (file and triage).

**Devices:** Chrome and Safari desktop at 1440×900, current-generation iPhone Safari at 393×852 and Android Chrome at 412×915.

**Accounts to provision:** <one line per account the QA will need>.

**Paths (no domain, works in any environment):**

| Surface | Path |
|---|---|
| <Page name> | `/path/name` |
| ... | ... |

---

## Ticket index

| ID | Journey | Priority |
|---|---|---|
| QA-<JOURNEY> | <one-line journey> | P0 |
| ... | ... | ... |

---

## QA-<JOURNEY>: <journey title>

**Pages:** `/entry` → `/intermediate` → `/destination`.
**Priority:** P0 / P1 / P2
**Pre-conditions:** <accounts, data, fixtures the QA needs>.

**Journey to test:**
<One short paragraph in plain English describing the user's path from entry to outcome.>

**What to verify:**
- <Behaviour or outcome grouped at a meaningful level, not per keystroke.>
- <Validation and error behaviour summarised, not enumerated.>
- <Cross-page consequences if any.>
- <Mobile divergences if any.>

**Pass criteria:** <one to three sentences of what "green" looks like.>

---

## Cross-cutting checks (run once per cycle)

- **No console errors or warnings** on any page in production build.
- **Lighthouse pass** on key routes: Performance ≥ 80, Accessibility ≥ 95, Core Web Vitals (LCP, INP, CLS) in the green band.
- **Keyboard navigation** across primary flows: tab order logical, no traps.
- **Screen reader sanity** with VoiceOver or NVDA: headings announced, buttons labelled.
- **Error monitoring** picks up an intentional thrown error.

---

## Bug filing convention

```
[QA-<TICKET-ID>] <one-line summary>

Pre-conditions: ...
Steps to reproduce: 1. ... 2. ... 3. ...
Expected: ...
Actual: ...
Device / Browser: <e.g. iPhone 14 Safari 17.4>
Environment: QA staging | Production
Account used: <role + handle>
Severity: P0 / P1 / P2
Console errors: <paste if any>
Screenshot / Loom: <link>
```

One bug per failure. Don't bundle.

---

## Out of scope

- <Anything explicitly not in scope, kept short>

---

**End of document.**
```

## Verbose (`-v`) ticket body

Keep the same top-of-doc sections (path table, accounts, ticket index, cross-cutting, bug filing, out of scope).

```markdown
## QA-<AREA>-<NN>: <area title>

**Area:** <route(s) and key files>
**Priority:** P0 / P1 / P2
**Pre-conditions:**
- <account, data, env requirement>
- <permission or feature flag required>

### Test cases

1. **<short title>**
   *Given* <state>, *when* <action>, *then* <expected outcome>.

2. **<short title>**
   *Given* ..., *when* ..., *then* ...

### Pass criteria
- <observable success conditions>

### Coverage
Default matrix. (Or override: "Desktop only: payment flow is desktop-first.")
```
