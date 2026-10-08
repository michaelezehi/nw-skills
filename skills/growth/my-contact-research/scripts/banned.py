"""Hard-ban profile surfaces. Same policy as Crush discovery."""
from __future__ import annotations

from urllib.parse import urlparse

BANNED_HOSTS = (
    "linkedin.com",
    "instagram.com",
    "tiktok.com",
    "vm.tiktok.com",
    "youtube.com",
    "youtu.be",
)

WARN_HOSTS = (
    "crunchbase.com",
    "clutch.co",
    "g2.com",
)


def _host(url: str) -> str:
    raw = url.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    host = urlparse(raw).hostname
    return host.lower().lstrip(".") if host else ""


def _match(host: str, names: tuple[str, ...]) -> str | None:
    for name in names:
        if host == name or host.endswith("." + name):
            return name
    return None


def banned_reason(url: str) -> str | None:
    host = _host(url)
    if not host:
        return "not a URL"
    hit = _match(host, BANNED_HOSTS)
    if hit:
        return f"banned host {host} (no LinkedIn / Instagram / TikTok / YouTube)"
    return None


def warn_reason(url: str) -> str | None:
    host = _host(url)
    hit = _match(host, WARN_HOSTS)
    if hit:
        return f"{host} ToS usually forbids scraping — skip unless you have a licence"
    return None
