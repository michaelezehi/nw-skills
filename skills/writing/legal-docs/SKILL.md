---
name: legal-docs
description: Audit any project for the legal, policy and compliance documents it needs — terms, privacy policy, DPA, sub-processor list, cookie consent, candidate/employee notices, retention, DSAR paths, automated-decision disclosures — then report exactly which exist, which are published but broken, and which are missing, with file paths. Fans out parallel per-surface agents, scores against a canonical document set adapted to the product's jurisdictions, and writes a committed findings file plus a gap report. On request it also PRODUCES the missing set as counsel-review drafts, builds them to branded PDFs, and publishes a /legal hub using the project's own existing layout — gated so nothing unreviewed is ever served. Use for "/legal-docs", "do we have our terms and privacy policy", "legal document audit", "compliance document gap analysis", "what legal docs are we missing", "create our legal documents", "check our DPA and sub-processor list", or before a customer security review.
---

# /legal-docs — legal & compliance document coverage audit

## Writing

Every string this skill emits for a human (drafts, reports, hub copy, emails)
must pass `agent-skills/unslop/SKILL.md`. Em dashes are prohibited. Use a
period or a comma.

Answers one question precisely: **which legal documents does this project need, which does
it actually have, and where is each one broken?**

Four hard rules.

1. **Never invent a finding.** Every "we have this" needs a `path:line`. Every "missing"
   names the grep terms that returned nothing. A false positive here is worse than a gap —
   it tells someone they are covered when they are not.
2. **Drafting is in scope. Certifying is not.** You may produce a full document set, and
   Step 7 says how. Every document you write carries a "Draft for legal review" banner on
   its face and is gated out of the public site until a human removes that banner. You never
   advise that a document is sufficient, never assert a certification, and never publish.
   Removing the banner is counsel's act, not a code change.
3. **A document may omit; it may never assert what is untrue.** Every factual claim traces
   to `FACTS.md`, which is derived from the codebase. Where the code cannot back a promise,
   the document states the limit or drops the promise. This is the rule that does the work —
   see the failures in `references/production.md`, all of which were violations of it.
4. **Public copy never names the stack. The documents do.** Say what we protect, never how
   we built it — see "The two audiences" below. A vendor list on a public page is a free
   architecture diagram.

---

## The two audiences — this decides what goes where

Every project has two surfaces and they take different text. Getting this wrong is how a
privacy page turns into a build guide.

| Surface | Processors are… | Why |
|---|---|---|
| **Public** — privacy policy, terms, cookie policy, marketing, FAQ, pricing, trust pages | **Categories only.** "Hosting and storage", "identity", "a regulated payment provider", "a specialist speech provider" | Art. 13(1)(e) requires "recipients **or categories of recipients**". Categories discharge the duty. A public map of which company does which job does not help a data subject and does help a competitor |
| **The documents** — `docs/legal/**`, delivered as PDFs under contract or on request | **Named, in full** — role, location, transfer mechanism | Art. 28(2): the controller must know its sub-processors and be able to object. The sub-processor annex exists for exactly this |
| **Internal** — `FACTS.md`, PRDs, deploy notes | Named | Never served, never bundled |

**The line that makes it lawful.** Removing names is only compliant because the names stay
obtainable. Every genericised passage must end with a route to the real list — "email
privacy@… and we will send it". Strip the names without that line and you have traded a
leak for a transparency breach.

**Two carve-outs, both deliberate:**

- **Cookie tables keep the real cookie names** (`wos-session`, `_ga`, `ph_*`) and who sets
  them. PECR needs enough detail for a user to find and clear the cookie, and the browser
  displays all of it anyway. Genericising here hides nothing and breaks the policy's purpose.
- **A material transfer is still disclosed, just unnamed.** "Your interview audio goes to a
  specialist speech provider, which holds it under its own retention terms" keeps every fact
  the data subject needs and drops the one a competitor wants. Never delete the *transfer* —
  only the *brand*.

**Do not genericise into vagueness.** "We use various trusted partners" is not a category;
it is a non-answer, and a regulator reads it as one. Name the **function** precisely:
hosting, identity, payments, transactional email, product analytics, speech-to-text,
language-model routing, error tracking.

**Ship a test with it.** Genericised copy regresses the first time someone "adds detail for
transparency". Copy perspiva's `tests/legal/published-claims.test.tsx`: assert the public
page contains **no** vendor name, still contains every processing role, and still points at
the named list.

---

## Step 1 — Establish the product's actual exposure

Do not run a generic checklist. Read the project first and answer these, because they
change which documents are required:

| Question | Where to look | Why it matters |
|---|---|---|
| What personal data, and whose? | schema files, form components | Customers, employees and candidates are three different data-subject classes with three different notices |
| Which jurisdictions? | pricing/locale/region config, marketing copy, entity registrations | Drives GDPR vs CCPA vs PDPL vs sector law |
| Any automated decision-making? | scoring, ranking, matching, recommendation code | Triggers GDPR Art. 22, EU AI Act, NYC LL144, CA ADMT |
| Biometric or facial processing? | photo/video/face code paths | BIPA, Maryland, GDPR Art. 9 — a stored photo is not biometric; a face template is |
| Self-serve or contract sales? | signup and billing flows | Click-through terms vs MSA + DPA |
| Sub-processors? | dependency list, API clients, env vars | Every vendor touching personal data must be disclosed |
| Contracting entity? | **ask the user** | Not derivable from code, and gets it wrong in copy constantly |

Record the answers. They are the audit's scope statement, and they go at the top of the
report.

## Step 2 — Fan out per-surface agents

Split by *surface*, not by document, and launch in parallel in a single message. Adapt the
split to what the project contains — typically five to seven:

| Agent | Scope |
|---|---|
| Public site | Legal routes, footer links, sitemap, metadata, orphaned pages, `.well-known` |
| Consent & tracking | Banner behaviour, whether the stored preference is *read*, what loads before consent |
| In-product surfaces | Signup acceptance, whether it is **persisted**, in-app legal links, per-app routes |
| Data-subject side | The class with no contract — candidates, end users. Notices, retention, purge, DSAR |
| Automated decisions | What is scored, what is automatic, audit trail, explanation, disclosure |
| Contracts & evidence | DPA, MSA, SCCs, sub-processor list, certifications claimed vs held |

Brief each with concrete paths you already know — do not make them rediscover the layout.
Require a strict JSON return:

```json
{"findings":[{"id","document","status","severity","evidence","gap"}],
 "verified_absent":[{"document","grep_terms"}]}
```

`status` ∈ `have` · `partial` · `absent` · `unknown`. `partial` is the important one — a
document that exists but names the wrong entity, is unreachable, has no version, or is
promised in copy and inert in code.

## Step 3 — Hunt the claims

Separately from the document sweep, grep all user-facing copy for **assertions**:

```bash
grep -rniE "SOC ?2|ISO ?27001|HIPAA|PCI|GDPR compliant|fully compliant|bank-level|certified|audited" \
  --include=*.json --include=*.tsx --include=*.md src app apps locales messages
```

Every hit is a claim someone must be able to evidence. An unsupported certification claim
in marketing copy outranks every missing document in the report — it is live
misrepresentation, and it is usually a one-string fix. Check *all* locale files; claims
propagate through translation.

## Step 4 — Score against the canonical set

`references/canonical-set.md` holds the full document set with, per row: bucket, whether it
is legally required or commercially expected, the law or standard driving it, and where it
must live. `references/jurisdictions.md` holds the dated sector obligations — EU AI Act,
CA ADMT, NYC LL144, Illinois, BIPA, PDPL, ICO.

Filter the set by Step 1's answers. A project with no automated decision-making does not
need a bias audit, and saying it does is noise.

**Verify dates before quoting them.** Compliance deadlines move — the EU AI Act's high-risk
obligations shifted by sixteen months in July 2026. `WebSearch` the current status of any
deadline before putting it in a report.

## Step 5 — Write the outputs

```
<project>/_legal/findings.json        merged machine-readable findings
<project>/_legal/LEGAL-COVERAGE.md    the report
```

Report structure, in this order:

1. **Scope** — Step 1's answers, so a reader knows what was assessed against what.
2. **Stop-ship** — unsupported claims, expired artefacts, broken consent. Fix today.
3. **Coverage table** — every applicable document: status, evidence path, gap.
4. **Findings by severity** — likelihood × cost, each with `path:line` and a concrete fix.
5. **Verified absent** — with the grep terms used, so the next run can diff.
6. **Open questions** — business facts code cannot answer. Entity, insurance, certifications.

Re-running should diff cleanly against the previous `findings.json`. Never silently drop a
prior finding; mark it `resolved` with the commit that fixed it.

## Step 6 — Offer the deliverables

Three follow-ons, only when asked:

- **Fix pass** — work the report in severity order. Copy corrections are cheap and go
  first; consent persistence and retention are schema work.
- **Produce the document set** — Step 7.
- **Customer-facing deck** — hand the *verifiable* subset to `/deck`. Never the gap list.
  A trust deck may omit what is missing; it may never assert what is untrue. If the project
  has an unsupported claim live, fixing it is a hard predecessor to sending the deck.

## Step 7 — Produce the set (only when asked)

**Read `references/production.md` before writing a single document.** It carries the build
pipeline, the page integration rules, and eight failures that a full adversarial review pass
found in the reference implementation. Every one of them shipped past a green test suite.

The order is not negotiable, because each step depends on the last:

1. **`FACTS.md` first, derived from the codebase.** Entities, every sub-processor found in
   dependencies and env vars and hostnames, where data actually sits, what security measures
   are *verified*, retention as enforced (not as hoped), and a **"never assert" list**. One
   agent writes it; every drafting agent then draws only on it. Skip this and parallel agents
   invent mutually contradictory facts.
2. **Fan out drafting agents with no file overlap** — contracts · data protection · trust
   pack · corrections to existing copy. Each writes whole documents to its own directory.
3. **Build**: markdown → branded HTML → PDF, plus a generated manifest. Content-hash the
   inputs so an unchanged document does not re-render — headless Chrome PDF output is not
   byte-reproducible and will otherwise dirty megabytes per run.
4. **Publish behind a structural gate**, not a presentational one. Draft state is derived
   from the document's own banner. Drafts get no public asset at all — not a hidden link, no
   asset outside the served directory. See `references/production.md` § "The gate".
5. **Integrate using the project's own layout.** Find a sibling content page and reuse its
   shell, nav, footer and type scale. Never invent a new page style for legal pages — they
   are the pages a customer screenshots.
6. **Verify by attacking it.** Plant a draft where a published one goes and confirm the
   check fails. A gate you have not attacked is a gate you have not tested.

---

## Severity

| Level | Meaning |
|---|---|
| **Stop-ship** | Active misrepresentation, or a consent mechanism that is inert while trackers run |
| **High** | A legally required document absent, or a data-subject class with no notice or rights path |
| **Medium** | Present but broken — wrong entity, unreachable, unversioned, promised-and-inert |
| **Low** | Commercially expected but not legally required; expired non-critical artefacts |

## Failure modes

- **Treating a compliance feature as compliance documentation.** A product that helps
  *customers* meet their own obligations (quota calculators, policy libraries, handbook
  builders) is not the vendor's legal documentation. Check who owns the records: if rows
  carry a `companyId` and a customer admin can delete them, they are the customer's.
- **Counting a document that no one can reach.** A policy absent from the sitemap, with no
  footer link, behind a client-side-only redirect, is not published.
- **Trusting a checkbox.** Trace consent end to end: state → request → persisted field. It
  is routine to find it dropped before the network call, or hard-coded to `true`.
- **Scoring against a short list.** Popular "documents every startup needs" lists are a
  floor. Use the canonical set filtered by real exposure.
- **Auditing one locale.** Claims and entity names live in every translation.

## Reference files (read when needed)

- `references/canonical-set.md` — the full document set, by bucket, with drivers
- `references/jurisdictions.md` — dated sector obligations and current status
- `references/discovery.md` — grep and glob patterns per surface
- `references/production.md` — **required before Step 7.** Build pipeline, the gate, page
  integration, the eight failures already paid for, and what to do when the product does
  something the documents disclaim
