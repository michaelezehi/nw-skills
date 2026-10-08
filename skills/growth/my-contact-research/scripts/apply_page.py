#!/usr/bin/env python3
"""Append fetch artifacts to email-finds / people-finds. Drops unpublished emails.

Usage:
  apply_page.py --page-dir DIR --org NAME [--city CITY] [--website URL] \\
    --email-csv PATH [--people-csv PATH] [--extract extract.json]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    EMAIL_FINDS_HEADER,
    PEOPLE_HEADER,
    clean_email,
    is_authority_title,
)


def load_json_list(path: Path) -> list[str]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [str(x).strip() for x in data if str(x).strip()]
    return []


def append_csv(path: Path, header: list[str], row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    with path.open("a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
        if new:
            writer.writeheader()
        writer.writerow({h: row.get(h, "") or "" for h in header})


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--page-dir", required=True)
    p.add_argument("--org", required=True)
    p.add_argument("--city", default="")
    p.add_argument("--website", default="")
    p.add_argument("--email-csv", required=True)
    p.add_argument("--people-csv", default="")
    p.add_argument("--extract", default="", help="Agent JSON: people[], optional phone")
    args = p.parse_args()

    page = Path(args.page_dir).expanduser().resolve()
    meta = json.loads((page / "meta.json").read_text(encoding="utf-8")) if (page / "meta.json").exists() else {}
    if not meta.get("ok", False):
        print("skip: page not ok", file=sys.stderr)
        return 1
    source = meta.get("final_url") or meta.get("requested_url") or ""
    allowed = {e.lower() for e in load_json_list(page / "emails.json")}
    phones = load_json_list(page / "phones.json")
    phone = phones[0] if phones else ""

    extract: dict = {}
    if args.extract:
        extract = json.loads(Path(args.extract).expanduser().read_text(encoding="utf-8"))
        if not isinstance(extract, dict):
            print("extract JSON must be an object", file=sys.stderr)
            return 1
        if extract.get("phone"):
            phone = str(extract["phone"]).strip() or phone

    email_csv = Path(args.email_csv).expanduser().resolve()
    if "crush-crm" in email_csv.parts:
        print(f"REFUSED: crush-crm path {email_csv}", file=sys.stderr)
        return 2

    for email in sorted(allowed):
        append_csv(email_csv, EMAIL_FINDS_HEADER, {
            "org_name": args.org,
            "city": args.city,
            "website": args.website,
            "email": email,
            "contact_name": "",
            "contact_title": "",
            "phone": phone,
            "source_url": source,
            "notes": "published on fetched page",
            "confidence": "high",
        })

    people_csv = Path(args.people_csv).expanduser().resolve() if args.people_csv else None
    people = extract.get("people") if extract else None
    if people_csv and isinstance(people, list):
        if "crush-crm" in people_csv.parts:
            print(f"REFUSED: crush-crm path {people_csv}", file=sys.stderr)
            return 2
        for item in people:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            title = str(item.get("title") or "").strip()
            if not name or not title:
                continue
            if not is_authority_title(title):
                continue
            person_email = clean_email(str(item.get("email") or ""))
            if person_email and person_email not in allowed:
                person_email = ""
            append_csv(people_csv, PEOPLE_HEADER, {
                "org_name": args.org,
                "city": args.city,
                "person_name": name,
                "person_title": title,
                "email": person_email,
                "phone": str(item.get("phone") or phone).strip(),
                "website": args.website,
                "source_url": source,
                "notes": "" if person_email else "personal email not on page",
                "confidence": "high" if name and title else "low",
            })
    print(json.dumps({"emails": len(allowed), "source_url": source}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
