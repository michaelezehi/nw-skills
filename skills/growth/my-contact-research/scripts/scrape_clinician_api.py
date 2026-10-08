#!/usr/bin/env python3
"""Paginate Priory location clinician search API (public Umbraco endpoint).

Reads location page.html for data-page-id, fetches all result pages, writes JSON sidecars.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))

API = (
    "https://www.priorygroup.com/umbraco/surface/ClinicianResults/"
    "GetFilteredConsultantSearchBlock?currentPage={page}&name=&condition=&ageGroup=&type="
    "&pageSize={size}&pageId={pid}"
)

RESULT_RE = re.compile(
    r'href=(/consultants/[a-z0-9\-]+)[^>]*>.*?'
    r'>([^<]{2,80})</(?:div|span|h\d|p|a).*?'
    r'>([^<]{2,80})</(?:div|span|h\d|p|a).*?'
    r'>(Priory[^<]{2,120})</',
    re.I | re.S,
)


def curl_get(url: str) -> str:
    proc = subprocess.run(
        ["curl", "-fsSL", "-A", "my-contact-research/1.0", url],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if proc.returncode != 0:
        return ""
    return proc.stdout


def parse_results(html: str) -> list[dict]:
    out: list[dict] = []
    slugs = []
    seen_slugs: set[str] = set()
    for slug in re.findall(r"/consultants/[a-z0-9\-]+", html):
        if slug not in seen_slugs:
            seen_slugs.add(slug)
            slugs.append(slug)

    texts = [t.strip() for t in re.findall(r">([^<>]{2,100})<", html) if t.strip()]
    # API returns repeating triplets: Name, Title, Org per result
    i = 0
    slug_idx = 0
    while i < len(texts) - 2 and slug_idx < len(slugs):
        name, title, org = texts[i], texts[i + 1], texts[i + 2]
        if org.startswith("Priory") and "consultant" in title.lower() or "psychiatrist" in title.lower() or "psychologist" in title.lower() or "therapist" in title.lower():
            slug = slugs[slug_idx]
            slug_idx += 1
            out.append(
                {
                    "person_name": name,
                    "person_title": title,
                    "org_name": org,
                    "consultant_url": f"https://www.priorygroup.com{slug}",
                }
            )
            i += 3
            continue
        i += 1
    return out


def location_jobs(pages_dir: Path) -> list[dict]:
    jobs: list[dict] = []
    for d in sorted(pages_dir.iterdir()):
        if not d.is_dir():
            continue
        html_path = d / "page.html"
        meta_path = d / "meta.json"
        if not html_path.exists() or not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text())
        url = meta.get("final_url") or meta.get("requested_url") or ""
        if "/locations/" not in url:
            continue
        html = html_path.read_text(encoding="utf-8", errors="ignore")
        pid_m = re.search(r'data-page-id="(\d+)"', html)
        if not pid_m:
            continue
        size_m = re.search(r'data-page-size="(\d+)"', html)
        total_m = re.search(r'data-total-pages="(\d+)"', html)
        jobs.append(
            {
                "slug": d.name,
                "page_id": pid_m.group(1),
                "page_size": int(size_m.group(1)) if size_m else 4,
                "total_pages": int(total_m.group(1)) if total_m else 1,
                "location_url": url,
            }
        )
    return jobs


def scrape_location(job: dict, out_dir: Path) -> dict:
    dest = out_dir / f"{job['slug']}.json"
    if dest.exists():
        return {"slug": job["slug"], "skipped": True, "count": len(json.loads(dest.read_text()))}
    people: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for page in range(1, job["total_pages"] + 1):
        url = API.format(page=page, size=job["page_size"], pid=job["page_id"])
        html = curl_get(url)
        if not html:
            continue
        tp = re.search(r'data-results-total-pages=(\d+)', html)
        if tp:
            job["total_pages"] = max(job["total_pages"], int(tp.group(1)))
        for row in parse_results(html):
            key = (row["person_name"].lower(), row.get("org_name", "").lower())
            if key in seen:
                continue
            seen.add(key)
            row["location_url"] = job["location_url"]
            row["source_url"] = job["location_url"]
            people.append(row)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(people, indent=2) + "\n", encoding="utf-8")
    return {"slug": job["slug"], "skipped": False, "count": len(people)}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("pages_dir")
    p.add_argument("--out")
    p.add_argument("--workers", type=int, default=8)
    args = p.parse_args()
    pages_dir = Path(args.pages_dir).expanduser().resolve()
    out_dir = Path(args.out or pages_dir.parent / "clinicians-api").expanduser().resolve()
    jobs = location_jobs(pages_dir)
    print(f"clinician-api: {len(jobs)} locations")
    ok = skip = 0
    total = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(scrape_location, j, out_dir): j for j in jobs}
        for i, fut in enumerate(as_completed(futs), 1):
            res = fut.result()
            if res.get("skipped"):
                skip += 1
            else:
                ok += 1
            total += res.get("count", 0)
            if i % 10 == 0 or i == len(futs):
                print(f"  {i}/{len(futs)} scraped={ok} skip={skip} people={total}")
    summary = {"locations": len(jobs), "people": total, "out": str(out_dir)}
    (out_dir / "_summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
