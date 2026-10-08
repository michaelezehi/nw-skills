#!/usr/bin/env python3
"""Build crm-import/ from working contacts + people-finds (+ leftover emails).

Usage: build_crm_import.py OUTDIR [--slug SLUG] [--regions uk,eu,us,asia]
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    CRM_HEADER,
    clean_email,
    email_type_for,
    host,
    is_authority_title,
    is_generic_local,
    norm,
    org_of,
    person_of,
    read_dicts,
    split_name,
    title_of,
    write_dicts,
)


def find_working(outdir: Path, region: str, slug: str) -> Path | None:
    candidates = [
        outdir / f"{region}-{slug}-contacts.csv",
        outdir / f"{region}-rehab-clinics-contacts.csv",
        outdir / f"{region}-{slug}.csv",
    ]
    for p in candidates:
        if p.exists():
            return p
    matches = sorted(outdir.glob(f"{region}-*-contacts.csv"))
    return matches[0] if matches else None


def org_index(rows: list[dict]) -> list[dict]:
    indexed = []
    for row in rows:
        indexed.append(
            {
                "org": norm(org_of(row)),
                "city": norm(row.get("city", "")),
                "host": host(row.get("website", "")),
                "row": row,
            }
        )
    return indexed


def match_org(person: dict, orgs: list[dict]) -> dict | None:
    org = norm(org_of(person))
    city = norm(person.get("city", ""))
    h = host(person.get("website", ""))
    for rank, pred in (
        ("orgcity", lambda o: org and o["org"] == org and city and o["city"] == city),
        ("host", lambda o: h and o["host"] == h),
        ("org", lambda o: org and o["org"] == org),
    ):
        hits = [o["row"] for o in orgs if pred(o)]
        if hits:
            return hits[0]
    return None


def crm_row_from_person(person: dict, org_row: dict | None) -> dict:
    first, last = split_name(person_of(person))
    org = org_row or {}
    personal = clean_email(person.get("email", ""))
    org_email = clean_email(org.get("email", ""))
    if personal and not is_generic_local(personal):
        email, etype = personal, "personal"
    elif personal:
        email, etype = personal, "generic"
    elif org_email:
        email, etype = org_email, email_type_for(org_email, True)
        if etype == "personal":
            etype = "generic"
    else:
        email, etype = "", ""
    return {
        "first_name": first,
        "last_name": last,
        "job_title": title_of(person),
        "company": org_of(person) or org_of(org),
        "email": email,
        "email_type": etype,
        "phone": (person.get("phone") or org.get("phone") or "").strip(),
        "website": (person.get("website") or org.get("website") or "").strip(),
        "address": (org.get("address") or "").strip(),
        "city": (person.get("city") or org.get("city") or "").strip(),
        "region": (org.get("region") or "").strip(),
        "postcode": (org.get("postcode") or "").strip(),
        "country": (org.get("country") or "").strip(),
        "source_url": (person.get("source_url") or org.get("source_url") or "").strip(),
        "notes": (person.get("notes") or org.get("notes") or "").strip(),
    }


def crm_row_from_org(org: dict) -> dict:
    email = clean_email(org.get("email", ""))
    return {
        "first_name": "",
        "last_name": "",
        "job_title": "",
        "company": org_of(org),
        "email": email,
        "email_type": email_type_for(email, False) if email else "",
        "phone": (org.get("phone") or "").strip(),
        "website": (org.get("website") or "").strip(),
        "address": (org.get("address") or "").strip(),
        "city": (org.get("city") or "").strip(),
        "region": (org.get("region") or "").strip(),
        "postcode": (org.get("postcode") or "").strip(),
        "country": (org.get("country") or "").strip(),
        "source_url": (org.get("source_url") or "").strip(),
        "notes": (org.get("notes") or "").strip(),
    }


def dedupe(rows: list[dict]) -> list[dict]:
    """One row per authority person. Do not collapse different people who share
    a generic org inbox. Personal emails unique per company. Clinic-only unique
    on email+company (or company+city when email is blank)."""
    seen: set[tuple] = set()
    out = []
    for row in rows:
        company = norm(row.get("company", ""))
        first = norm(row.get("first_name", ""))
        last = norm(row.get("last_name", ""))
        city = norm(row.get("city", ""))
        email = (row.get("email") or "").lower()
        et = row.get("email_type") or ""
        is_person = bool(first or last)
        if is_person:
            key = ("p", company, first, last, city)
        elif email:
            key = ("c", email, company)
        else:
            key = ("c", company, city)
        if key in seen:
            continue
        if is_person and et == "personal" and email:
            pkey = ("pe", email, company)
            if pkey in seen:
                continue
            seen.add(pkey)
        seen.add(key)
        out.append(row)
    return out


def org_key(row: dict) -> str:
    """Location identity. Do not use website host — chains share one domain."""
    return f"{norm(org_of(row))}|{norm(row.get('city', ''))}"


def build_region(outdir: Path, region: str, slug: str) -> dict | None:
    working_path = find_working(outdir, region, slug)
    if not working_path:
        print(f"skip {region}: no working contacts CSV")
        return None
    orgs = read_dicts(working_path)
    people_path = outdir / f"{region}-people-finds.csv"
    people = read_dicts(people_path) if people_path.exists() else []
    people = [p for p in people if is_authority_title(title_of(p)) and person_of(p)]
    indexed = org_index(orgs)

    crm: list[dict] = []
    covered: set[str] = set()
    for person in people:
        org_row = match_org(person, indexed)
        row = crm_row_from_person(person, org_row)
        if not row["company"]:
            continue
        crm.append(row)
        covered.add(org_key(person))
        if org_row and org_key(org_row) == org_key(person):
            covered.add(org_key(org_row))

    clinic_only = 0
    for org in orgs:
        if org_key(org) in covered:
            continue
        email = clean_email(org.get("email", ""))
        phone = (org.get("phone") or "").strip()
        if not email and not phone:
            continue
        crm.append(crm_row_from_org(org))
        clinic_only += 1

    crm = dedupe(crm)
    dest_dir = outdir / "crm-import"
    dest = dest_dir / f"{region}-crm-import.csv"
    write_dicts(dest, CRM_HEADER, crm)

    unique_orgs = len({org_key(r) for r in orgs if org_of(r) or host(r.get("website", ""))})
    emails = [r for r in crm if r["email"]]
    personal = sum(1 for r in crm if r["email_type"] == "personal")
    generic = sum(1 for r in crm if r["email_type"] == "generic")
    person_rows = sum(1 for r in crm if r["first_name"] or r["last_name"])
    stats = {
        "region": region,
        "file": str(dest),
        "rows": len(crm),
        "person": person_rows,
        "clinic_only": sum(1 for r in crm if not (r["first_name"] or r["last_name"])),
        "emails": len(emails),
        "personal": personal,
        "generic": generic,
        "blank": len(crm) - len(emails),
        "unique_orgs": unique_orgs,
        "countries": dict(Counter((r.get("country") or "?") for r in crm)),
    }
    print(
        f"{region}: {stats['rows']} rows ({stats['person']} person, "
        f"{stats['clinic_only']} clinic-only) emails {stats['emails']} "
        f"(personal {personal} / generic {generic}) orgs {unique_orgs}"
    )
    return stats


def write_readme(outdir: Path, stats_list: list[dict]) -> None:
    dest = outdir / "crm-import" / "_CRM-IMPORT-README.txt"
    lines = [
        "CRM import set",
        "===============",
        "",
        f"Generated: {date.today().isoformat()}",
        "Location: crm-import/",
        "",
        "UTF-8 CSV, identical schema:",
    ]
    for s in stats_list:
        lines.append(f"  crm-import/{s['region']}-crm-import.csv")
    lines += [
        "",
        "Schema:",
        "  first_name,last_name,job_title,company,email,email_type,phone,website,",
        "  address,city,region,postcode,country,source_url,notes",
        "",
        "email_type is personal (named person's published address), generic",
        "(org inbox such as info@ / admissions@ / referrals@ / hello@ /",
        "enquiries@), or blank when no email was published. No emails were guessed.",
        "No people were invented. Clinic-only rows are for locations with a",
        "published email or phone and no authority-person row.",
        "",
        "Row counts",
        "----------",
    ]
    tot = {
        "rows": 0, "person": 0, "clinic_only": 0, "emails": 0,
        "personal": 0, "generic": 0, "blank": 0,
    }
    for s in stats_list:
        lines.append(
            f"{s['region']}-crm-import.csv: {s['rows']} rows "
            f"({s['person']} person, {s['clinic_only']} clinic-only)"
        )
        lines.append(
            f"  emails: {s['emails']} total | {s['personal']} personal | "
            f"{s['generic']} generic | {s['blank']} blank"
        )
        lines.append(f"  unique orgs (working file): {s['unique_orgs']}")
        cov = ", ".join(f"{k} {v}" for k, v in sorted(s["countries"].items()))
        lines.append(f"  coverage: {cov}")
        for k in tot:
            tot[k] += s[k]
    if len(stats_list) > 1:
        lines += [
            "",
            f"All files: {tot['rows']} rows ({tot['person']} person, {tot['clinic_only']} clinic-only)",
            f"  emails: {tot['emails']} total | {tot['personal']} personal | "
            f"{tot['generic']} generic | {tot['blank']} blank",
        ]
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {dest}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("outdir")
    p.add_argument("--slug", default="rehab-clinics")
    p.add_argument("--regions", default="uk,eu,us,asia")
    args = p.parse_args()
    outdir = Path(args.outdir)
    regions = [r.strip().lower() for r in args.regions.split(",") if r.strip()]
    stats = []
    for region in regions:
        s = build_region(outdir, region, args.slug)
        if s:
            stats.append(s)
    if not stats:
        print("No regional CSVs found", file=sys.stderr)
        return 1
    write_readme(outdir, stats)
    return 0


if __name__ == "__main__":
    sys.exit(main())
