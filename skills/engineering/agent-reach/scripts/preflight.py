#!/usr/bin/env python3
"""Check which accounts a data-gathering run needs before it starts.

    preflight.py [--open] <platform-or-url> ...
    preflight.py --open x linkedin https://www.instagram.com/reel/abc/
    preflight.py --all            # every platform that has a login

Runs `agent-reach check` on each platform (3 to 7 s each, in parallel) and
prints which are ready and which need the user to log in. With --open it also
opens the one AgentReach login window, and the user signs in to every
platform that needs it there, one tab per site.

Exit code: 0 all ready, 2 some need a login, 1 something else failed.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

AGENT_REACH = os.path.expanduser("~/.local/bin/agent-reach")

# Platforms that have a login, in the order we ask for them.
LOGIN_CHANNELS = ["twitter", "linkedin", "instagram", "facebook"]
LABELS = {"twitter": "X", "linkedin": "LinkedIn", "instagram": "Instagram",
          "facebook": "Facebook"}
LOGIN_URLS = {"twitter": "https://x.com/login",
              "linkedin": "https://www.linkedin.com/login",
              "instagram": "https://www.instagram.com/accounts/login/",
              "facebook": "https://www.facebook.com/login"}
ALIASES = {
    "x": "twitter", "twitter": "twitter", "x.com": "twitter", "twitter.com": "twitter",
    "linkedin": "linkedin", "linkedin.com": "linkedin", "lnkd.in": "linkedin",
    "instagram": "instagram", "ig": "instagram", "instagram.com": "instagram",
    "facebook": "facebook", "fb": "facebook", "facebook.com": "facebook", "fb.watch": "facebook",
}


def to_channel(arg):
    """Map a platform name or URL to a channel; None when it needs no login."""
    a = arg.lower().strip()
    if "://" in a:
        a = a.split("://", 1)[1]
    host = a.split("/", 1)[0].split(":", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    for key in (a, host, host.split(".")[-2] if host.count(".") else host):
        if key in ALIASES:
            return ALIASES[key]
    for domain, ch in ALIASES.items():
        if "." in domain and host.endswith("." + domain):
            return ch
    return None


def run(*args, timeout=120):
    p = subprocess.run([AGENT_REACH, *args], capture_output=True, text=True, timeout=timeout)
    try:
        return json.loads(p.stdout)
    except ValueError:
        return {"ok": False, "error": {"code": "BAD_OUTPUT", "message": (p.stdout + p.stderr)[-300:]}}


def check(ch):
    """Return (state, detail): ready, login, not_added or error."""
    try:
        # Four checks queue behind one cold browser start; 120 s was too short.
        d = run("check", ch, timeout=300)
    except subprocess.TimeoutExpired:
        return "error", "check timed out"
    results = d.get("results") or []
    codes = [(r.get("error") or {}).get("code") for r in results] or [(d.get("error") or {}).get("code")]
    msgs = [(r.get("error") or {}).get("message", "") for r in results] or [(d.get("error") or {}).get("message", "")]
    # A public action can pass while a logged-in one fails, so any
    # NEED_LOGIN means the account is not signed in.
    if "NEED_LOGIN" in codes:
        return "login", msgs[codes.index("NEED_LOGIN")]
    if any(r.get("passed") for r in results):
        return "ready", ""
    if "NEED_SETUP" in codes or "not added" in " ".join(m or "" for m in msgs).lower():
        return "not_added", "run: agent-reach add " + ch
    return "error", f"{codes[0]}: {msgs[0]}"


def main(argv):
    opening = "--open" in argv
    targets = [a for a in argv if not a.startswith("--")]
    if "--all" in argv:
        channels = list(LOGIN_CHANNELS)
    else:
        found = {to_channel(t) for t in targets}
        channels = [c for c in LOGIN_CHANNELS if c in found]
    if not channels:
        print("No login needed: none of these platforms has an account login "
              "(YouTube, GitHub, Reddit, web pages and public video work without one).")
        return 0

    with ThreadPoolExecutor(max_workers=4) as pool:
        states = dict(zip(channels, pool.map(check, channels)))

    for ch in [c for c, (s, _) in states.items() if s == "not_added"]:
        added = run("add", ch, timeout=600)
        states[ch] = check(ch) if added.get("ok") else ("error", "agent-reach add failed")

    need = [c for c, (s, _) in states.items() if s == "login"]
    for ch, (state, detail) in states.items():
        mark = {"ready": "ready", "login": "needs login"}.get(state, "problem")
        print(f"{LABELS[ch]:<10} {mark:<12} {detail.splitlines()[0] if detail else ''}".rstrip())

    # AgentReach allows one login window at a time, and every platform shares
    # its one browser profile, so one window takes every login: the first
    # platform's page opens, the rest go in new tabs of that window.
    window = False
    if need and opening:
        res = run("login", need[0], timeout=180)
        busy = (res.get("error") or {}).get("code") == "BUSY"
        window = bool(res.get("ok")) or busy
        if not window:
            print(f"could not open the login window: {(res.get('error') or {}).get('message', '')}")

    if need:
        names = [LABELS[c] for c in need]
        joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
        if window:
            print(f"\nAgentReach login window is open on {names[0]}.")
        print(f"\nASK: Log into your {joined} in the AgentReach browser window "
              f"(one new tab per site), then tell me when you're done.")
        for ch in need:
            print(f"  {LABELS[ch]}: {LOGIN_URLS[ch]}")
        if not window:
            print(f"Open the window with: agent-reach login {need[0]}")
        return 2
    return 1 if any(s == "error" for s, _ in states.values()) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
