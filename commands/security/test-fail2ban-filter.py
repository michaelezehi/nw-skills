#!/usr/bin/env python3
"""Test the nginx-scanner fail2ban failregex against real log lines.

A fail2ban filter that silently matches nothing is worse than no filter: the
jail reports "running", bans nobody, and nobody notices. Worse still is one that
matches too much and bans a customer's SDK.

This extracts the failregex straight out of setup-nginx-fail2ban.sh (so the test
cannot drift from what actually gets installed), expands fail2ban's <HOST>
token, and asserts both directions against lines in this project's real
log_format from docker/nginx-gateway/nginx.conf.

Usage: python3 scripts/security/test-fail2ban-filter.py
Exit codes: 0 all pass - 1 assertion failed - 2 setup error
"""

import re
import sys
from pathlib import Path

SCRIPT = Path(__file__).with_name("setup-nginx-fail2ban.sh")

# log_format main: '$remote_addr - $remote_user [$time_local] "$request" '
#                  '$status $body_bytes_sent "$http_referer" '
#                  '"$http_user_agent" rt=$request_time uct="..." urt="..."'
RAW_LINE = (
    '203.0.113.9 - - [16/Aug/2026:21:00:00 +0000] "GET {path} HTTP/1.1" '
    '{status} 0 "-" "{ua}" rt=0.001 uct="-" urt="-"'
)

# fail2ban strips the matched timestamp out of the line BEFORE applying
# failregex, leaving empty brackets. This is the form the filter is really
# tested against in production, and testing only RAW_LINE hides a filter that
# matches nothing live — a jail that reports healthy and bans no one.
# Confirmed on the droplet 2026-08-16 via `fail2ban-regex`.
STRIPPED_LINE = (
    '203.0.113.9 - - [] "GET {path} HTTP/1.1" '
    '{status} 0 "-" "{ua}" rt=0.001 uct="-" urt="-"'
)

LINE_FORMS = {"raw": RAW_LINE, "date-stripped": STRIPPED_LINE}

SHOULD_BAN = [
    "/.env", "/.env.production", "/.git/config", "/.aws/credentials",
    "/.svn/entries", "/.htpasswd",
    "/wp-login.php", "/wp-admin/install.php", "/wp-includes/x.php",
    "/wp-json/wp/v2/users", "/xmlrpc.php", "/blog/wp-includes/wlwmanifest.xml",
    "/phpmyadmin/index.php", "/phpinfo.php", "/adminer.php",
    "/actuator/env", "/v2/actuator/health",
    "/_ignition/execute-solution",
    "/latest/meta-data/iam/security-credentials/",
    "/computeMetadata/v1/instance/service-accounts/",
    "/docker-compose.yml", "/Dockerfile", "/serverless.yml",
    "/terraform.tfstate", "/terraform.tfvars",
    "/.s3cfg", "/.boto", "/s3.yml",
    "/rest/credentials", "/rest/workflows",
    "/index.php", "/shell.sh", "/cgi-bin/test.cgi", "/backup.bak",
    "/admin.php?x=1",
]

SHOULD_NOT_BAN = [
    "/", "/api/health", "/api/ingest", "/api/ingest/debug-files",
    "/api/extension/download", "/api/internal/symbolicate",
    "/dashboard/settings", "/acme/projects/issues",
    "/_next/static/chunks/main-abc123.js", "/_next/image?url=%2Flogo.png",
    "/.well-known/acme-challenge/xyz123",
    "/favicon.ico", "/robots.txt", "/sitemap.xml",
    "/login", "/sign-in", "/settings/extension",
    "/api/webhooks/stripe",
]


def extract_failregex(text: str) -> str:
    m = re.search(
        r"filter\.d/nginx-scanner\.conf <<'FILTER'\n(.*?)\nFILTER",
        text, re.S,
    )
    if not m:
        print("ERROR: could not locate the FILTER heredoc in the setup script", file=sys.stderr)
        sys.exit(2)
    block = m.group(1)
    body = re.search(r"failregex\s*=\s*(.*?)(?=\nignoreregex)", block, re.S)
    if not body:
        print("ERROR: no failregex found in the FILTER heredoc", file=sys.stderr)
        sys.exit(2)
    # fail2ban continues a multi-line failregex on indented lines; each is an
    # independent alternative.
    return body.group(1)


def main() -> int:
    if not SCRIPT.exists():
        print(f"ERROR: {SCRIPT} not found", file=sys.stderr)
        return 2

    raw = extract_failregex(SCRIPT.read_text())
    patterns = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if not patterns:
        print("ERROR: failregex is empty", file=sys.stderr)
        return 2

    compiled = []
    for p in patterns:
        # fail2ban's <HOST> matches an IP or hostname and captures it.
        expanded = p.replace("<HOST>", r"(?:\[?(?P<host>[\w\-.:]+)\]?)")
        try:
            compiled.append(re.compile(expanded))
        except re.error as exc:
            print(f"ERROR: failregex does not compile: {exc}\n  {p}", file=sys.stderr)
            return 2

    def matches(tmpl: str, path: str, ua: str = "Mozilla/5.0", status: int = 444) -> bool:
        line = tmpl.format(path=path, ua=ua, status=status)
        return any(rx.search(line) for rx in compiled)

    failures = 0
    print(f"{len(compiled)} failregex alternative(s) compiled")

    # Every assertion runs against BOTH line forms. The date-stripped form is
    # what fail2ban actually matches; the raw form is what a human pastes into a
    # regex tester. A filter must handle both.
    for form, tmpl in LINE_FORMS.items():
        print(f"\n── {form} line ─────────────────────────────")

        print("Scanner paths must be banned")
        for path in SHOULD_BAN:
            if matches(tmpl, path):
                print(f"  ✔ {path}")
            else:
                print(f"  ✘ NOT MATCHED (would never ban): {path}")
                failures += 1

        print("\nLegitimate paths must never be banned")
        for path in SHOULD_NOT_BAN:
            if not matches(tmpl, path):
                print(f"  ✔ {path}")
            else:
                print(f"  ✘ FALSE POSITIVE (would ban real traffic): {path}")
                failures += 1

        print("\nHost capture")
        line = tmpl.format(path="/.env", ua="Mozilla/5.0", status=444)
        got = next((m.group("host") for rx in compiled if (m := rx.search(line))), None)
        if got == "203.0.113.9":
            print("  ✔ <HOST> captures the client IP")
        else:
            print(f"  ✘ <HOST> captured {got!r}, expected '203.0.113.9' — fail2ban would ban nothing")
            failures += 1

    if failures:
        print(f"\n✘ {failures} assertion(s) failed")
        return 1
    print("\n✔ All fail2ban filter assertions passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
