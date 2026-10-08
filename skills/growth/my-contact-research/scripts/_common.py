"""Shared helpers for my-contact-research scripts."""
from __future__ import annotations

import csv
import re
from pathlib import Path
from urllib.parse import urlparse

WORKING_HEADER = [
    "org_name", "address", "city", "region", "postcode", "country", "website",
    "email", "phone", "contact_name", "contact_title", "source_url", "notes",
    "confidence",
]
EMAIL_FINDS_HEADER = [
    "org_name", "city", "website", "email", "contact_name", "contact_title",
    "phone", "source_url", "notes", "confidence",
]
PEOPLE_HEADER = [
    "org_name", "city", "person_name", "person_title", "email", "phone",
    "website", "source_url", "notes", "confidence",
]
CRM_HEADER = [
    "first_name", "last_name", "job_title", "company", "email", "email_type",
    "phone", "website", "address", "city", "region", "postcode", "country",
    "source_url", "notes",
]

ORG_ALIASES = ("org_name", "clinic_name", "organization", "company", "name")
PERSON_ALIASES = ("person_name", "contact_name", "full_name")
TITLE_ALIASES = ("person_title", "contact_title", "job_title", "title")

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
GENERIC_LOCAL = {
    "info", "hello", "contact", "enquiries", "enquiry", "inquiries", "inquiry",
    "admissions", "referrals", "referral", "admin", "office", "reception",
    "intake", "welcome", "mail", "kontakt", "segreteria", "team", "support",
    "help", "webmaster", "postmaster",
}
FAKE_EMAILS = {
    "john@doe.com", "jane@doe.com", "info@domainname.com", "email@domain.com",
    "name@email.com", "england.contactus@nhs.net", "named.inspector@rqia.org.uk",
}
FAKE_LOCAL = {
    "wordpress", "sample", "example", "test", "fake", "placeholder", "noreply",
    "no-reply", "donotreply", "yourname", "username", "email",
}
FAKE_DOMAINS = {
    "example.com", "example.org", "example.net", "domain.com", "domainname.com",
    "email.com", "test.com", "sentry.io", "wix.com", "sentry.wixpress.com",
}
HONORIFICS = {"dr", "mr", "mrs", "ms", "miss", "prof", "sir", "dame", "rev"}

KEEP_RE = re.compile(
    r"("
    r"\bceo\b|chief executive|chief medical|chief financial|chief operating|"
    r"chief clinical|chief people|chief quality|chief nurse|"
    r"\bcmo\b|\bcfo\b|\bcoo\b|general counsel|company secretary|"
    r"finance director|commercial finance|"
    r"founder|co-?founder|\bowner\b|proprietor|"
    r"\bpresiden(?:t|te|cia)\b|präsident|"
    r"managing director|executive director|clinical director|medical director|"
    r"admissions director|registered manager|nominated individuals?|"
    r"centre manager|center manager|clinic manager|"
    r"\bchair(?:man|woman|person)?\b|chair of|voorzitter|"
    r"chefarzt|chefärzt(?:in)?|leitender arzt|"
    r"ärztlich(?:e[rn]?)?\s+(?:leitung|leiter(?:in)?|direktor(?:in)?)|"
    r"medizinische leitung|verwaltungsdirektor|"
    r"geschäftsführer(?:in)?|vorstandsvorsitzende[rn]?|"
    r"daglig leder|styreleder|verkställande direktör|"
    r"direttore|directeur|directora|"
    r"ředitel(?:ka)?|výkonný ředitel|"
    r"general partner|managing partner|founding partner|investment partner|"
    r"headteacher|head teacher|\bprincipal\b|\bbursar\b|"
    r"\bdirectors?\b"
    r")",
    re.I,
)
BARE_DIRECTOR_RE = re.compile(r"^directors?$", re.I)
DROP_RE = re.compile(
    r"therapist|counsellor|counselor|nurs(?:e|ing)|coordinator|secretar|"
    r"keyworker|support worker|reception|team member|paralegal|"
    r"admissions team|admissions coordinator|classroom teacher|"
    r"\bir\b|comms|fund ops",
    re.I,
)


def norm(s: str) -> str:
    return " ".join((s or "").strip().split()).lower()


def first_present(row: dict, keys: tuple[str, ...]) -> str:
    for k in keys:
        v = (row.get(k) or "").strip()
        if v:
            return v
    return ""


def org_of(row: dict) -> str:
    return first_present(row, ORG_ALIASES)


def person_of(row: dict) -> str:
    return first_present(row, PERSON_ALIASES)


def title_of(row: dict) -> str:
    return first_present(row, TITLE_ALIASES)


def host(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u
    try:
        h = urlparse(u).netloc.lower()
    except Exception:
        return ""
    if h.startswith("www."):
        h = h[4:]
    return h


def is_generic_local(email: str) -> bool:
    local = (email or "").split("@")[0].lower()
    local = local.split("+")[0]
    return local in GENERIC_LOCAL or local.startswith("info-")


def is_fake_email(email: str) -> bool:
    el = (email or "").strip().lower()
    if not el:
        return False
    if el in FAKE_EMAILS:
        return True
    if not EMAIL_RE.match(el):
        return True
    if ".png" in el or "@2x" in el or "favicon" in el:
        return True
    local, _, domain = el.partition("@")
    local = local.split("+")[0]
    if local in FAKE_LOCAL:
        return True
    if domain in FAKE_DOMAINS:
        return True
    return False


def clean_email(email: str) -> str:
    el = (email or "").strip().lower()
    if not el or is_fake_email(el):
        return ""
    return el


def is_authority_title(title: str) -> bool:
    t = (title or "").strip()
    if not t:
        return False
    # Keep wins: "Director and Family Therapist / Co-founder" stays.
    if KEEP_RE.search(t) or BARE_DIRECTOR_RE.match(t):
        return True
    if DROP_RE.search(t):
        return False
    return False


def split_name(full: str) -> tuple[str, str]:
    parts = [p for p in (full or "").strip().split() if p]
    while parts and parts[0].rstrip(".").lower() in HONORIFICS:
        parts = parts[1:]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def email_type_for(email: str, has_person: bool) -> str:
    if not email:
        return ""
    if has_person and not is_generic_local(email):
        return "personal"
    return "generic"


def read_dicts(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return [{k: (v or "").strip() for k, v in row.items() if k is not None}
                for row in csv.DictReader(f)]


def write_dicts(path: Path, header: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({h: row.get(h, "") or "" for h in header})


def backup(path: Path) -> Path | None:
    if not path.exists():
        return None
    bak = path.with_suffix(path.suffix + ".bak")
    dest = bak if not bak.exists() else path.with_suffix(path.suffix + ".bak2")
    dest.write_bytes(path.read_bytes())
    return dest
