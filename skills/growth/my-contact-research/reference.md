# Reference — my-contact-research

## Schemas

Working, email-finds, people-finds, and CRM headers are in [SKILL.md](SKILL.md). CRM header must match exactly.

Read aliases for org column: `org_name`, `clinic_name`, `organization`, `company`, `name`.
Person: `contact_name`, `full_name`, `person_name`.
Title: `contact_title`, `title`, `job_title`, `person_title`.

## Email rules

**Include only when publicly verified:**

- `mailto:` on an official contact/about/admissions/team page
- Email printed on the same official page as the org or the named person
- Generic org inboxes (info@, admissions@, referrals@, hello@, enquiries@, contact@) **are wanted**

**Never:**

- Guess `first.last@domain` unless that exact address is published
- Use a contact form as if it were an email
- Keep strings containing `.png`, `@2x`, `favicon`
- Keep regulator/helpdesk inboxes that are not the org’s (see blocklist)

### email_type

| Value | When |
|-------|------|
| `personal` | Named person’s published inbox (local part is not a generic role) |
| `generic` | Org inbox, or personal row using org inbox as fallback |
| blank | No published email |

If a named person has no personal email, keep name+title and attach the org generic email with `email_type=generic`.

### Generic local parts

`info`, `hello`, `contact`, `enquiries`, `enquiry`, `inquiries`, `admissions`, `referrals`, `referral`, `admin`, `office`, `reception`, `intake`, `welcome`, `mail`, `enquiries`, `kontakt`, `segreteria`, `info-en`

## Fake / junk emails (drop)

Clear the email (keep the row). Extend this list when a run finds more.

- `john@doe.com`, `jane@doe.com`
- `info@domainname.com`, `email@domain.com`, `name@email.com`
- local part `wordpress`, `sample`, `example`, `test`, `fake`, `placeholder`, `noreply`, `no-reply`, `donotreply`
- domain `example.com`, `example.org`, `domain.com`, `domainname.com`, `email.com`, `test.com`, `sentry.io`
- `england.contactus@nhs.net`
- `named.inspector@rqia.org.uk` (RQIA staff inbox scraped as if it were the clinic)
- Other regulator/PALS/webmaster inboxes that are not the target org

## Authority titles

**Keep (and close variants):** CEO, chief executive, founder, co-founder, owner, proprietor, president, managing director, executive director, clinical director, medical director, CMO, chief medical, chief operating, chief clinical, chief people, chief quality, CFO, general counsel, company secretary, finance director, admissions director, registered manager, nominated individual, centre/clinic manager, chair / chairman / chairwoman / chairperson.

**Local-language equivalents count:** Geschäftsführer(in), Chefarzt / Chefärztin / ärztliche Leitung, Président / Presidente, Directeur / Directora / Direttore, Voorzitter, daglig leder / styreleder, Verkställande direktör, ředitel(ka).

**Drop:** therapists, counsellors, counselors, nurses, coordinators, secretaries, medical secretaries, keyworkers, support workers, reception, “team members”, generic “Admissions Team” / “Admissions Coordinator” as a person.

### Industry overlays (add, do not replace the keep/drop lists)

| Target | Extra keep | Extra drop |
|--------|------------|------------|
| Investors / funds | GP, managing partner, founding partner, general partner, investment partner | IR, legal, ops, comms, “Partner” UI chrome with no person |
| Law firms | Managing partner, founding partner, practice chair | Associates, paralegals, secretaries |
| Schools | Headteacher, principal, bursar, chair of governors | Classroom teachers, TAs |
| Clinics (default) | As keep list + CQC registered manager | Clinical staff below director |

Do not invent a person to fill a keep title.

## Expand / dedupe

- Dedup working file on `website` hostname + `org_name` + `city` (casefold, strip `www.`)
- Keep existing rows; append new unique orgs
- Phone + address with blank email is OK
- Drop rows with no phone AND no website AND no email

## Email merge

`scripts/merge_emails.py` MAIN SIDECAR

- Only fill blank `email` cells. Never overwrite.
- Match `org_name`+`city` **or** website hostname.
- If several working rows match one org, fill **ALL** blanks. Do not skip as “ambiguous”.
- Ignore sidecar emails that fail the fake-email check.
- Backup `MAIN.bak` once if missing; `MAIN.bak2` if `.bak` exists.
- If the sidecar grows after a merge, run again (incremental).

## People → CRM

`scripts/build_crm_import.py OUTDIR --slug SLUG --regions uk,eu,us,asia`

- Filter people-finds through keep/drop titles.
- One CRM row per authority person. Split `person_name` on first whitespace (`first_name`, rest `last_name`). Strip honorifics `Dr`, `Mr`, `Mrs`, `Ms`, `Prof`.
- Copy address/phone/website from the matching working-file org.
- Person email if published and not generic → `email_type=personal`. Else org generic fallback → `generic`. Else blank.
- Clinic-only row: org has email or phone, no remaining authority person at that `org_name`+`city`. Blank names.
- Distinct people who share a generic org inbox stay separate. Dedup same person (`company`+names+`city`); personal `email`+`company`; clinic-only `email`+`company`.
- Write `crm-import/{region}-crm-import.csv` and `_CRM-IMPORT-README.txt`.
- Do not delete working or sidecar files.

## Parallelism

| Agent | May write | Must not write |
|-------|-----------|----------------|
| Expand `{region}` | `{region}-{slug}-contacts.csv` | `*-email-finds.csv`, `*-people-finds.csv`, `crm-import/` |
| Email `{region}` | `{region}-email-finds.csv` | working contacts, people-finds, crm-import |
| People `{region}` | `{region}-people-finds.csv` | working contacts, email-finds, crm-import |
| Orchestrator | merge_emails, build_crm_import | — |

## Scripts

```bash
SKILL=~/.claude/skills/my-contact-research
PY="$SKILL/.venv/bin/python"
python3 "$SKILL/scripts/merge_emails.py" MAIN.csv SIDECAR.csv
python3 "$SKILL/scripts/build_crm_import.py" OUTDIR --slug SLUG --regions uk,eu,us,asia
python3 "$SKILL/scripts/validate_crm.py" OUTDIR/crm-import
"$PY" "$SKILL/scripts/fetch.py" --url URL --out OUTDIR/pages/slug
"$PY" "$SKILL/scripts/apply_page.py" --page-dir DIR --org NAME --email-csv SIDECAR.csv [--people-csv P.csv] [--extract extract.json]
```

`fetch.py` is the local FetchNode: Playwright, then `emails.json` / `phones.json` from the HTML. Exit 2 = banned host. `apply_page.py` is the persist step: only emails listed in `emails.json`, only authority titles in people-finds.

`validate_crm.py` exits 1 on bad header, fake emails left in place, illegal `email_type`, or missing `company`. Clinic-only blank names are allowed. Floor shortfalls are warnings, not failures.

Once: `bash ~/.claude/skills/my-contact-research/setup.sh`

## Source CSV inspection

Person-centric seed (`full_name`,`title`,`organization`) → map into working schema; `contact_name` may be non-authority (Admissions Team). Do not copy those names into people-finds. Country `GB`/`UK`/`United Kingdom` → region `uk`. **Never** cancel EU/US/Asia because the seed is UK-only.

## Old investor CSV (deprecated)

Previous runs used `region,country,investor_type,full_name,title,organization,email,phone,linkedin_url,website,focus_stages,focus_sectors,source_url,vetting_notes` and deleted intermediates. **Do not use that schema or cleanup.** Default deliverable is `crm-import/` with the CRM header above. Investor *targets* still work: funds as orgs, GPs/partners as authority people.
