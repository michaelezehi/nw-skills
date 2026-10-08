# Examples — my-contact-research

## Rehab clinics, four regions (Renovyn-shaped)

```
/my-contact-research rehab clinics --regions UK,EU,US,Asia --floor 1000 \
  --source .claude/goals/uk-outreach-database/raw/rehab-clinics.csv \
  --outdir ~/Downloads/renovyn-outreach --product Renovyn
```

**Expected:** inspect source (UK-only) → still expand EU/US/Asia independently → sidecars → `crm-import/` with identical schema. Keep working CSVs.

Natural language (same parse):

```
Use my-contact-research. Target: rehab clinics in UK/EU/US/Asia.
Source CSV: <path>. Floor 500 then 1000 unique orgs. Outdir: ~/Downloads/rehab-outreach.
We're Renovyn — context only. Public sources, no guessed emails, authority people only.
```

## Law firms, UK + EU, no source CSV

```
/my-contact-research "corporate law firms" --regions UK,EU --floor 200 \
  --outdir ~/Downloads/law-firm-outreach --product Acme
```

Directories: SRA/Law Society / national bar lists, firm `/people` or `/our-team` for managing partners. Associates dropped.

## Schools, one region

```
/my-contact-research "independent secondary schools" --regions UK --floor 300 \
  --outdir ./outreach-schools
```

Single region → one expand + one email + one people agent (still three files, not one).

## Enrich an existing CSV only

```
/my-contact-research "rehab clinics" --regions US --source ./leads.csv \
  --outdir ./outreach-us --floor 0
```

`--floor 0` (or “enrich only”): keep source orgs, run email + people hunts via `fetch.py`, still write `crm-import/`. Do not skip other requested regions if they have no source rows.

## One official site (Priory-shaped)

```
/my-contact-research "Priory Group" --regions UK --floor 0 \
  --outdir ~/Documents/contact-research/priory
```

Fetch `https://www.priorygroup.com/about-us/leadership-team` and `/about-us/contact` with `fetch.py`. People from `page.txt`; emails only from `emails.json`. Expect named executives with blank personal inboxes plus published org boxes (`info@`, `communications@`).

`/local-web-extract` is an alias for this skill — do not use a second skill.

## After delivery

User should see:

```text
{outdir}/
├── uk-{slug}-contacts.csv
├── uk-email-finds.csv
├── uk-people-finds.csv
├── (same for eu/us/asia as requested)
└── crm-import/
    ├── uk-crm-import.csv
    └── _CRM-IMPORT-README.txt
```
