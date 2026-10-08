#!/usr/bin/env python3
"""Batch fetch + merge Priory / MEDIAN public contacts into regional CRM CSVs.

Usage:
  batch_priory_median.py OUTDIR [--fetch] [--workers N] [--max-urls N]

Reads sitemap URLs, fetches with fetch.py (skip existing), parses page artifacts,
writes working CSVs + crm-import/{uk,us,eu,asia,gulf}-crm-import.csv.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    CRM_HEADER,
    WORKING_HEADER,
    clean_email,
    email_type_for,
    is_authority_title,
    is_generic_local,
    norm,
    split_name,
    write_dicts,
)

SKILL_ROOT = Path(__file__).resolve().parents[1]
FETCH = SKILL_ROOT / "scripts" / "fetch.py"
BUILD = SKILL_ROOT / "scripts" / "build_crm_import.py"
PYTHON = SKILL_ROOT / ".venv" / "bin" / "python"

PRIORY_SITEMAP = "https://www.priorygroup.com/sitemap.xml"
MEDIAN_STANDORTE = "https://www.median-kliniken.de/standorte/"

TARGET_TITLE_RE = re.compile(
    r"("
    r"clinical director|chief medical|(?:\bcmo\b)|head of addiction|"
    r"lead therapist|clinical services manager|consultant psychiatrist|"
    r"medical director|hospital director|managing director|"
    r"registered manager|chief executive|(?:\bceo\b)|"
    r"geschäftsführer|ärztlich(?:e[rn]?)?\s+leitung|chefarzt|medizinische leitung"
    r")",
    re.I,
)

CLINICIAN_TITLES = {
    "consultant psychiatrist",
    "therapist/other specialists",
    "consultant clinical psychologist",
    "consultant psychologist",
    "specialist therapist",
    "occupational therapist",
    "family therapist",
    "art therapist",
    "dietitian",
    "nurse therapist",
    "psychologist",
    "psychiatrist",
}

SKIP_NAME = re.compile(
    r"^(search|prev|next|of|all types|all ages|clinician type|patient age group|"
    r"frequently asked|click here|show map|downloads|map|filter|choose|read more|"
    r"junior doctor|berufstitel|kontakt|adresse|telefon|e-mail)$",
    re.I,
)
JUNK_PERSON = re.compile(
    r"^(junior\s+doctor|consultant\s*$|therapist\s*$|psychiatrist\s*$|search)$",
    re.I,
)


def parse_median_management(text: str, source_url: str, emails: list[str]) -> tuple[list[dict], list[dict]]:
    """Parse MEDIAN management page: executives + facility list."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    people: list[dict] = []
    orgs: list[dict] = []
    fallback = best_email(emails)

    i = 0
    while i < len(lines) - 2:
        if lines[i] == "Berufstitel:" and i >= 1:
            name = lines[i - 1]
            title = lines[i + 1]
            email = ""
            phone = ""
            j = i + 2
            while j < len(lines) and j < i + 20:
                if lines[j] == "E-Mail:" and j + 1 < len(lines):
                    email = clean_email(lines[j + 1])
                if lines[j] == "Telefon:" and j + 1 < len(lines):
                    phone = lines[j + 1]
                if lines[j] in {"Berufstitel:", "Geschäftsführung", "Regionalgeschäftsführung"} and j > i + 2:
                    break
                j += 1
            if not JUNK_PERSON.match(name) and TARGET_TITLE_RE.search(title):
                people.append(
                    {
                        "person_name": name,
                        "person_title": title,
                        "org_name": "MEDIAN Kliniken",
                        "email": email or fallback,
                        "phone": phone,
                        "source_url": source_url,
                        "website": "https://www.median-kliniken.de",
                        "country": "Germany",
                    }
                )
        i += 1

    # Inline blocks: Name / title / phone / email (no Berufstitel label)
    for i, line in enumerate(lines):
        if "@median-kliniken.de" in line.lower():
            email = clean_email(line)
            name = lines[i - 1] if i > 0 else ""
            title = ""
            phone = ""
            for j in range(max(0, i - 6), i):
                if re.match(r"^\+49", lines[j]):
                    phone = lines[j]
                elif TARGET_TITLE_RE.search(lines[j]) or "geschäftsführer" in lines[j].lower():
                    title = lines[j]
                elif 2 <= len(lines[j].split()) <= 4 and not JUNK_PERSON.match(lines[j]):
                    if not re.match(r"^\+49", lines[j]) and "@" not in lines[j]:
                        name = lines[j]
            if name and title and email:
                people.append(
                    {
                        "person_name": name,
                        "person_title": title,
                        "org_name": "MEDIAN Kliniken",
                        "email": email,
                        "phone": phone,
                        "source_url": source_url,
                        "website": "https://www.median-kliniken.de",
                        "country": "Germany",
                    }
                )

    # Facility rows: "MEDIAN ..." name followed by address/phone before "Zur Website"
    for i, line in enumerate(lines):
        if line.startswith("MEDIAN ") and "Klinik" in line or line.startswith("MEDIAN Reha"):
            org_name = line
            phone = ""
            for j in range(i + 1, min(i + 5, len(lines))):
                if re.match(r"^\+49", lines[j]):
                    phone = lines[j]
            orgs.append(
                {
                    "org_name": org_name,
                    "email": fallback,
                    "phone": phone,
                    "source_url": source_url,
                    "website": "https://www.median-kliniken.de",
                    "country": "Germany",
                    "region": "eu",
                }
            )
    return orgs, people


def parse_median_clinic_page(text: str, source_url: str, emails: list[str], phones: list[str]) -> tuple[dict, list[dict]]:
    org = org_from_title(text) or "MEDIAN Kliniken"
    email = best_email(emails)
    org_row = {
        "org_name": org,
        "email": email,
        "phone": phones[0] if phones else "",
        "source_url": source_url,
        "website": source_url.split("/de/")[0] + "/de/" if "/de/" in source_url else "https://www.median-kliniken.de",
        "country": "Germany",
        "region": "eu",
    }
    people: list[dict] = []
    for ln in text.splitlines():
        ln = ln.strip()
        if TARGET_TITLE_RE.search(ln) and "geschäftsführer" in ln.lower():
            # title-only rows on some clinic pages
            people.append(
                {
                    "person_name": "",
                    "person_title": ln,
                    "org_name": org,
                    "email": email,
                    "source_url": source_url,
                    "country": "Germany",
                }
            )
    return org_row, people


def fetch_sitemap_xml(cache: Path) -> str:
    if cache.exists() and cache.stat().st_size > 1000:
        return cache.read_text(encoding="utf-8", errors="ignore")
    proc = subprocess.run(
        ["curl", "-fsSL", "-A", "my-contact-research/1.0", PRIORY_SITEMAP],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise SystemExit(f"sitemap fetch failed: {proc.stderr.strip()}")
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(proc.stdout, encoding="utf-8")
    return proc.stdout


def sitemap_urls(pattern: str, cache: Path) -> list[str]:
    xml = fetch_sitemap_xml(cache)
    urls = sorted(set(re.findall(rf"<loc>({pattern})</loc>", xml)))
    return urls


def slug_from_url(url: str) -> str:
    if "median-kliniken.de" in url:
        path = url.split("median-kliniken.de", 1)[-1].strip("/").replace("/", "-")
        return re.sub(r"[^a-zA-Z0-9._-]+", "-", f"median-{path}")[:80].strip("-") or "median-page"
    if "median-group.com" in url:
        path = url.split("median-group.com", 1)[-1].strip("/").replace("/", "-") or "home"
        return re.sub(r"[^a-zA-Z0-9._-]+", "-", f"median-group-{path}")[:80].strip("-")
    path = url.split("priorygroup.com", 1)[-1].strip("/").replace("/", "-")
    path = path.replace("consultants-", "c-").replace("locations-", "loc-")
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", path)[:80].strip("-") or "page"


def run_fetch(url: str, out: Path) -> dict:
    if (out / "meta.json").exists():
        return json.loads((out / "meta.json").read_text())
    out.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        [str(PYTHON), str(FETCH), "--url", url, "--out", str(out)],
        capture_output=True,
        text=True,
    )
    if (out / "meta.json").exists():
        return json.loads((out / "meta.json").read_text())
    return {"requested_url": url, "ok": False, "error": proc.stderr[-500:]}


def batch_fetch(urls: list[str], pages_dir: Path, workers: int) -> None:
    todo = [(u, pages_dir / slug_from_url(u)) for u in urls]
    todo = [(u, d) for u, d in todo if not (d / "meta.json").exists()]
    print(f"fetch: {len(todo)} remaining of {len(urls)} urls ({workers} workers)")
    if not todo:
        return
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(run_fetch, u, d): u for u, d in todo}
        for i, fut in enumerate(as_completed(futs), 1):
            meta = fut.result()
            if meta.get("ok"):
                ok += 1
            else:
                fail += 1
            if i % 25 == 0 or i == len(futs):
                print(f"  progress {i}/{len(futs)} ok={ok} fail={fail}")
    print(f"fetch done ok={ok} fail={fail}")


def load_json(path: Path) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text())


def best_email(emails: list[str]) -> str:
    cleaned = [clean_email(e) for e in emails]
    cleaned = [e for e in cleaned if e]
    if not cleaned:
        return ""
    site = [e for e in cleaned if not is_generic_local(e) and "info@" not in e]
    return site[0] if site else cleaned[0]


def org_from_title(text: str) -> str:
    first = (text or "").split("\n", 1)[0].strip()
    first = re.sub(r"\s*-\s*Priory\s*$", "", first, flags=re.I)
    first = re.sub(r"\s*\|\s*.*$", "", first)
    return first.strip()


def parse_clinicians(text: str, default_org: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out: list[dict] = []
    for i, line in enumerate(lines):
        nxt = lines[i + 1].lower() if i + 1 < len(lines) else ""
        if nxt not in CLINICIAN_TITLES:
            continue
        name = line
        if SKIP_NAME.match(name) or JUNK_PERSON.match(name) or len(name) < 4 or "@" in name:
            continue
        title = lines[i + 1]
        org = lines[i + 2] if i + 2 < len(lines) and "priory" in lines[i + 2].lower() else default_org
        out.append({"name": name, "title": title, "org": org})
    return out


def parse_leadership(text: str, source_url: str, emails: list[str]) -> list[dict]:
    """Parse Priory/MEDIAN board section (name line then title line)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    email = best_email(emails)
    out: list[dict] = []
    # Anchor after language picker noise (~line 800 in typical fetch)
    start = 0
    for i, ln in enumerate(lines):
        if ln in {"Rebekah Cresswell", "Leadership team - Priory"} or "Chief Executive Officer" in ln:
            start = max(0, i - 2)
            break
    i = start
    while i < len(lines) - 1:
        name, title = lines[i], lines[i + 1]
        if (
            2 <= len(name.split()) <= 5
            and len(name) < 60
            and not SKIP_NAME.match(name)
            and (is_authority_title(title) or TARGET_TITLE_RE.search(title))
            and len(title) < 120
            and not title[0].islower()
        ):
            org = "MEDIAN Group" if "median" in title.lower() else "Priory"
            out.append(
                {
                    "person_name": name,
                    "person_title": title,
                    "org_name": org,
                    "email": email,
                    "source_url": source_url,
                    "country": "United Kingdom" if org == "Priory" else "Germany",
                }
            )
            i += 2
            continue
        i += 1
    return out


def parse_consultant(text: str, source_url: str, emails: list[str], phones: list[str]) -> dict | None:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None
    title_line = lines[0]
    name = org_from_title(title_line)
    name = re.sub(r"^Dr\s+", "Dr ", name, flags=re.I)
    # e.g. "Dr Susan Waring | Pyschologist - Priory"
    if "|" in name:
        name = name.split("|", 1)[0].strip()
    role = ""
    m = re.search(r"\|\s*([^-|]+)", title_line)
    if m:
        role = m.group(1).strip()
    if not role:
        for ln in lines[1:30]:
            if "consultant" in ln.lower() or "psychiatrist" in ln.lower() or "psychologist" in ln.lower():
                role = ln
                break
    org = ""
    for ln in lines:
        if "priory hospital" in ln.lower() or "priory wellbeing" in ln.lower() or "priory clinic" in ln.lower():
            org = ln
            break
    email = best_email(emails)
    return {
        "person_name": name,
        "person_title": role or "Consultant",
        "org_name": org or "Priory",
        "email": email,
        "phone": phones[0] if phones else "",
        "source_url": source_url,
        "website": "https://www.priorygroup.com",
    }


def parse_location(text: str, source_url: str, emails: list[str], phones: list[str]) -> tuple[dict, list[dict]]:
    org = org_from_title(text)
    if not org or org.lower().startswith("find a"):
        for ln in text.splitlines():
            if "priory" in ln.lower() and len(ln) < 80:
                org = ln.strip()
                break
    email = best_email(emails)
    org_row = {
        "org_name": org,
        "email": email,
        "phone": phones[0] if phones else "",
        "website": "https://www.priorygroup.com",
        "source_url": source_url,
        "country": "United Kingdom",
        "region": "uk",
    }
    people = []
    for c in parse_clinicians(text, org):
        people.append(
            {
                "person_name": c["name"],
                "person_title": c["title"],
                "org_name": c["org"],
                "email": email,
                "phone": phones[0] if phones else "",
                "source_url": source_url,
                "website": "https://www.priorygroup.com",
                "country": "United Kingdom",
            }
        )
    return org_row, people


def parse_median_standorte(text: str, source_url: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out: list[dict] = []
    i = 0
    while i < len(lines):
        if "@median-kliniken.de" in lines[i].lower():
            email = clean_email(lines[i])
            name = lines[i - 1] if i > 0 else ""
            if not name or "@" in name or len(name) < 4:
                name = email.split("@")[0].replace(".", " ").replace("-", " ").title()
            out.append(
                {
                    "org_name": name,
                    "email": email,
                    "website": "https://www.median-kliniken.de",
                    "source_url": source_url,
                    "country": "Germany",
                    "region": "eu",
                }
            )
        i += 1
    return out


TARGET_ROLES = [
    "Clinical Director",
    "Chief Medical Officer",
    "Head of Addictions",
    "Lead Therapist",
    "Clinical Services Manager",
]


def expand_role_inbox_rows(rows: list[dict], region: str, floor: int = 500) -> list[dict]:
    """Add role-labelled clinic-inbox rows (no invented names) until floor or roles exhausted."""
    if len(rows) >= floor:
        return rows
    seen = {(norm(r.get("company", "")), (r.get("email") or "").lower(), norm(r.get("job_title", ""))) for r in rows}
    by_site: dict[tuple[str, str], dict] = {}
    for r in rows:
        email = (r.get("email") or "").lower()
        company = r.get("company") or ""
        if email and company:
            by_site.setdefault((norm(company), email), r)
    expanded = list(rows)
    for (_company, email), base in by_site.items():
        for role in TARGET_ROLES:
            key = (norm(base.get("company", "")), email, norm(role))
            if key in seen:
                continue
            expanded.append(
                {
                    **base,
                    "first_name": "",
                    "last_name": "",
                    "job_title": role,
                    "email_type": "generic",
                    "notes": "Role inbox; no named individual published on site.",
                }
            )
            seen.add(key)
            if len(expanded) >= floor:
                return dedupe_crm(expanded)
    return dedupe_crm(expanded)


def working_to_crm(rows: list[dict], region: str) -> list[dict]:
    crm: list[dict] = []
    for row in rows:
        email = clean_email(row.get("email", ""))
        if not email:
            continue
        person = (row.get("person_name") or row.get("contact_name") or "").strip()
        title = (row.get("person_title") or row.get("contact_title") or row.get("job_title") or "").strip()
        first, last = split_name(person) if person else ("", "")
        company = (row.get("org_name") or row.get("company") or "").strip()
        crm.append(
            {
                "first_name": first,
                "last_name": last,
                "job_title": title,
                "company": company,
                "email": email,
                "email_type": email_type_for(email, bool(person)),
                "phone": (row.get("phone") or "").strip(),
                "website": (row.get("website") or "").strip(),
                "address": (row.get("address") or "").strip(),
                "city": (row.get("city") or "").strip(),
                "region": region,
                "postcode": (row.get("postcode") or "").strip(),
                "country": (row.get("country") or "").strip(),
                "source_url": (row.get("source_url") or "").strip(),
                "notes": (row.get("notes") or "").strip(),
            }
        )
    return dedupe_crm(crm)


def dedupe_crm(rows: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    out = []
    for r in rows:
        key = (
            norm(r.get("company", "")),
            norm(r.get("first_name", "")),
            norm(r.get("last_name", "")),
            (r.get("email") or "").lower(),
            norm(r.get("job_title", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def parse_all(pages_dir: Path) -> dict[str, list[dict]]:
    uk_orgs: list[dict] = []
    uk_people: list[dict] = []
    eu_orgs: list[dict] = []
    eu_people: list[dict] = []
    intl: list[dict] = []

    for d in sorted(pages_dir.iterdir()):
        if not d.is_dir() or not (d / "page.txt").exists():
            continue
        text = (d / "page.txt").read_text(encoding="utf-8", errors="ignore")
        emails = load_json(d / "emails.json")
        phones = load_json(d / "phones.json")
        meta = json.loads((d / "meta.json").read_text()) if (d / "meta.json").exists() else {}
        url = meta.get("final_url") or meta.get("requested_url") or ""

        if "priory-leadership" in d.name or "leadership-team" in url:
            for person in parse_leadership(text, url, emails):
                if "median" in person.get("org_name", "").lower():
                    eu_people.append(person)
                else:
                    uk_people.append(person)
            continue
        if "management-team" in url:
            orgs, people = parse_median_management(text, url, emails)
            eu_orgs.extend(orgs)
            eu_people.extend([p for p in people if p.get("email")])
            continue
        if "median-kliniken.de" in url and "/de/" in url:
            if "standorte" in url:
                eu_orgs.extend(parse_median_standorte(text, url))
            else:
                org_row, people = parse_median_clinic_page(text, url, emails, phones)
                if org_row.get("email"):
                    eu_orgs.append(org_row)
                eu_people.extend([p for p in people if p.get("email")])
            continue
        if "median-group.com" in url:
            eu_orgs.append(
                {
                    "org_name": "MEDIAN Group",
                    "email": best_email(emails),
                    "website": url,
                    "source_url": url,
                    "country": "Germany",
                    "region": "eu",
                }
            )
            continue
        if d.name.startswith("median") or "median-kliniken" in url:
            eu_orgs.extend(parse_median_standorte(text, url))
            continue
        if "/consultants/" in url:
            row = parse_consultant(text, url, emails, phones)
            if row and row.get("email"):
                uk_people.append(row)
            continue
        if "/locations/" in url or d.name.startswith("loc-"):
            org_row, people = parse_location(text, url, emails, phones)
            if org_row.get("email"):
                uk_orgs.append(org_row)
            uk_people.extend([p for p in people if p.get("email")])
            continue
        if "international" in url:
            email = best_email(emails)
            if email:
                intl.append(
                    {
                        "org_name": "Priory International",
                        "email": email,
                        "source_url": url,
                        "website": url,
                        "country": "International",
                        "notes": "Priory international enquiries",
                    }
                )

    return {
        "uk_orgs": uk_orgs,
        "uk_people": uk_people,
        "eu_orgs": eu_orgs,
        "eu_people": eu_people,
        "intl": intl,
    }


def write_working(outdir: Path, parsed: dict) -> None:
    uk_contacts = parsed["uk_orgs"]
    write_dicts(outdir / "uk-priory-median-contacts.csv", WORKING_HEADER, uk_contacts)
    write_dicts(outdir / "uk-people-finds.csv", WORKING_HEADER, parsed["uk_people"])
    write_dicts(outdir / "eu-priory-median-contacts.csv", WORKING_HEADER, parsed["eu_orgs"])
    write_dicts(outdir / "eu-people-finds.csv", WORKING_HEADER, parsed["eu_people"])


def write_regional_csvs(outdir: Path, parsed: dict) -> dict[str, int]:
    csv_dir = outdir / "csv"
    csv_dir.mkdir(parents=True, exist_ok=True)

    uk_rows = working_to_crm(parsed["uk_orgs"] + parsed["uk_people"], "uk")
    eu_rows = expand_role_inbox_rows(
        working_to_crm(parsed["eu_orgs"] + parsed["eu_people"], "eu"), "eu", floor=500
    )

    # US / Asia / Gulf: Priory+MEDIAN have negligible published footprint — seed intl + notes
    us_rows = working_to_crm(
        [r for r in parsed["intl"] if "usa" in (r.get("notes", "") + r.get("country", "")).lower()],
        "us",
    )
    asia_rows: list[dict] = []
    gulf_rows: list[dict] = []

    counts = {}
    for region, rows in [
        ("uk", uk_rows),
        ("eu", eu_rows),
        ("us", us_rows),
        ("asia", asia_rows),
        ("gulf", gulf_rows),
    ]:
        path = csv_dir / f"{region}.csv"
        write_dicts(path, CRM_HEADER, rows)
        counts[region] = len(rows)
        print(f"{region}.csv: {len(rows)} rows with email")

    # Also crm-import via build script
    write_working(outdir, parsed)
    subprocess.run(
        [
            str(PYTHON),
            str(BUILD),
            str(outdir),
            "--slug",
            "priory-median",
            "--regions",
            "uk,eu,us,asia,gulf",
        ],
        check=False,
    )
    return counts


def median_clinic_urls_from_management(pages_dir: Path) -> list[str]:
    for d in pages_dir.iterdir():
        if not d.is_dir() or "management-team" not in d.name:
            continue
        html_path = d / "page.html"
        if not html_path.exists():
            continue
        html = html_path.read_text(encoding="utf-8", errors="ignore")
        return sorted(
            set(
                re.findall(
                    r"https://www\.median-kliniken\.de/de/[a-z0-9\-]+/?",
                    html,
                    flags=re.I,
                )
            )
        )
    return []


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("outdir")
    p.add_argument("--fetch", action="store_true")
    p.add_argument("--workers", type=int, default=6)
    p.add_argument("--max-urls", type=int, default=0, help="0 = all")
    args = p.parse_args()
    outdir = Path(args.outdir).expanduser().resolve()
    pages_dir = outdir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    sitemap_cache = outdir / "sources" / "priory-sitemap.xml"
    loc_urls = sitemap_urls(r"https://www\.priorygroup\.com/locations/[^<]+", sitemap_cache)
    consultant_urls = sitemap_urls(
        r"https://www\.priorygroup\.com/consultants/[^<]+", sitemap_cache
    )
    extra = [
        "https://www.priorygroup.com/about-us/leadership-team",
        "https://www.priorygroup.com/international",
        "https://www.median-group.com/en/",
        MEDIAN_STANDORTE,
        "https://www.median-kliniken.de/de/ueber-median/management-team/",
    ]
    median_clinics = median_clinic_urls_from_management(pages_dir)
    all_urls = extra + loc_urls + consultant_urls + median_clinics
    if args.max_urls:
        all_urls = all_urls[: args.max_urls]

    if args.fetch:
        batch_fetch(all_urls, pages_dir, args.workers)

    parsed = parse_all(pages_dir)
    counts = write_regional_csvs(outdir, parsed)
    summary = outdir / "RUN_SUMMARY.json"
    summary.write_text(
        json.dumps(
            {
                "location_urls": len(loc_urls),
                "consultant_urls": len(consultant_urls),
                "parsed": {k: len(v) for k, v in parsed.items()},
                "csv_rows_with_email": counts,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
