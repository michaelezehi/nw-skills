#!/usr/bin/env python3
"""Fetch one public URL locally. Write html/text/emails/phones. Never guess emails.

ScrapeGraph flow, local arm: FetchNode equivalent. The agent is GenerateAnswerNode.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clean_email  # noqa: E402
from banned import banned_reason, warn_reason  # noqa: E402

SKILL_ROOT = Path(__file__).resolve().parents[1]
PHONE_RE = re.compile(
    r"(?:\+44\s?\(?0?\)?|0)(?:\s?\d){9,10}"
)


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self._skip:
            self._skip -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip:
            text = data.strip()
            if text:
                self.parts.append(text)


def slug_for(url: str) -> str:
    p = urlparse(url if "://" in url else "https://" + url)
    host = (p.hostname or "page").replace("www.", "")
    path = (p.path or "/").strip("/").replace("/", "-")[:60] or "home"
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", f"{host}-{path}").strip("-")[:80]


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)
    return "\n".join(parser.parts)


def published_emails(blob: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for match in re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", blob or ""):
        email = clean_email(match.strip(".,;:()<>[]"))
        if email and email not in seen:
            seen.add(email)
            found.append(email)
    return found


def published_phones(blob: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for match in PHONE_RE.findall(blob or ""):
        phone = re.sub(r"\s+", " ", match).strip()
        key = re.sub(r"\D", "", phone)
        if len(key) < 10 or key in seen:
            continue
        seen.add(key)
        found.append(phone)
    return found[:12]


def fetch_with_playwright(url: str, timeout_ms: int) -> tuple[int, str, str]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Playwright missing. Run: bash ~/.claude/skills/my-contact-research/setup.sh"
        ) from exc

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        response = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        try:
            page.wait_for_load_state("networkidle", timeout=min(timeout_ms, 15_000))
        except Exception:
            pass
        status = response.status if response is not None else 0
        final_url = page.url
        html = page.content()
        browser.close()
    return status, final_url, html


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout-ms", type=int, default=30_000)
    parser.add_argument("--allow-warn", action="store_true")
    args = parser.parse_args()

    url = args.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    reason = banned_reason(url)
    if reason:
        print(f"REFUSED: {reason}", file=sys.stderr)
        return 2
    warning = warn_reason(url)
    if warning and not args.allow_warn:
        print(f"REFUSED: {warning} (pass --allow-warn to override)", file=sys.stderr)
        return 2

    out = Path(args.out).expanduser().resolve()
    if "crush-crm" in out.parts:
        print(f"REFUSED: will not write inside crush-crm ({out})", file=sys.stderr)
        return 2

    out.mkdir(parents=True, exist_ok=True)
    status, final_url, html = fetch_with_playwright(url, args.timeout_ms)
    text = html_to_text(html)
    blob = html + "\n" + text
    emails = published_emails(blob)
    phones = published_phones(blob)

    (out / "page.html").write_text(html, encoding="utf-8")
    (out / "page.txt").write_text(text, encoding="utf-8")
    (out / "emails.json").write_text(json.dumps(emails, indent=2) + "\n", encoding="utf-8")
    (out / "phones.json").write_text(json.dumps(phones, indent=2) + "\n", encoding="utf-8")
    meta = {
        "requested_url": url,
        "final_url": final_url,
        "status": status,
        "ok": 200 <= status < 400,
        "email_count": len(emails),
        "phone_count": len(phones),
        "text_chars": len(text),
        "warning": warning,
        "skill": str(SKILL_ROOT),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta))
    if not meta["ok"]:
        print(f"FETCH NOT OK: HTTP {status}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
