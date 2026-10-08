# Discovery patterns

Starting points, not a script. Adapt paths to the project's layout. Every "absent" finding
must record the terms that returned nothing, so the next run can diff.

Exclude noise from every sweep:

```bash
--exclude-dir={node_modules,.next,dist,build,.git,coverage,__pycache__}
```

---

## Legal routes and pages

```bash
find . -type d \( -iname "*privacy*" -o -iname "*terms*" -o -iname "*legal*" \
  -o -iname "*cookie*" -o -iname "*dpa*" -o -iname "*trust*" -o -iname "*security*" \) \
  -not -path "*/node_modules/*"

ls -la .well-known public/.well-known 2>/dev/null
```

Check for the classic split: a short redirect stub at one path and the real document at
another. Then verify which one the footer and sitemap actually point to.

```bash
grep -rn "privacy\|/terms\|cookie-policy\|/dpa\|/security\|/trust\|subprocessor" \
  --include=*.tsx --include=*.ts --include=*.jsx src app | grep -i "href\|Link\|url"
```

**Reachability test — a document only counts if all four hold:**

1. Returns 200 without JavaScript (a client-side `router.replace` is not a redirect)
2. Present in the sitemap
3. Linked from a persistent surface, not only from a banner that self-suppresses
4. Carries an effective date and a version

## Claims audit — run this first, it outranks everything

```bash
grep -rniE "SOC ?2|ISO ?27001|HIPAA|PCI[- ]?DSS|GDPR[- ]compliant|fully compliant|\
bank[- ]level|military[- ]grade|certified|accredited|audited|penetration test" \
  --include=*.json --include=*.tsx --include=*.md .
```

Then, for every hit, ask: **where is the artefact?** No report, no auditor, no bridge letter
means the claim is unsupported. Check every locale — claims propagate through translation
and get fixed in only one.

## Consent — trace it end to end

```bash
grep -rn "cookieConsent\|CookieBanner\|ConsentBanner\|consentMode\|gtag('consent'" src app
grep -rn "gtag\|googletagmanager\|posthog\|clarity\|hotjar\|mixpanel\|segment\|fbq\|_paq" src app
```

Three questions, in order:

1. Is a preference **stored**?
2. Does anything **read** it? *(Count the grep hits. If they are all in the banner file, the answer is no.)*
3. Do trackers load **before** consent? Check module-scope initialisation and
   `strategy="afterInteractive"` script tags.

Session recording (Clarity, Hotjar, FullStory) raises severity above ordinary analytics.

## Acceptance — is it persisted?

```bash
grep -rn "acceptTerms\|agreeToTerms\|termsAccepted\|policyVersion\|tosVersion\|acceptanceIp" src app
grep -rn "termsAccepted\|policyVersion\|acceptedAt\|consentGiven" **/schema.ts **/schema.prisma
```

Follow the variable: local state → submit handler → network call → schema field. It is
routine to find it dropped at the network boundary, or hard-coded to `true` in the client.
Beware near-misses — an `acceptedAt` on an *invitation* is not terms acceptance.

## The data subject with no contract

The highest-risk class in most products: candidates, patients, end users of a customer's
deployment. They never signed anything.

```bash
grep -rn "privacy notice\|data protection\|your personal data\|how we use your\|\
data controller\|retention period\|lawful basis" src app
```

Then check the collection points — public forms, upload flows, application flows — for a
notice at the point of collection, and the backend for a retention or purge job:

```bash
grep -rn "retention\|purge\|expire\|ttl\|anonymi\|erasure\|rightToBeForgotten" \
  --include=*.ts convex server api
```

## Automated decision-making

```bash
grep -rn "score\|rank\|match\|threshold\|autoReject\|autoAdvance\|tier" \
  --include=*.ts server api convex | grep -iv test
```

For each scoring path, establish:

- **What it evaluates** — and whether the weights live in code or inside a prompt string
- **What is automatic** — tier assignment, stage transitions, rejection
- **Whether an audit trail exists** — model actually used, prompt version, actor, score
  history. Scores overwritten in place are a finding
- **Whether the subject is told** — grep the notification and email paths
- **Where explanations render** — and whether any of it is publicly reachable
- **Orphaned controls** — a persisted setting with a full UI that nothing reads. Users
  believe it is configured

## Sub-processors

Every vendor touching personal data must be disclosed. Build the real list from the code,
then compare to what is published:

```bash
grep -rn "api_key\|API_KEY\|_TOKEN\|_SECRET" .env.example 2>/dev/null | cut -d= -f1
cat package.json | grep -iE "sdk|client|analytics|sentry|stripe|twilio|sendgrid|resend"
```

Then: `grep -rn "sub-processor\|subprocessor" .` — usually returns nothing.

## Entity identity

```bash
grep -rniE "ltd|limited|inc\.|llc|gmbh|holdings|company (no|number)|registered office" \
  --include=*.json locales messages src
```

Cross-check every result against the actual registration. Multiple entity names inside one
document is a common finding after a rebrand or restructure — and the operative clauses
often disagree with the intro. **Ask the user which entity contracts; it is not derivable
from code.**

## Expiry sweep

```bash
grep -rn "Expires" .well-known/security.txt public/.well-known/security.txt 2>/dev/null
grep -rniE "effective date|last updated|last revised" --include=*.json locales messages
```

Expired `security.txt` and policies with an effective date years old are cheap, certain
findings.

## Distinguishing vendor documents from product features

A recurring trap. A product that helps *customers* meet **their** obligations — quota
calculators, policy libraries, handbook builders, compliance dashboards — is not the
vendor's legal documentation.

The test is ownership of the records:

- Rows carry a `companyId` or tenant key → the customer's
- A customer admin can create **and delete** them → the customer's
- Seeded by the vendor, undeletable, identical across tenants → possibly the vendor's

State the distinction explicitly in the report. Getting it wrong inflates coverage badly —
a compliance-looking feature in the primary navigation while the DPA and sub-processor list
are absent is a common and misleading shape.
