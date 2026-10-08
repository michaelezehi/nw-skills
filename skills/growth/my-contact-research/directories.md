# Directories — pick sources, then enrich

Public pages only. No logins, paywalls, or CAPTCHA walls. Rankings and news lists are **discovery**; emails and people come from the **official site** or a regulator record.

## How to pick directories (any industry)

1. **Regulator / licence open data** — densest named-authority source (registered manager, accountable person, officers).
2. **National / regional association member lists** — volume + websites; emails only if published.
3. **National chains** — location pages + one leadership page (CEO/founder).
4. **Official org pages** — `/contact` `/about` `/team` `/leadership` `/admissions` and local equivalents.
5. **Company/charity registers** — officers when clearly this org (Companies House, Charity Commission, equivalent).
6. Skip a row that still has no phone AND no website AND no email after enrichment.

Prefer sources that publish a name, a phone, or a `mailto:`. Form-only sites stay as phone/web rows.

## Worked example: rehab / addiction treatment

Use this bank when the target is rehab clinics, residential treatment, therapeutic communities. For other targets, follow the pattern above and do not force these URLs.

### UK

- CQC care directory / location pages (registered manager, nominated individual) — densest named-authority source
- Care Inspectorate Scotland datastore (manager name/email)
- RQIA Open Data (NI)
- Change Grow Live, Turning Point, We Are With You location pages
- Barod / Kaleidoscope / Adferiad / PHA Northern Ireland
- Charity Commission, Companies House
- Rehab Online, Phoenix Futures
- Official clinic contact pages

### EU

- German DKG qualified-withdrawal / Fachklinik lists (Chefarzt often name-only)
- Italian national therapeutic-community PDF (elenco)
- Fédération Addiction France
- Proyecto Hombre (Spain)
- MONAR (Poland)
- Infodrog (Switzerland)
- Austrian §15 SMG list
- Novadic-Kentron / VNN / De Sleutel / Tactus
- Official clinic leitung/equipe/chi-siamo pages
- Ireland: Smarmore, Rutland, Coolmine, Tabor, etc.

### US

- SAMHSA FindTreatment.gov (N-SUMHSS residential) — volume + phone, rarely email
- Official chain location + leadership pages: Hazelden Betty Ford, RCA, Recovery Village/ARS, Caron, Valley Hope, Gateway, Bradford, Mountainside, Meadows, AAC
- Newsweek Best Addiction Treatment lists for DISCOVERY only, then official-site enrichment
- Most US rehabs are form/phone-only; do not invent. Leadership pages list CEO names without mailto.

### Asia

- Rehabs.in (India volume: name/city/phone; email only if published)
- rehabs.ph JSON-LD
- Japan Kurihama/MHLW specialist-hospital table
- Korea MOHW addiction-centre directory
- Hong Kong Narcotics Division list
- Official sites: The Dawn, The Cabin, Jintara, The Winslow, Promises, Solace Asia, Kembali, LightHouse Arabia, Naufar, Cadabams, Jagruti, etc.
- Skip directory-only rows with no phone AND no website AND no email

### People-page paths (rehab and most orgs)

`/team` `/about` `/staff` `/leadership` `/our-people` `/equipe` `/leitung` `/chi-siamo` `/who-we-are` `/management`

Regulators when they name the accountable person: CQC, Care Inspectorate, RQIA, Companies House officers when clearly the org.
