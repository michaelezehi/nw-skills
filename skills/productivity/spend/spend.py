#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["rich>=13.7"]
# ///
"""Daily AI coding spend dashboard. Wraps `codeburn export` and enriches it
with real session names from Claude Code and Codex transcripts."""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta

from rich.align import Align
from rich.box import HEAVY_HEAD, ROUNDED, SIMPLE
from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()

HOME = os.path.expanduser("~")
CLAUDE_PROJECTS = os.path.join(HOME, ".claude", "projects")
CODEX_INDEX = os.path.join(HOME, ".codex", "session_index.jsonl")

PERIODS = {
    "today": 0, "yesterday": 1, "2d": 2, "3d": 3, "4d": 4, "5d": 5, "6d": 6,
    "week": "week", "7d": "week", "month": "month",
}


# ---------------------------------------------------------------- data layer

def normalise(argv: list[str]) -> str:
    """Accept `--today`, `-yesterday`, `3d`, `--3 days ago`, `last week`, … and
    collapse them to one canonical token. Flags may be split across argv."""
    tokens = [t.lstrip("-").strip() for t in argv]
    return " ".join(t for t in tokens if t).lower().strip()


def single_day(d: date, offset: int) -> tuple[date, date, str]:
    labels = {0: "Today", 1: "Yesterday"}
    return d, d, labels.get(offset) or d.strftime("%A %-d %B")


def resolve_period(argv: list[str]) -> tuple[date, date, str]:
    """Return (from_date, to_date, human_label)."""
    today = date.today()
    arg = normalise(argv) or "today"

    if arg in ("", "today", "t", "so far today"):
        return single_day(today, 0)
    if arg in ("yesterday", "y", "1 day ago", "1 days ago", "last day"):
        return single_day(today - timedelta(days=1), 1)
    if arg in ("week", "7d", "last week", "this week", "last 7 days", "past week"):
        return today - timedelta(days=6), today, "Last 7 days"
    if arg in ("month", "this month", "mtd", "month to date"):
        return today.replace(day=1), today, today.strftime("%B %Y")

    # "3 days ago", "3 day ago", "3d", "3"
    words = arg.split()
    n = None
    if len(words) >= 2 and words[0].isdigit() and words[1].startswith("day"):
        n = int(words[0])
    elif len(words) == 1:
        stem = words[0][:-1] if words[0].endswith("d") else words[0]
        if stem.isdigit():
            n = int(stem)
    if arg in ("a week ago", "one week ago"):
        n = 7
    if n is not None and 0 <= n <= 90:
        return single_day(today - timedelta(days=n), n)

    try:
        d = datetime.strptime(words[0], "%Y-%m-%d").date()
        return d, d, d.strftime("%A %-d %B %Y")
    except (ValueError, IndexError):
        console.print(f"[red]Unknown period '{arg}'.[/]")
        console.print("[grey54]Try: --today, --yesterday, --3 days ago, --week, --month, or 2026-07-14[/]")
        sys.exit(1)


def load_codeburn(frm: date, to: date) -> dict:
    cmd = ["npx", "-y", "codeburn", "export", "--format", "json",
           "--from", frm.isoformat(), "--to", to.isoformat(), "-o", "/tmp/.spend-cache.json"]
    # Only animate on a real TTY — piped/tool-captured output would otherwise
    # collect every spinner frame as literal noise above the dashboard.
    if sys.stdout.isatty():
        with console.status("[bold cyan]Reading transcripts…", spinner="dots"):
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    else:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if proc.returncode != 0:
        console.print("[red]codeburn export failed:[/]")
        console.print(proc.stderr[-1500:] or proc.stdout[-1500:])
        sys.exit(1)
    try:
        with open("/tmp/.spend-cache.json", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        console.print(f"[red]Could not read codeburn output: {exc}[/]")
        sys.exit(1)


def codex_names() -> dict[str, str]:
    names: dict[str, str] = {}
    try:
        with open(CODEX_INDEX, encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if o.get("id") and o.get("thread_name"):
                    names[o["id"]] = o["thread_name"]
    except OSError:
        pass
    return names


def claude_name(session_id: str) -> str | None:
    """Pull the newest custom title / last prompt by scanning the file tail."""
    hits = glob.glob(os.path.join(CLAUDE_PROJECTS, "*", f"{session_id}.jsonl"))
    if not hits:
        return None
    path = hits[0]
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as fh:
            if size > 400_000:
                fh.seek(size - 400_000)
                fh.readline()  # discard partial line
            blob = fh.read().decode("utf-8", errors="ignore")
    except OSError:
        return None

    title = prompt = None
    for line in blob.splitlines():
        if '"custom-title"' not in line and '"last-prompt"' not in line:
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        if o.get("type") == "custom-title" and o.get("customTitle"):
            title = o["customTitle"]
        elif o.get("type") == "last-prompt" and o.get("lastPrompt"):
            prompt = o["lastPrompt"]
    name = title or prompt
    if not name:
        return None
    name = " ".join(str(name).split())
    return name


# ------------------------------------------------------------- presentation

def money(v: float) -> str:
    if v >= 1000:
        return f"${v:,.0f}"
    if v >= 100:
        return f"${v:,.1f}"
    return f"${v:,.2f}"


def compact(n: float) -> str:
    for unit, div in (("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if n >= div:
            return f"{n / div:.1f}{unit}"
    return f"{n:,.0f}"


def heat(cost: float, peak: float) -> str:
    """Colour by share of the biggest row — cheap is calm, expensive is loud."""
    if peak <= 0:
        return "grey62"
    r = cost / peak
    if r >= 0.75:
        return "bold red"
    if r >= 0.45:
        return "bold dark_orange"
    if r >= 0.20:
        return "yellow"
    if r >= 0.07:
        return "cyan"
    return "grey62"


def bar(cost: float, peak: float, width: int = 14) -> Text:
    if peak <= 0:
        return Text(" " * width)
    filled = int(round((cost / peak) * width))
    out = Text("█" * filled, style=heat(cost, peak))
    out.append("░" * (width - filled), style="grey19")
    return out


def bar_width() -> int:
    """Bars are the first thing to give up space on a narrow terminal."""
    w = console.width
    if w >= 120:
        return 14
    if w >= 100:
        return 10
    return 6


def short_project(path: str) -> str:
    return os.path.basename(path.rstrip("/")) or path


def project_labels(paths: list[str], width: int = 40) -> dict[str, str]:
    """Label each project by its path relative to the shared root, so nested
    checkouts stay distinguishable without repeating the common prefix."""
    real = [p for p in paths if p.startswith("/")]
    root = ""
    if len(real) > 1:
        try:
            root = os.path.commonpath(real)
        except ValueError:
            root = ""

    counts: dict[str, int] = defaultdict(int)
    for p in paths:
        counts[short_project(p)] += 1

    labels: dict[str, str] = {}
    for p in paths:
        base = short_project(p)
        if counts[base] == 1 or not root or not p.startswith("/"):
            label = base
        else:
            rel = os.path.relpath(p.rstrip("/"), root)
            label = base if rel in (".", "") else rel
        if len(label) > width:
            label = "…" + label[-(width - 1):]
        labels[p] = label
    return labels


def summary_panel(data: dict, label: str, frm: date, to: date) -> Panel:
    s = (data.get("summary") or [{}])[0]
    cost = float(s.get("Cost (USD)") or 0)
    calls = int(s.get("API Calls") or 0)
    sessions = int(s.get("Sessions") or 0)
    projects = int(s.get("Projects") or 0)

    tin = tout = tcw = tcr = treason = 0
    for r in data.get("records") or []:
        tin += r.get("inputTokens") or 0
        tout += r.get("outputTokens") or 0
        tcw += r.get("cacheWriteTokens") or 0
        tcr += r.get("cacheReadTokens") or 0
        treason += r.get("reasoningTokens") or 0
    total_tokens = tin + tout + tcw + tcr + treason

    days = (to - frm).days + 1
    if days > 1:
        trailing, trailing_caption = cost / days, "per day"
    else:
        trailing = cost / sessions if sessions else 0.0
        trailing_caption = "per session"

    grid = Table.grid(expand=True, padding=(0, 2))
    for _ in range(4):
        grid.add_column(justify="center", ratio=1)

    def cell(value: str, caption: str, style: str) -> Group:
        return Group(
            Align.center(Text(value, style=f"bold {style}")),
            Align.center(Text(caption, style="grey54")),
        )

    grid.add_row(
        cell(money(cost), "spent", "red" if cost > 200 else "green"),
        cell(compact(total_tokens), "tokens", "cyan"),
        cell(f"{sessions:,}", "sessions", "magenta"),
        cell(f"{projects:,}", "projects", "blue"),
    )
    grid.add_row("", "", "", "")
    grid.add_row(
        cell(compact(calls), "api calls", "white"),
        cell(compact(tout + treason), "written out", "green"),
        cell(compact(tcr), "cache reads", "grey62"),
        cell(money(trailing), trailing_caption, "yellow"),
    )

    when = frm.strftime("%-d %b") if frm == to else f"{frm.strftime('%-d %b')} → {to.strftime('%-d %b')}"
    return Panel(
        grid,
        title=f"[bold white]{label}[/]  [grey54]·[/]  [grey62]{when}[/]",
        border_style="red" if cost > 500 else "cyan",
        box=HEAVY_HEAD,
        padding=(1, 2),
    )


def projects_table(data: dict, limit: int = 15) -> Table | None:
    rows = data.get("projects") or []
    if not rows:
        return None
    rows = sorted(rows, key=lambda r: float(r.get("Cost (USD)") or 0), reverse=True)
    peak = float(rows[0].get("Cost (USD)") or 0)
    labels = project_labels([str(r.get("Project") or "?") for r in rows])
    hidden = rows[limit:]
    rows = rows[:limit]

    w = console.width
    show_bar = w >= 90
    show_avg = w >= 84
    show_calls = w >= 76
    bw = bar_width()

    t = Table(box=ROUNDED, border_style="grey35", header_style="bold grey70",
              title="[bold]Where it went[/]", title_justify="left", expand=True, pad_edge=False)
    if show_bar:
        t.add_column("", width=bw, no_wrap=True)
    t.add_column("Project", overflow="ellipsis", no_wrap=True, ratio=1, min_width=14)
    t.add_column("Cost", justify="right", no_wrap=True)
    t.add_column("Share", justify="right", no_wrap=True)
    t.add_column("Sess", justify="right", no_wrap=True)
    if show_avg:
        t.add_column("Avg/sess", justify="right", no_wrap=True)
    if show_calls:
        t.add_column("Calls", justify="right", no_wrap=True)

    def emit(bar_cell, label, cost_cell, share, sess, avg, calls) -> None:
        cells = []
        if show_bar:
            cells.append(bar_cell)
        cells.extend([label, cost_cell, share, sess])
        if show_avg:
            cells.append(avg)
        if show_calls:
            cells.append(calls)
        t.add_row(*cells)

    for r in rows:
        cost = float(r.get("Cost (USD)") or 0)
        style = heat(cost, peak)
        emit(
            bar(cost, peak, bw),
            Text(labels[str(r.get("Project") or "?")], style=style),
            Text(money(cost), style=style),
            f"{float(r.get('Share (%)') or 0):.0f}%",
            f"{int(r.get('Sessions') or 0):,}",
            money(float(r.get("Avg/Session (USD)") or 0)),
            compact(int(r.get("API Calls") or 0)),
        )

    if hidden:
        rest = sum(float(r.get("Cost (USD)") or 0) for r in hidden)
        emit(
            Text("░" * bw, style="grey19"),
            Text(f"+ {len(hidden)} smaller projects", style="grey54 italic"),
            Text(money(rest), style="grey54"),
            f"{sum(float(r.get('Share (%)') or 0) for r in hidden):.0f}%",
            f"{sum(int(r.get('Sessions') or 0) for r in hidden):,}",
            "—",
            compact(sum(int(r.get("API Calls") or 0) for r in hidden)),
        )
    return t


def sessions_table(data: dict, limit: int = 12) -> Table | None:
    rows = data.get("sessions") or []
    if not rows:
        return None
    rows = sorted(rows, key=lambda r: float(r.get("Cost (USD)") or 0), reverse=True)[:limit]
    peak = float(rows[0].get("Cost (USD)") or 0)
    cx = codex_names()
    labels = project_labels([str(r.get("Project") or "?") for r in rows], width=22)

    # model per session, from the per-call records
    models: dict[str, str] = {}
    for r in data.get("records") or []:
        sid = r.get("sessionId")
        if sid and sid not in models and r.get("model"):
            models[sid] = str(r["model"])

    w = console.width
    show_bar = w >= 96
    show_model = w >= 88
    bw = bar_width()

    t = Table(box=ROUNDED, border_style="grey35", header_style="bold grey70",
              title="[bold]Biggest sessions[/]", title_justify="left", expand=True, pad_edge=False)
    if show_bar:
        t.add_column("", width=bw, no_wrap=True)
    t.add_column("Session", overflow="ellipsis", no_wrap=True, ratio=2, min_width=18)
    t.add_column("Project", overflow="ellipsis", no_wrap=True, ratio=1, min_width=10, style="grey54")
    if show_model:
        t.add_column("Model", overflow="ellipsis", no_wrap=True, width=8, style="grey54")
    t.add_column("Cost", justify="right", no_wrap=True)
    t.add_column("Turns", justify="right", no_wrap=True)

    for r in rows:
        sid = str(r.get("Session ID") or "")
        cost = float(r.get("Cost (USD)") or 0)
        style = heat(cost, peak)
        name = cx.get(sid) or claude_name(sid)
        if not name:
            name = f"subagent · {sid[6:14]}" if sid.startswith("agent-") else f"untitled · {sid[:8]}"
        if len(name) > 64:
            name = name[:61] + "…"
        model = models.get(sid, "—").replace("claude-", "").replace("-20", " ")
        cells = []
        if show_bar:
            cells.append(bar(cost, peak, bw))
        cells.append(Text(name, style=style))
        cells.append(labels[str(r.get("Project") or "?")])
        if show_model:
            cells.append(model)
        cells.append(Text(money(cost), style=style))
        cells.append(f"{int(r.get('Turns') or 0):,}")
        t.add_row(*cells)
    return t


def models_table(data: dict) -> Table | None:
    agg: dict[str, dict[str, float]] = defaultdict(lambda: {"cost": 0.0, "calls": 0, "out": 0})
    for r in data.get("records") or []:
        m = str(r.get("model") or "unknown")
        agg[m]["cost"] += float(r.get("cost") or 0)
        agg[m]["calls"] += 1
        agg[m]["out"] += (r.get("outputTokens") or 0) + (r.get("reasoningTokens") or 0)
    if not agg:
        return None
    rows = sorted(agg.items(), key=lambda kv: kv[1]["cost"], reverse=True)
    peak = rows[0][1]["cost"]

    t = Table(box=SIMPLE, border_style="grey35", header_style="bold grey70",
              title="[bold]By model[/]", title_justify="left", expand=True, pad_edge=False)
    t.add_column("Model", overflow="ellipsis", no_wrap=True, ratio=2)
    t.add_column("Cost", justify="right", no_wrap=True)
    t.add_column("Calls", justify="right", no_wrap=True)
    t.add_column("Out", justify="right", no_wrap=True)
    for m, v in rows:
        t.add_row(Text(m, style=heat(v["cost"], peak)),
                  Text(money(v["cost"]), style=heat(v["cost"], peak)),
                  compact(v["calls"]), compact(v["out"]))
    return t


def daily_trend(data: dict, frm: date, to: date) -> Panel | None:
    periods = data.get("periods") or []
    daily = (periods[0].get("daily") if periods else None) or []
    # codeburn can emit a timezone-boundary day outside the requested window
    vals = []
    for d in daily:
        stamp = str(d.get("Date") or "")[:10]
        try:
            day = datetime.strptime(stamp, "%Y-%m-%d").date()
        except ValueError:
            continue
        if frm <= day <= to:
            vals.append((stamp, float(d.get("Cost (USD)") or 0)))
    if len(vals) < 2:
        return None
    vals.sort()
    peak = max(v for _, v in vals) or 1

    t = Table.grid(expand=True, padding=(0, 1))
    t.add_column(no_wrap=True, style="grey54")
    t.add_column(ratio=1)
    t.add_column(justify="right", no_wrap=True)
    for stamp, v in vals:
        label = datetime.strptime(stamp, "%Y-%m-%d").strftime("%a %-d %b")
        t.add_row(label, bar(v, peak, width=40), Text(money(v), style=heat(v, peak)))
    return Panel(t, title="[bold]Daily[/]", title_align="left", border_style="grey35", box=ROUNDED, padding=(1, 2))


def load_plan() -> dict:
    """Read codeburn's subscription plan config, if one has been set."""
    path = os.path.join(HOME, ".config", "codeburn", "config.json")
    try:
        with open(path, encoding="utf-8") as fh:
            cfg = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    # config nests as {"plans": {"all": {...}, "claude": {...}}}
    plans = cfg.get("plans")
    if isinstance(plans, dict) and plans:
        for key in ("all", "claude"):
            if isinstance(plans.get(key), dict):
                return plans[key]
        first = next(iter(plans.values()), None)
        return first if isinstance(first, dict) else {}
    plan = cfg.get("plan")
    if isinstance(plan, dict):
        return plan
    return cfg if isinstance(cfg.get("monthlyUsd"), (int, float)) else {}


def savings_panel(data: dict, frm: date, to: date) -> Panel:
    """API list price vs what a subscription actually costs for the period."""
    s = (data.get("summary") or [{}])[0]
    api_value = float(s.get("Cost (USD)") or 0)
    local_saved = sum(float(r.get("savings") or 0) for r in data.get("records") or [])

    plan = load_plan()
    monthly = float(plan.get("monthlyUsd") or 0)
    plan_id = str(plan.get("id") or "none")

    t = Table.grid(expand=True, padding=(0, 2))
    t.add_column(style="grey62", no_wrap=True)
    t.add_column(justify="right", no_wrap=True)
    t.add_column(style="grey42", ratio=1)

    t.add_row("Would have cost", Text(money(api_value), style="bold red"),
              "these tokens at API list price")

    if monthly > 0:
        days = (to - frm).days + 1
        share = monthly * (days / 30.0)
        saved = api_value - share
        mult = (api_value / share) if share else 0
        desc = f"{money(monthly)}/mo plan over {days} day{'s' if days > 1 else ''}"
        if plan_id not in ("custom", "none", ""):
            desc = f"{plan_id} · {desc}"
        t.add_row("You actually pay", Text(money(share), style="bold green"), desc)
        t.add_row("Saved", Text(money(saved), style="bold cyan"),
                  f"{mult:.1f}× leverage on the subscription")
        border = "green"
    else:
        t.add_row("You actually pay", Text("unknown", style="bold yellow"),
                  "no plan configured — this is list price, not your bill")
        t.add_row("", Text("", style="grey42"),
                  "set one: codeburn plan custom --monthly-usd 200")
        border = "yellow"

    if local_saved > 0:
        t.add_row("Local-model saving", Text(money(local_saved), style="bold cyan"),
                  "work routed to models billed at zero")

    return Panel(t, title="[bold]Cost vs value[/]", title_align="left",
                 border_style=border, box=ROUNDED, padding=(1, 2))


def footer() -> Panel:
    opts = [
        ("--today", "so far today"),
        ("--yesterday", "the full previous day"),
        ("--3 days ago", "any single day back (1–90)"),
        ("--3d", "same thing, short form"),
        ("--week", "rolling last 7 days, with trend"),
        ("--month", "month to date"),
        ("2026-07-14", "any exact date"),
    ]
    t = Table.grid(padding=(0, 3))
    t.add_column(style="bold cyan", no_wrap=True)
    t.add_column(style="grey54", no_wrap=True)
    for a, b in opts:
        t.add_row(f"spend {a}", b)
    return Panel(t, title="[bold]Run it for[/]", title_align="left",
                 border_style="grey30", box=ROUNDED, padding=(1, 2))


def main() -> None:
    argv = sys.argv[1:]
    if any(a in ("-h", "--help", "help") for a in argv):
        console.print(footer())
        return
    frm, to, label = resolve_period(argv)
    data = load_codeburn(frm, to)

    console.print()
    console.print(summary_panel(data, label, frm, to))
    console.print()
    console.print(savings_panel(data, frm, to))
    console.print()

    for block in (daily_trend(data, frm, to), projects_table(data), sessions_table(data), models_table(data)):
        if block is not None:
            console.print(block)
            console.print()

    console.print(footer())
    console.print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[grey54]cancelled[/]")
        sys.exit(130)
