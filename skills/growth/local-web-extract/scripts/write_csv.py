#!/usr/bin/env python3
"""Append one JSON object to a CSV. Drops emails not in emails.json."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

DEFAULT_FIELDS = [
    "source_url",
    "company_name",
    "description",
    "industry",
    "website",
    "email",
    "phone",
    "people",
    "notes",
]


def load_allowed_emails(page_dir: Path) -> set[str]:
    path = page_dir / "emails.json"
    if not path.exists():
        return set()
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return {str(e).lower() for e in data}
    return set()


def filter_emails(value: object, allowed: set[str]) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        parts = [str(v).strip() for v in value if str(v).strip()]
    else:
        parts = [p.strip() for p in str(value).replace(";", ",").split(",") if p.strip()]
    kept = [p for p in parts if p.lower() in allowed]
    return "; ".join(kept)


def flatten_people(value: object) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        bits = []
        for item in value:
            if isinstance(item, dict):
                name = str(item.get("name") or "").strip()
                title = str(item.get("title") or "").strip()
                bits.append(" — ".join(x for x in (name, title) if x))
            else:
                bits.append(str(item))
        return "; ".join(b for b in bits if b)
    return str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--page-dir", required=True, help="Dir with emails.json from fetch.py")
    parser.add_argument("--json", required=True, help="Path to extraction JSON from the agent")
    args = parser.parse_args()

    csv_path = Path(args.csv).expanduser().resolve()
    if "crush-crm" in csv_path.parts:
        print(f"REFUSED: will not write inside crush-crm ({csv_path})", file=sys.stderr)
        return 2
    page_dir = Path(args.page_dir).expanduser().resolve()
    payload = json.loads(Path(args.json).expanduser().read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        print("extraction JSON must be an object", file=sys.stderr)
        return 1

    allowed = load_allowed_emails(page_dir)
    row = {k: "" for k in DEFAULT_FIELDS}
    for key, val in payload.items():
        if key in {"email", "emails"}:
            row["email"] = filter_emails(val, allowed)
        elif key == "people":
            row["people"] = flatten_people(val)
        elif key in row:
            row[key] = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
        else:
            extra = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
            row["notes"] = (row["notes"] + " | " if row["notes"] else "") + f"{key}={extra}"

    meta_path = page_dir / "meta.json"
    if meta_path.exists() and not row["source_url"]:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        row["source_url"] = meta.get("final_url") or meta.get("requested_url") or ""

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    new_file = not csv_path.exists()
    with csv_path.open("a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=DEFAULT_FIELDS)
        if new_file:
            writer.writeheader()
        writer.writerow(row)
    print(str(csv_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
