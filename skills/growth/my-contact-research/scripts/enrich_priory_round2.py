#!/usr/bin/env python3
"""Round-2 Priory UK enrich: clinician API, multi-site consultants, dedupe, merge."""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import CRM_HEADER, clean_email, email_type_for, is_generic_local, norm, split_name, write_dicts  # noqa: E402
from batch_priory_median import (  # noqa: E402
    CLINICIAN_TITLES,
    JUNK_PERSON,
    SKIP_NAME,
    TARGET_TITLE_RE,
    best_email,
    dedupe_crm,
    load_json,
    parse_all,
    parse_consultant,
    parse_leadership,
    parse_location,
)

SKILL_ROOT = Path(__file__).resolve().parents[1]
PYTHON = SKILL_ROOT / ".venv" / "bin" / "python"
FETCH = SKILL_ROOT / "scripts" / "fetch.py"
SCRAPE_API = SKILL_ROOT / "scripts" / "scrape_clinician_api.py"

TITLE_LINE_RE = re.compile(
    r"^(consultant psychiatrists?|specialty doctors?|therapist/other specialists|"
    r"consultant clinical psychologists?|consultant psychologists?)$",
    re.I,
)


def is_real_person_name(name: str) -> bool:
    n = (name or "").strip()
    if not n or len(n) < 4 or JUNK_PERSON.match(n) or SKIP_NAME.match(n):
        return False
    if TITLE_LINE_RE.match(n):
        return False
    if TARGET_TITLE_RE.match(n) and len(n.split()) <= 3:
        return False
    parts = n.split()
    if len(parts) < 2:
        return False
    return True


def parse_consultant_multi(text: str, source_url: str, emails: list[str], phones: list[str], org_index: dict[str, str]) -> list[dict]:
    base = parse_consultant(text, source_url, emails, phones)
    if not base or not is_real_person_name(base.get("person_name", "")):
        return []
    orgs: list[str] = []
    for ln in text.splitlines():
        ln = ln.strip()
        if (
            ln.startswith("Priory Hospital")
            or ln.startswith("Priory Clinic")
            or ln.startswith("Priory Wellbeing")
        ) and ln not in orgs:
            orgs.append(ln)

    rows: list[dict] = []
    seen_email: set[str] = set()
    for org in orgs or [base.get("org_name") or "Priory"]:
        row = {**base, "org_name": org, "source_url": source_url, "email": ""}
        row = attach_email(row, org_index)
        email = (row.get("email") or "").lower()
        # Only expand to hospitals where we have a distinct published site inbox
        if email and email not in seen_email and not email.startswith("info@"):
            seen_email.add(email)
            rows.append(row)
    if rows:
        return rows
    return [attach_email(dict(base), org_index)]


def parse_clinicians_fixed(text: str, default_org: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out: list[dict] = []
    for i, line in enumerate(lines):
        nxt = lines[i + 1].lower() if i + 1 < len(lines) else ""
        if nxt not in CLINICIAN_TITLES:
            continue
        name = line
        if not is_real_person_name(name):
            continue
        title = lines[i + 1]
        org = lines[i + 2] if i + 2 < len(lines) and "priory" in lines[i + 2].lower() else default_org
        out.append({"name": name, "title": title, "org": org})
    return out


def org_email_index(pages_dir: Path) -> dict[str, str]:
    """Map normalized org name -> best site email from location pages."""
    idx: dict[str, str] = {}
    for d in pages_dir.iterdir():
        if not d.is_dir():
            continue
        emails_path = d / "emails.json"
        meta_path = d / "meta.json"
        txt_path = d / "page.txt"
        if not emails_path.exists() or not txt_path.exists():
            continue
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        url = meta.get("final_url") or ""
        if "/locations/" not in url:
            continue
        emails = load_json(emails_path)
        email = best_email(emails)
        if not email or is_generic_local(email) and "info@" in email:
            email = best_email([e for e in emails if "info@" not in e]) or email
        text = txt_path.read_text(encoding="utf-8", errors="ignore")
        org = text.split("\n", 1)[0].strip()
        org = re.sub(r"\s*-\s*Priory\s*$", "", org, flags=re.I)
        org = re.sub(r"\s*\|\s*.*$", "", org)
        for key in {norm(org), norm(org.replace("Priory Hospital ", "Priory Hospital,"))}:
            if key and email:
                idx[key] = email
    return idx


def attach_email(person: dict, org_index: dict[str, str], fallback: str = "") -> dict:
    org = person.get("org_name") or ""
    email = clean_email(person.get("email") or "")
    # Prefer site-specific inbox for this org over consultant-page shared email
    site_email = ""
    for candidate in (org, org.split(",")[0], org.replace(" in ", ", ")):
        site_email = org_index.get(norm(candidate), "")
        if site_email and not site_email.startswith("info@"):
            break
    if site_email:
        email = site_email
    elif not email:
        for candidate in (org, org.split(",")[0]):
            email = org_index.get(norm(candidate), "")
            if email:
                break
    if not email:
        email = fallback
    person["email"] = email
    return person


def load_api_clinicians(api_dir: Path, org_index: dict[str, str]) -> list[dict]:
    rows: list[dict] = []
    if not api_dir.exists():
        return rows
    for path in api_dir.glob("*.json"):
        if path.name.startswith("_"):
            continue
        for item in json.loads(path.read_text()):
            if not is_real_person_name(item.get("person_name", "")):
                continue
            row = attach_email(
                {
                    "person_name": item["person_name"],
                    "person_title": item.get("person_title") or "Consultant",
                    "org_name": item.get("org_name") or "Priory",
                    "source_url": item.get("source_url") or item.get("location_url") or "",
                    "website": "https://www.priorygroup.com",
                    "country": "United Kingdom",
                },
                org_index,
            )
            if row.get("email"):
                rows.append(row)
    return rows


def working_row_to_crm(row: dict, region: str = "uk") -> dict | None:
    email = clean_email(row.get("email", ""))
    if not email:
        return None
    person = (row.get("person_name") or row.get("contact_name") or "").strip()
    if person and not is_real_person_name(person):
        person = ""
    title = (row.get("person_title") or row.get("contact_title") or row.get("job_title") or "").strip()
    first, last = split_name(person) if person else ("", "")
    company = (row.get("org_name") or row.get("company") or "").strip()
    et = email_type_for(email, bool(person))
    if person and is_generic_local(email):
        et = "generic"
    return {
        "first_name": first,
        "last_name": last,
        "job_title": title,
        "company": company,
        "email": email,
        "email_type": et,
        "phone": (row.get("phone") or "").strip(),
        "website": (row.get("website") or "https://www.priorygroup.com").strip(),
        "address": (row.get("address") or "").strip(),
        "city": (row.get("city") or "").strip(),
        "region": region,
        "postcode": (row.get("postcode") or "").strip(),
        "country": (row.get("country") or "United Kingdom").strip(),
        "source_url": (row.get("source_url") or "").strip(),
        "notes": (row.get("notes") or "").strip(),
    }


def strict_dedupe(rows: list[dict]) -> list[dict]:
    """One row per person+company; collapse info@ duplicates per person."""
    by_key: dict[tuple, dict] = {}
    for r in rows:
        fn, ln = norm(r.get("first_name", "")), norm(r.get("last_name", ""))
        company = norm(r.get("company", ""))
        email = (r.get("email") or "").lower()
        if fn or ln:
            key = ("person", fn, ln, company)
        else:
            key = ("clinic", company, email)
        prev = by_key.get(key)
        if not prev:
            by_key[key] = r
            continue

        def score(x: dict) -> int:
            s = 0
            if x.get("job_title"):
                s += 2
            if x.get("email") and not x["email"].startswith("info@"):
                s += 1
            if x.get("phone"):
                s += 1
            return s

        if score(r) > score(prev):
            by_key[key] = r

    out: list[dict] = []
    seen_info: set[tuple[str, str]] = set()
    for r in by_key.values():
        fn, ln = norm(r.get("first_name", "")), norm(r.get("last_name", ""))
        email = (r.get("email") or "").lower()
        if (fn or ln) and email == "info@priorygroup.com":
            if (fn, ln) in seen_info:
                continue
            seen_info.add((fn, ln))
        out.append(r)
    return dedupe_crm(out)


def rebuild_uk_people(pages_dir: Path, org_index: dict[str, str], api_dir: Path) -> list[dict]:
    rows: list[dict] = []
    with_api = {p.stem for p in api_dir.glob("*.json") if not p.name.startswith("_")} if api_dir.exists() else set()

    for d in sorted(pages_dir.iterdir()):
        if not d.is_dir() or not (d / "page.txt").exists():
            continue
        text = (d / "page.txt").read_text(encoding="utf-8", errors="ignore")
        emails = load_json(d / "emails.json")
        phones = load_json(d / "phones.json")
        meta = json.loads((d / "meta.json").read_text()) if (d / "meta.json").exists() else {}
        if meta and not meta.get("ok"):
            continue
        url = meta.get("final_url") or meta.get("requested_url") or ""

        if "leadership-team" in url:
            for p in parse_leadership(text, url, emails):
                rows.append(attach_email({**p, "website": "https://www.priorygroup.com"}, org_index, best_email(emails)))
        elif "/consultants/" in url:
            for p in parse_consultant_multi(text, url, emails, phones, org_index):
                rows.append(p)
        elif "/locations/" in url and d.name not in with_api:
            org_row, _ = parse_location(text, url, emails, phones)
            org_name = org_row.get("org_name") or ""
            for c in parse_clinicians_fixed(text, org_name):
                rows.append(
                    attach_email(
                        {
                            "person_name": c["name"],
                            "person_title": c["title"],
                            "org_name": c["org"],
                            "phone": org_row.get("phone") or "",
                            "source_url": url,
                            "website": "https://www.priorygroup.com",
                            "country": "United Kingdom",
                        },
                        org_index,
                        org_row.get("email") or "",
                    )
                )
    return [r for r in rows if r.get("email")]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("outdir")
    p.add_argument("--scrape-api", action="store_true")
    p.add_argument("--refetch-failed", action="store_true")
    p.add_argument("--workers", type=int, default=8)
    args = p.parse_args()
    outdir = Path(args.outdir).expanduser().resolve()
    pages_dir = outdir / "pages"
    api_dir = outdir / "clinicians-api"
    csv_path = outdir / "csv" / "uk.csv"
    prior_count = 0
    if csv_path.exists():
        prior_count = sum(1 for _ in csv.DictReader(csv_path.open()))

    if args.scrape_api:
        subprocess.run(
            [str(PYTHON), str(SCRAPE_API), str(pages_dir), "--out", str(api_dir), "--workers", str(args.workers)],
            check=True,
        )

    if args.refetch_failed:
        failed_urls = []
        for meta_path in pages_dir.glob("**/meta.json"):
            m = json.loads(meta_path.read_text())
            if not m.get("ok"):
                failed_urls.append(m.get("requested_url") or m.get("final_url"))
        for url in failed_urls:
            if not url:
                continue
            slug = url.split("priorygroup.com", 1)[-1].strip("/").replace("/", "-")
            dest = pages_dir / f"refetch-{slug}"
            subprocess.run([str(PYTHON), str(FETCH), "--url", url, "--out", str(dest)], check=False)

    org_index = org_email_index(pages_dir)
    people_rows = load_api_clinicians(api_dir, org_index)
    people_rows.extend(rebuild_uk_people(pages_dir, org_index, api_dir))

    # org/clinic rows from parse_all
    parsed = parse_all(pages_dir)
    org_rows = parsed["uk_orgs"]

    crm_rows: list[dict] = []
    for row in people_rows + org_rows:
        cr = working_row_to_crm(row)
        if cr:
            crm_rows.append(cr)

    crm_rows = strict_dedupe(crm_rows)
    csv_dir = outdir / "csv"
    csv_dir.mkdir(parents=True, exist_ok=True)
    backup = csv_dir / "uk.csv.bak"
    if csv_path.exists():
        backup.write_bytes(csv_path.read_bytes())
    write_dicts(csv_path, CRM_HEADER, crm_rows)

    named = sum(1 for r in crm_rows if r.get("first_name") or r.get("last_name"))
    summary = {
        "prior_rows": prior_count,
        "new_rows": len(crm_rows),
        "added": len(crm_rows) - prior_count,
        "named": named,
        "clinic_only": len(crm_rows) - named,
        "unique_emails": len({r["email"].lower() for r in crm_rows if r.get("email")}),
    }
    (outdir / "ROUND2_SUMMARY.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
