"""Hard-ban profile surfaces Crush discovery also forbids."""
from __future__ import annotations

from urllib.parse import urlparse

# Entire hosts — not just /in/ — so a "company page" on LinkedIn still fails closed.
BANNED_HOSTS = (
    "linkedin.com",
    "www.linkedin.com",
    "instagram.com",
    "www.instagram.com",
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
)

# Directories whose ToS typically forbid scraping. Warn, do not fetch.
WARN_HOSTS = (
    "crunchbase.com",
    "www.crunchbase.com",
    "clutch.co",
    "www.clutch.co",
    "g2.com",
    "www.g2.com",
)


def _host(url: str) -> str:
    raw = url.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return urlparse(raw).hostname.lower().lstrip(".") if urlparse(raw).hostname else ""


def banned_reason(url: str) -> str | None:
    host = _host(url)
    if not host:
        return "not a URL"
    for banned in BANNED_HOSTS:
        if host == banned or host.endswith("." + banned):
            return f"banned host {host} (no LinkedIn / Instagram / TikTok / YouTube)"
    return None


def warn_reason(url: str) -> str | None:
    host = _host(url)
    for warned in WARN_HOSTS:
        if host == warned or host.endswith("." + warned):
            return f"{host} ToS usually forbids scraping — skip unless you have a licence"
    return None
