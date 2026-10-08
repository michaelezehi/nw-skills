#!/usr/bin/env python3
"""Fetch one public URL locally. Write html/text/emails. Never guess emails."""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from banned import banned_reason, warn_reason  # noqa: E402

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)
FAKE_LOCAL = {
    "wordpress", "sample", "example", "test", "fake", "placeholder",
    "noreply", "no-reply", "donotreply", "yourname", "username", "email",
    "sentry", "wix",
}
FAKE_DOMAINS = {
    "example.com", "example.org", "example.net", "domain.com",
    "domainname.com", "email.com", "test.com", "sentry.io",
}

SKILL_ROOT = Path(__file__).resolve().parents[1]


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
        if self._skip:
            return
        text = data.strip()
        if text:
            self.parts.append(text)


def slug_for(url: str) -> str:
    p = urlparse(url if "://" in url else "https://" + url)
    host = (p.hostname or "page").replace("www.", "")
    path = (p.path or "/").strip("/").replace("/", "-")[:60] or "home"
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", f"{host}-{path}").strip("-")[:80]


def published_emails(blob: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for match in EMAIL_RE.findall(blob or ""):
        email = match.strip(".,;:()<>[]").lower()
        local, _, domain = email.partition("@")
        if not domain or local in FAKE_LOCAL or domain in FAKE_DOMAINS:
            continue
        if email not in seen:
            seen.add(email)
            found.append(email)
    return found


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)
    return "\n".join(parser.parts)


def fetch_with_playwright(url: str, timeout_ms: int) -> tuple[int, str, str]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Playwright is not installed. From the skill dir run:\n"
            "  bash setup.sh\n"
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
    parser.add_argument("--out", required=True, help="Directory to write page artifacts")
    parser.add_argument("--timeout-ms", type=int, default=30_000)
    parser.add_argument("--allow-warn", action="store_true",
                        help="Fetch ToS-warn hosts (Crunchbase/Clutch/G2) anyway")
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
    emails = published_emails(html + "\n" + text)

    (out / "page.html").write_text(html, encoding="utf-8")
    (out / "page.txt").write_text(text, encoding="utf-8")
    (out / "emails.json").write_text(
        json.dumps(emails, indent=2) + "\n", encoding="utf-8"
    )
    meta = {
        "requested_url": url,
        "final_url": final_url,
        "status": status,
        "ok": 200 <= status < 400,
        "email_count": len(emails),
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
