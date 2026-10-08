#!/usr/bin/env python3
"""Fill blank emails on a working contacts CSV from a sidecar email-finds CSV.

Usage: merge_emails.py MAIN.csv SIDECAR.csv

Never overwrites a non-blank email. Matches all duplicate org rows.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    WORKING_HEADER,
    backup,
    clean_email,
    host,
    norm,
    org_of,
    read_dicts,
    write_dicts,
)


def keys_for(row: dict) -> set[tuple[str, str]]:
    org = norm(org_of(row))
    city = norm(row.get("city", ""))
    out: set[tuple[str, str]] = set()
    if org:
        out.add(("org", org))
        if city:
            out.add(("orgcity", f"{org}|{city}"))
    h = host(row.get("website", ""))
    if h:
        out.add(("host", h))
    return out


def index_sidecar(rows: list[dict]) -> list[tuple[set[tuple[str, str]], dict]]:
    indexed = []
    for row in rows:
        email = clean_email(row.get("email", ""))
        if not email:
            continue
        indexed.append((keys_for(row), {**row, "email": email}))
    return indexed


def pick_sidecar(main_keys: set[tuple[str, str]], sidecar: list) -> dict | None:
    for rank in ("orgcity", "host", "org"):
        for keys, row in sidecar:
            if any(k[0] == rank and k in main_keys for k in keys):
                return row
    return None


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: merge_emails.py MAIN.csv SIDECAR.csv", file=sys.stderr)
        return 2
    main_path = Path(sys.argv[1])
    side_path = Path(sys.argv[2])
    if not main_path.exists():
        print(f"Missing main: {main_path}", file=sys.stderr)
        return 1
    if not side_path.exists():
        print(f"Missing sidecar: {side_path}", file=sys.stderr)
        return 1

    with main_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        orig_fields = list(reader.fieldnames or WORKING_HEADER)
        mains = [{k: (v or "").strip() for k, v in row.items() if k is not None} for row in reader]
    sidecar = index_sidecar(read_dicts(side_path))
    filled = 0
    for row in mains:
        existing = clean_email(row.get("email", ""))
        if existing:
            row["email"] = existing
            continue
        hit = pick_sidecar(keys_for(row), sidecar)
        if not hit:
            continue
        row["email"] = hit["email"]
        if not (row.get("phone") or "").strip() and (hit.get("phone") or "").strip():
            row["phone"] = hit["phone"].strip()
        if not (row.get("website") or "").strip() and (hit.get("website") or "").strip():
            row["website"] = hit["website"].strip()
        extra = (hit.get("source_url") or "").strip()
        if extra and extra not in (row.get("source_url") or ""):
            src = (row.get("source_url") or "").strip()
            row["source_url"] = f"{src} {extra}".strip() if src else extra
        filled += 1

    b = backup(main_path)
    write_dicts(main_path, orig_fields, mains)
    print(
        f"Merged {filled} blank emails -> {main_path}"
        + (f" (backup {b.name})" if b else "")
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
