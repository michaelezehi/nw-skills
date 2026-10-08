---
name: lead-research
description: >-
  Generates CRM-ready B2B lead CSVs for Unframed HR outreach from UK Companies
  House and public web sources. Investigates project ICP and pricing, asks for
  missing scope (regions, lead count, employee band, home postcode), runs the
  sales pipeline, writes leads.csv + RESEARCH.md, and always cleans ephemeral
  cache afterward. Use for lead research, outreach lists, prospect CSVs, field
  sales targets, or /lead-research.
---

# Lead Research — UK B2B outreach CSV

## Writing

Every string this skill emits for a human (`RESEARCH.md`, notes, outreach
context) must pass `agent-skills/unslop/SKILL.md`. Em dashes are prohibited.
Use a period or a comma.

Produces **`leads.csv`** (CRM import) + **`RESEARCH.md`** (methodology, fill rates, GDPR).

## Before you start

1. Read project context (do not guess ICP):
   - HR product & pricing: `apps/hr/convex-out/convex/_lib/pricing.ts`, `apps/hr/src/locales/product/en.json`
   - Pipeline scripts: `scripts/sales/build-uk-hr-leads.mjs`, `uk-hr-leads-lib.mjs`, `enrich-uk-hr-leads.mjs`, `index-uk-companies-by-region.mjs`
   - Prior example: `_r&d/research/uk-hr-outreach-leads/07-29/`
2. Parse the user prompt. **If these are already specified, do not ask — proceed:**
   - Product surface (default: **Unframed HR**)
   - Regions / cities (default UK: Manchester priority + Liverpool, Leeds, Birmingham, London)
   - **Minimum lead count** (default: 300)
   - Employee band (default: **20–250**)
   - Home postcode for visit priority (default: **M24**)
   - Data budget: `free_only` | `paid_ok` (default: free)
   - Qualify mode: `employees` (verified iXBRL) | `accounts` (MEDIUM/FULL proxy — faster)
3. **If any required field is missing**, use AskQuestion (one form, 1–2 rounds max):
   - Regions (multi-select or free text)
   - Min total leads
   - Employee band
   - Home postcode
   - Free vs paid enrichment

## Output layout

```bash
SLUG=$(echo "<topic>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g')
DATE_PATH=$(date +%m-%d/%H-%M)
mkdir -p "_r&d/research/${SLUG}/${DATE_PATH}/leads-by-region"
```

| Deliverable | Path |
|-------------|------|
| Master CSV | `_r&d/research/${SLUG}/${DATE_PATH}/leads.csv` |
| Regional CSVs | `.../leads-by-region/leads-{region}.csv` |
| Research notes | `.../RESEARCH.md` |

CSV columns are defined in `scripts/sales/uk-hr-leads-lib.mjs` → `CSV_COLUMNS`.

## Pipeline (execute in order)

### 1. Index (once per bulk snapshot)

```bash
# Downloads ~470 MB ZIP + builds regional JSON indexes if missing
node scripts/sales/index-uk-companies-by-region.mjs
```

Requires `BasicCompanyDataAsOneFile-*.csv` in `_r&d/research/<slug>/.cache/` (auto-downloaded on first build).

### 2. Build leads

```bash
# Fast path — MEDIUM/FULL accounts proxy (recommended when CH scraping is blocked)
pnpm sales:uk-leads -- --all-regions --qualify accounts --bulk-only

# Verified headcount (needs COMPANIES_HOUSE_API_KEY, slow, single-threaded)
COMPANIES_HOUSE_API_KEY=xxx pnpm sales:uk-leads -- --all-regions --qualify employees
```

Region quotas live in `REGION_CONFIG` inside `uk-hr-leads-lib.mjs`. Override with `--region manchester --quota 120`.

### 3. Enrich contacts

```bash
pnpm sales:uk-leads:enrich
```

Scrapes public websites / Yell for phone, email, website. **Never guess emails.**

### 4. Write RESEARCH.md

Include: date, lead count by region, fill-rate table, qualify mode used, GDPR (B2B legitimate interest, Ltd/LLP), CRM import notes, known limitations.

Take every count and fill rate from the CSV itself (for example `wc -l`, or a count over the column), not from the build script's log or memory. Say plainly which figures are unverified.

### 5. Cleanup

Remove the ephemeral cache after a successful run, because it holds 3+ GB inside the repo tree. Deliverables stay; `.cache/` does not.

```bash
pnpm sales:uk-leads:cleanup
# or automatic at end of build/enrich unless --no-cleanup
```

What gets deleted: ~40k HTTP/employee JSON shards, 2.6 GB bulk CSV/ZIP, regional index JSON.  
What stays: `leads.csv`, `RESEARCH.md`, `leads-by-region/*.csv`.

`.cache/` is gitignored (`_r&d/research/**/.cache/`).

## Operational rules

| Rule | Why |
|------|-----|
| **No parallel CH scraping** | Triggers 403 IP blocks; use API key + 4-wide concurrency max |
| **Cleanup after every run** | Prevents 3+ GB junk in the repo tree |
| **No guessed emails** | ICO / GDPR — public sources only |
| **Document proxy qualify** | `accounts_category_proxy` ≠ verified 20–250 employees |
| **Sort for field visits** | `outreach_priority` A first, then `distance_km_from_m24` |

## Custom regions

Edit `REGION_CONFIG` in `scripts/sales/uk-hr-leads-lib.mjs` (postcode prefixes + quota), re-run index, then build.

## npm scripts

| Script | Purpose |
|--------|---------|
| `pnpm sales:uk-leads:index` | Build regional indexes from bulk CH CSV |
| `pnpm sales:uk-leads` | Build lead CSVs |
| `pnpm sales:uk-leads:enrich` | Add website / phone / email |
| `pnpm sales:uk-leads:cleanup` | Delete entire `.cache/` tree |

## Success criteria

- [ ] `leads.csv` row count ≥ user minimum (default 300)
- [ ] Every row: company name, number, address, postcode, region, sources
- [ ] RESEARCH.md with fill rates and qualify-mode caveat
- [ ] `.cache/` removed (or only `--keep-index` when user explicitly wants faster re-run)
- [ ] User told path to `leads.csv` and how to sort for CRM import

## Reference

Full worked example: [`_r&d/research/uk-hr-outreach-leads/07-29/RESEARCH.md`](../../_r&d/research/uk-hr-outreach-leads/07-29/RESEARCH.md)
