#!/usr/bin/env python3
"""Validate crm-import/*.csv. Exit 1 on blockers."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    CRM_HEADER,
    EMAIL_RE,
    clean_email,
    is_fake_email,
    is_generic_local,
    read_dicts,
)

VALID_TYPES = {"", "personal", "generic"}


def validate_file(path: Path) -> list[str]:
    errors: list[str] = []
    with path.open(encoding="utf-8", newline="") as f:
        import csv
        reader = csv.DictReader(f)
        if list(reader.fieldnames or []) != CRM_HEADER:
            return [f"{path.name}: bad header {reader.fieldnames}"]
    rows = read_dicts(path)
    seen: set[tuple[str, str]] = set()
    for i, row in enumerate(rows, start=2):
        loc = f"{path.name}:{i}"
        company = (row.get("company") or "").strip()
        if not company:
            errors.append(f"{loc}: missing company")
        email = (row.get("email") or "").strip()
        et = (row.get("email_type") or "").strip()
        if et not in VALID_TYPES:
            errors.append(f"{loc}: bad email_type '{et}'")
        if email:
            if is_fake_email(email) or not EMAIL_RE.match(email.lower()):
                errors.append(f"{loc}: fake/invalid email '{email}'")
            if et == "personal" and is_generic_local(email):
                errors.append(f"{loc}: generic inbox marked personal '{email}'")
            if et == "" and email:
                errors.append(f"{loc}: email present but email_type blank")
            first, last = row.get("first_name", ""), row.get("last_name", "")
            is_person = bool(first or last)
            # Personal inboxes unique per company. Generic fallback may repeat
            # across different named people. Clinic-only unique on email+company.
            if et == "personal" or not is_person:
                key = (email.lower(), company.lower(), "solo")
                if key in seen:
                    errors.append(f"{loc}: duplicate email+company {email} / {company}")
                seen.add(key)
            else:
                key = (
                    email.lower(),
                    company.lower(),
                    (first or "").lower(),
                    (last or "").lower(),
                )
                if key in seen:
                    errors.append(f"{loc}: duplicate person {first} {last} / {company}")
                seen.add(key)
        elif et:
            errors.append(f"{loc}: email_type '{et}' without email")
        first, last = row.get("first_name", ""), row.get("last_name", "")
        if not email and not (row.get("phone") or "").strip() and not (first or last):
            errors.append(f"{loc}: clinic-only row with no email and no phone")
        cleaned = clean_email(email)
        if email and not cleaned:
            errors.append(f"{loc}: email stripped by fake-email filter '{email}'")
    return errors


def summarize(path: Path) -> str:
    rows = read_dicts(path)
    emails = sum(1 for r in rows if r.get("email"))
    personal = sum(1 for r in rows if r.get("email_type") == "personal")
    generic = sum(1 for r in rows if r.get("email_type") == "generic")
    people = sum(1 for r in rows if r.get("first_name") or r.get("last_name"))
    return (
        f"{path.name}: {len(rows)} rows, {people} people, "
        f"{emails} emails (personal {personal} / generic {generic})"
    )


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: validate_crm.py crm-import-dir-or-file.csv", file=sys.stderr)
        return 2
    target = Path(sys.argv[1])
    files = [target] if target.is_file() else sorted(target.glob("*-crm-import.csv"))
    if not files:
        print(f"No CRM CSVs in {target}", file=sys.stderr)
        return 1
    errors: list[str] = []
    for f in files:
        errors.extend(validate_file(f))
        print(summarize(f))
    if errors:
        print("VALIDATION FAILED:")
        for e in errors[:40]:
            print(" ", e)
        if len(errors) > 40:
            print(f"  ... and {len(errors) - 40} more")
        return 1
    print(f"VALIDATION OK: {len(files)} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
