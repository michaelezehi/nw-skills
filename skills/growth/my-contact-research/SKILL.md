---
name: my-contact-research
description: >-
  Builds a public-source B2B outreach CRM pack for any org type (rehab clinics,
  schools, law firms, investors, and similar). Discovers orgs by region, then
  locally fetches official pages (Playwright) and extracts published emails and
  high-authority people — ScrapeGraph's fetch→parse→extract flow, no cloud API.
  Use when scraping contacts, enriching a lead CSV, cold-outreach lists,
  prospecting, CRM import, company about/team pages, /my-contact-research, or
  /local-web-extract. Never guesses emails or invents people. Never calls
  scrapegraphai.com.
argument-hint: "[org type] [--regions UK,EU,US,Asia] [--source path.csv] [--floor N] [--outdir path] [--product name]"
disable-model-invocation: true
---

# my-contact-research

Public-source B2B contact scrape → enrich → **CRM import pack**. Industry-agnostic. Rehab clinics are a worked example, not the only target.

`$ARGUMENTS` (or the user prompt) supplies **who** (org type), **where**, optional **source CSV**, optional **floor**, **outdir**, and the product doing outreach (context only).

Copy this checklist and tick it as you go:

```
- [ ] 1. Parse inputs (target, regions, source CSV, floor, outdir, product)
- [ ] 2. Inspect source CSV if provided (do not treat one region as the world)
- [ ] 3. Workspace + working-file schema
- [ ] 4. Expand: one agent per region (sidecars; never share a write file)
- [ ] 5. Email backfill via local fetch.py (published emails only), then merge
- [ ] 6. Authority-people hunt via the same fetched page.txt + apply_page.py
- [ ] 7. Incremental second merge if a sidecar grew after the first merge
- [ ] 8. Build crm-import/ (exact schema) + README
- [ ] 9. Validate + report counts
```

## 1 — Parse the request

| Param | Required | Default |
|-------|----------|---------|
| **target** | yes | org type, e.g. `rehab clinics`, `law firms`, `secondary schools` |
| **regions** | no | `UK,EU,US,Asia` |
| **source** | no | existing CSV to seed (any header; map it) |
| **floor** | no | unique **orgs** per region (e.g. 500, then 1000). Rows may exceed orgs. |
| **outdir** | no | `./outreach-<slug>/` under cwd, or the path the user gave. If cwd is inside `crush-crm`, use `~/Documents/contact-research/<slug>/` instead. |
| **product** | no | who is doing outreach — context for agents only, not a CSV column |
| **slug** | no | kebab of target (`rehab-clinics`, `law-firms`) |

If target or regions are missing, ask once. Then run.

Read project `CLAUDE.md` / `README.md` when present so agents know the product. Do not put product copy into contact rows.

**Large run:** floor ≥ 500 or ≥ 2 regions → `own-goal` can drive it if the user wants agents logged in `.claude/goals/<slug>/ACCOUNTABILITY.md`. Either way, write data to **outdir** (may be outside the repo, e.g. `~/Downloads/...`).

## 2 — Hard rules

The pack claims every row came from a published page, so these hold on every run.

- Never guess or pattern-generate emails (no first.last@domain unless that exact address is published). A guessed address bounces and costs the sender's domain reputation.
- Never invent people. If a name/title is not in `page.txt`, skip it.
- Public sources only. No logins, paywalls, CAPTCHA walls.
- **Banned hosts:** LinkedIn, Instagram, TikTok, YouTube. `fetch.py` exits 2 — do not retry with another tool.
- **Warn hosts** (Crunchbase, Clutch, G2): skip unless the user explicitly overrides.
- Do not call ScrapeGraph cloud (`SGAI_API_KEY`, MCP) or `pip install scrapegraphai`. Local Playwright only.
- Do not write research files inside a `crush-crm` directory.
- Generic clinic/org inboxes ARE wanted for CRM (info@, admissions@, referrals@, hello@, enquiries@).
- Named people = HIGH AUTHORITY only: CEO, founder, owner, president, managing/executive director, clinical/medical director, CMO, admissions director, registered manager (CQC accountable person), chair. DROP therapists, counsellors, nurses, coordinators, secretaries, "Admissions Team" as a person.
- If a named person has no personal email, still keep name+title; attach the org generic email as fallback with email_type=generic.
- Sidecar files during parallel work so agents don't overwrite each other.
- Incremental writes with Python csv quoting. UTF-8.

Title overlays for other industries: [reference.md](reference.md). Directory bank: [directories.md](directories.md).

## 3 — Inspect source CSV

If `--source` is set, open it **before** expanding.

- Map headers (`organization`/`clinic_name`/`company` → `org_name`; `full_name` → `contact_name`; `title` → `contact_title`).
- Count rows, countries, blank emails, person-centric vs org-centric.
- If it is single-region (Renovyn's `rehab-clinics.csv` was 144 UK-only GB rows, person-centric `full_name`/`title`/`organization`), **do not stop other regions** — gather those regions independently from public directories.
- Seed the matching region's working file. Keep every seed row.

## 4 — Workspace

```text
{outdir}/
├── {region}-{slug}-contacts.csv      ← working org list (expand agents OWN this)
├── {region}-email-finds.csv          ← email agents ONLY
├── {region}-people-finds.csv         ← people agents ONLY
├── pages/{slug}/                 ← fetch.py artifacts (html, txt, emails.json)
├── crm-import/
│   ├── {region}-crm-import.csv
│   └── _CRM-IMPORT-README.txt
└── (optional) .bak files, sources/, expand_*.py
```

`{region}` = `uk` | `eu` | `us` | `asia` (filename lowercase).

**Do not delete working files** after the CRM pack exists. The pack is the import set; the rest is research.

Write with `csv.DictWriter` (`encoding="utf-8"`, `newline=""`, default quoting). Never concatenate CSV by hand.

### Working contacts header

```csv
org_name,address,city,region,postcode,country,website,email,phone,contact_name,contact_title,source_url,notes,confidence
```

Accept `clinic_name` as an alias of `org_name` when reading older files. Prefer `org_name` on new writes.

Phone + address with blank email is OK. Skip directory-only rows with no phone AND no website AND no email.

### Email-finds header

```csv
org_name,city,website,email,contact_name,contact_title,phone,source_url,notes,confidence
```

### People-finds header

```csv
org_name,city,person_name,person_title,email,phone,website,source_url,notes,confidence
```

## 5 — Pipeline (parallel by region)

One **expand** agent, one **email** agent, one **people** agent per region. **No two agents write the same file.**

### 5a Expand

Keep existing rows. Dedup `website` + `org_name` + `city`. Add public-directory orgs until floor (unique orgs) or sources exhaust.

Crawl official registries, association lists, chain location pages, official sites. News rankings / “best of” lists = **discovery only**, then enrich from the official site.

Pick directories for this target: [directories.md](directories.md). Rehab = appendix in that file.

### 5b Email backfill (fetch → parse → extract)

Email agents **read** the working CSV and **write** `{region}-email-finds.csv` only.

This is ScrapeGraph’s graph, run locally: Playwright fetch, regex parse of published emails, nothing that is not in `emails.json`.

Once per machine:

```bash
bash ~/.claude/skills/my-contact-research/setup.sh
```

`PY=~/.claude/skills/my-contact-research/.venv/bin/python`
`SKILL=~/.claude/skills/my-contact-research/scripts`

For each org with a website, prefer `/contact` `/about` `/admissions` `/impressum` `/contacto` over the homepage:

```bash
$PY "$SKILL/fetch.py" --url "<page url>" --out "{outdir}/pages/<slug>"
```

- Exit 2 → banned/warn. Skip that URL.
- Exit 1 / `meta.json` `ok: false` → do not extract.
- Exit 0 → `apply_page.py` (below). Do not copy an email unless it is in `emails.json`.

Then merge (orchestrator, not the hunters):

```bash
SKILL=~/.claude/skills/my-contact-research/scripts
python3 "$SKILL/merge_emails.py" "{outdir}/{region}-{slug}-contacts.csv" "{outdir}/{region}-email-finds.csv"
```

Fill blank emails only, never overwrite. If duplicate org rows, fill every blank (do not skip as "ambiguous"). If the sidecar grows later, run merge again.

### 5c Authority people

People agents **read** working CSV and **write** `{region}-people-finds.csv` only.

Reuse the fetched page when it is `/team` `/about` `/staff` `/leadership` `/our-people` `/equipe` `/leitung` `/chi-siamo`. Otherwise `fetch.py` those paths.

From `page.txt` (first ~20k chars plus team/leadership headings) write `{outdir}/pages/<slug>/extract.json`:

```json
{
  "phone": "",
  "people": [{"name": "", "title": "", "email": ""}]
}
```

Names and titles must appear in `page.txt`. `email` only if it is in that page’s `emails.json`. Then:

```bash
$PY "$SKILL/apply_page.py" \
  --page-dir "{outdir}/pages/<slug>" \
  --org "<org_name>" --city "<city>" --website "<website>" \
  --email-csv "{outdir}/{region}-email-finds.csv" \
  --people-csv "{outdir}/{region}-people-finds.csv" \
  --extract "{outdir}/pages/<slug>/extract.json"
```

`apply_page.py` drops non-authority titles and unpublished emails. Name + title with blank email is OK.

Drop leftover non-authority rows from the sidecar before CRM build.

## 6 — CRM pack

```bash
python3 "$SKILL/build_crm_import.py" "{outdir}" --slug "{slug}" --regions uk,eu,us,asia
python3 "$SKILL/validate_crm.py" "{outdir}/crm-import"
```

`validate_crm.py` exits 1 on bad header, fake emails, illegal `email_type`, or missing `company`. Clinic-only blank names are allowed. Floor shortfalls are warnings, not failures. Do not delete working files.

### CRM schema (exact header)

```csv
first_name,last_name,job_title,company,email,email_type,phone,website,address,city,region,postcode,country,source_url,notes
```

email_type: personal | generic | (blank)

One row per authority person (preferred) + clinic-only rows for orgs with email/phone but no person. Dedup email+company.

Distinct people who share a generic org inbox stay as separate rows. `email`+`company` dedupe applies to clinic-only rows and to **personal** inboxes, not to generic fallbacks on different names.

Drop fake emails: john@doe.com, info@domainname.com, wordpress@, sample@, regulator generic inboxes (england.contactus@nhs.net, named.inspector@rqia.org.uk). See [reference.md](reference.md).

## 7 — Report

Tell the user:

- Path to `crm-import/`
- Per region: unique orgs, CRM rows, emails (personal vs generic vs blank), authority people, clinic-only rows
- Coverage by country (and US state / UK nation if present)
- Floor shortfalls (sources exhausted, not fabricated)
- Paths to working files + sidecars (kept)

Take every count from `validate_crm.py` output or a count run this session, not from memory; say plainly what is unverified.

## Anti-patterns

- Guessing `first.last@domain` or any unpublished address
- Inventing people or titles
- Calling ScrapeGraph MCP / `SGAI_API_KEY` or installing `scrapegraphai`
- Fetching LinkedIn / IG / TikTok / YouTube
- Scraping behind login, paywall, or CAPTCHA
- Collecting junior staff (therapists, counsellors, nurses, coordinators, secretaries, “Admissions Team” as a person)
- Two agents writing the same working CSV (use sidecars)
- Overwriting a non-blank email on merge
- Skipping duplicate org rows as “ambiguous” instead of filling every blank
- Stopping other regions because the source CSV is UK-only (or any single region)
- Deleting working files after CRM export
- Using Newsweek / ranking lists as the email source instead of official sites
- Keeping directory stubs with no phone, no website, and no email

## Resources

- [reference.md](reference.md) — merge rules, titles, fake-email list, scripts
- [directories.md](directories.md) — how to pick sources; rehab bank
- [examples.md](examples.md) — invocations
