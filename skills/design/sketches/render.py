#!/usr/bin/env python3
"""Sketches CLI — reuse-or-render hand-drawn SVG sketches from the repertoire.

  list  [--tag t] [--kind icon|scene]      browse the repertoire
  find  <words...>                         rank repertoire by tag overlap (reuse check)
  get   <name> [--theme t] [--size px]     emit ONE component block
  page  <name...> [--theme t] [--size px]  emit a labelled grid of blocks (a page)
  add   <name> --kind --viewbox --sw --tags --origin --body-file f
                                           append a NEW sketch + heal INDEX
  theme <name> --ink --faint --hero --accent --paper
                                           register/override a brand palette

Everything renders inside a <figure class="sk"> component block. Bodies are
stored palette-tokenised ({INK} {FAINT} {HERO} {ACCENT} {PAPER}) so one sketch
serves every brand — recolour, never redraw."""
import json, os, sys, argparse, re

ROOT = os.path.dirname(os.path.abspath(__file__))
LIB  = os.path.join(ROOT, "repertoire", "library.json")

def load(): return json.load(open(LIB))
def save(d): json.dump(d, open(LIB,"w"), separators=(",",":"))

def colour(body, theme):
    for tok,val in theme.items(): body = body.replace("{"+tok+"}", val)
    return body

def block(name, sk, theme, size=None):
    """One self-contained component block. No white container, no gradient."""
    body = colour(sk["body"], theme)
    sw   = sk.get("sw", 2.4)
    style = f' style="width:{size}px;height:auto"' if size else ''
    return (f'<figure class="sk sk-{name}" aria-label="{sk["label"]}">'
            f'<svg viewBox="{sk["viewBox"]}" fill="none" stroke="{theme["INK"]}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{style}>'
            f'{body}</svg></figure>')

def get_theme(d, name):
    t = d["themes"].get(name)
    if not t: sys.exit(f"unknown theme '{name}'. known: {', '.join(d['themes'])}")
    return t

def cmd_list(a):
    d = load()
    for n,sk in d["sketches"].items():
        if a.tag and a.tag.lower() not in sk["tags"].lower(): continue
        if a.kind and sk["kind"]!=a.kind: continue
        print(f"{n:26} {sk['kind']:6} {sk['viewBox']:14} {sk['tags']}")

def cmd_find(a):
    d = load(); q = set(" ".join(a.words).lower().replace(","," ").split())
    scored = []
    for n,sk in d["sketches"].items():
        tags = set(re.split(r"[ ,]+", sk["tags"].lower())) | {n.replace("-"," ")}
        score = sum(1 for w in q if any(w in t or t in w for t in tags))
        if score: scored.append((score,n,sk["tags"]))
    scored.sort(reverse=True)
    if not scored: print("NO MATCH — create a new sketch in the house style, then `add` it."); return
    for s,n,t in scored[:6]: print(f"{s:2}  {n:26} {t}")

def cmd_get(a):
    d = load(); sk = d["sketches"].get(a.name) or sys.exit(f"no sketch '{a.name}'")
    print(block(a.name, sk, get_theme(d,a.theme), a.size))

def cmd_page(a):
    d = load(); th = get_theme(d,a.theme)
    cells = []
    for n in a.name:
        sk = d["sketches"].get(n)
        if not sk: print(f"<!-- MISSING: {n} — create + add it -->"); continue
        cells.append(f'<div class="sk-cell">{block(n,sk,th,a.size)}'
                     f'<figcaption class="sk-cap">{sk["label"]}</figcaption></div>')
    print('<div class="sk-page" style="display:grid;gap:28px;'
          'grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">'
          + "".join(cells) + "</div>")

def cmd_add(a):
    d = load()
    if a.name in d["sketches"] and not a.force:
        sys.exit(f"'{a.name}' exists. reuse it, or pass --force to overwrite.")
    body = open(a.body_file).read()
    body = re.sub(r"\s+"," ",body).strip()
    body = re.sub(r"<svg[^>]*>","",body).replace("</svg>","").strip()  # accept full svg too
    d["sketches"][a.name] = {"kind":a.kind,"viewBox":a.viewbox,"sw":a.sw,
        "origin":a.origin,"label":a.label or a.name.replace("-"," "),
        "tags":a.tags,"body":body}
    save(d); heal_index(d)
    print(f"added '{a.name}' ({a.kind}) — repertoire now {len(d['sketches'])} sketches.")

def cmd_theme(a):
    d = load()
    d["themes"][a.name] = {"INK":a.ink,"FAINT":a.faint,"HERO":a.hero,
                           "ACCENT":a.accent,"PAPER":a.paper}
    save(d); print(f"theme '{a.name}' registered.")

def heal_index(d):
    lib = d["sketches"]; P = os.path.join(ROOT,"repertoire","INDEX.md")
    icons=[n for n,s in lib.items() if s["kind"]=="icon"]
    scenes=[n for n,s in lib.items() if s["kind"]=="scene"]
    with open(P,"w") as f:
        f.write(f"# Sketch repertoire ({len(lib)} sketches)\n\n")
        f.write("Each entry is palette-tokenised: `{INK} {FAINT} {HERO} {ACCENT} {PAPER}`. "
                "Recolour by theme, never re-draw. Match a page item to the closest "
                "**tags** before creating anything new.\n\n")
        for grp,names in [("Icons (square glyphs)",icons),("Scenes (wireframe stories)",scenes)]:
            f.write(f"## {grp}\n\n| name | viewBox | origin | concept tags |\n|---|---|---|---|\n")
            for n in names:
                s=lib[n]; f.write(f"| `{n}` | {s['viewBox']} | {s['origin']} | {s['tags']} |\n")
            f.write("\n")

P = argparse.ArgumentParser(); sub = P.add_subparsers(dest="cmd", required=True)
s=sub.add_parser("list"); s.add_argument("--tag"); s.add_argument("--kind"); s.set_defaults(fn=cmd_list)
s=sub.add_parser("find"); s.add_argument("words", nargs="+"); s.set_defaults(fn=cmd_find)
s=sub.add_parser("get"); s.add_argument("name"); s.add_argument("--theme",default="founders-align"); s.add_argument("--size",type=int); s.set_defaults(fn=cmd_get)
s=sub.add_parser("page"); s.add_argument("name",nargs="+"); s.add_argument("--theme",default="founders-align"); s.add_argument("--size",type=int); s.set_defaults(fn=cmd_page)
s=sub.add_parser("add"); s.add_argument("name"); s.add_argument("--kind",required=True,choices=["icon","scene"]); s.add_argument("--viewbox",required=True); s.add_argument("--sw",type=float,default=2.6); s.add_argument("--tags",required=True); s.add_argument("--origin",default="custom"); s.add_argument("--label"); s.add_argument("--body-file",dest="body_file",required=True); s.add_argument("--force",action="store_true"); s.set_defaults(fn=cmd_add)
s=sub.add_parser("theme"); s.add_argument("name"); s.add_argument("--ink",required=True); s.add_argument("--faint",required=True); s.add_argument("--hero",required=True); s.add_argument("--accent",required=True); s.add_argument("--paper",required=True); s.set_defaults(fn=cmd_theme)
a=P.parse_args(); a.fn(a)
