---
name: optics-resume
description: Generate or update a CV/resume in the "Optics" yellow-and-black editorial design — a two-column print layout with a white name header, a black Professional Summary panel, and a full-bleed yellow sidebar (projects, education, skills, clients, data platforms, devops, profiles). Renders HTML to a pixel-clean A4 PDF via headless Chrome. Use when the user asks to build, restyle, or update a resume/CV in this Optics look, or invokes --optics.
disable-model-invocation: false
---

# /optics-resume — Optics-style CV in yellow & black

Build a resume/CV in the **Optics aesthetic**: bold yellow (`#e8c23b`) + black (`#161616`) blocking on a clean two-column A4 print layout. Output is a real PDF rendered from HTML by headless Chrome — no online tools.

`template.html` (next to this file) is the reference design. Copy it, swap the content, render.

## The design at a glance

- **Header (top, full width)** — white background, black border-bottom.
  - Left (63%): name in large spaced uppercase (letter-spacing 4px), title tagline, yellow accent bar, contact as **plain text** (no icons).
  - Right (37%): **black** Professional Summary panel — yellow heading, light text (`--soft-dark`).
- **Body (two columns)**
  - Main (63%, white): `Experience` — job entries with black bullet dots.
  - Sidebar (37%, **yellow** full-bleed): `Projects I'm Working On` (concise), `Education`, `Skills`, `Key Clients`, `Data Platforms`, `DevOps Tooling`, `Website, Portfolio & Profiles` — black headings, black text, black dots.
- The white/yellow split is a `body` `linear-gradient` so the yellow band repeats on every page. `@page { margin: 10mm 0 0 0 }` gives top breathing room on continuation pages.

## Design tokens (`:root`)

```
--ink #1a1a1a   --ink-soft #4a4a4a   --dot #161616
--accent #e8c23b (Optics yellow)     --side-bg #161616 (black blocks)
--on-dark #f3f1ea   --soft-dark #c7c4ba   (text on black)
text on yellow: headings #161616, body #2a2410, meta #4a3f10 bold
--main-w 63%   --side-w 37%
```

To flip blocks (e.g. yellow summary + black sidebar), swap `.head-right` background with the `body` gradient's right-band colour and invert the text colours accordingly.

## Hard rules (the user's standing preferences)

1. **No em dashes anywhere.** Use `-` for title/date separators, `·` between project meta fields, commas in prose. After editing, sweep: `perl -CSD -i -pe 's/\x{2014}/-/g' resume.html`.
2. **Don't repeat the tech stack.** Name a given tech (Convex, WorkOS, React Native, AI/LLM) only once or twice across bullets — the stack lives in the **Skills** sidebar. Keep bullets outcome-focused.
3. **Projects go on the sidebar, concise** — name + one meta line (`Role · domain · dates`) + one short description. Not in work history.
4. **Trim older roles** — roles from 2019 and earlier: **max 2 bullets** each. Recent roles keep fuller bullets.
5. **Page-break safety** — keep `break-inside: avoid` on `.job li, .side li`, `.proj`, `.side section`, and `break-after: avoid` on headings, so nothing splits across the page boundary. (Modern fragmentation properties — the legacy `page-break-*` aliases are no longer needed.)
6. **AI framing is light-touch** — product-first, not buzzwordy. Prefer "intelligent"/"smart" over "AI" in any product-facing phrasing.

## Workflow

1. Copy `~/.claude/skills/optics-resume/template.html` to the working folder as `resume.html`.
2. Replace header (name, title, contact), the black summary, `Experience` entries, and the yellow sidebar sections with the user's content. Honour the hard rules above.
3. Run the em-dash sweep.
4. Render to PDF with headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --no-pdf-header-footer \
  --print-to-pdf="<Name>-CV.pdf" \
  "file://<absolute-path>/resume.html"
```

5. **Verify** — open/Read the PDF. Confirm: 2 pages (or as intended), no item cut at the page break, top margin present, blocks coloured correctly, zero em dashes.

## Notes

- Plain `--headless` is Chrome's unified headless mode (the old implementation was removed in Chrome 132) — never write `--headless=new`.
- Default is A4, ~10.2px base font, 2 pages for a long career. If content overflows to a stray near-blank page, trim older bullets or tighten `section { margin-bottom }`.
- The full-bleed colour relies on `print-color-adjust: exact` (keep the `-webkit-` prefixed twin in the template for older Chrome builds).
- Tailor the summary/title to the target roles (e.g. product-minded, ships end to end) without stuffing keywords.
