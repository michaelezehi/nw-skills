---
name: research
description: Deep research on any topic — produces RESEARCH.md with verified findings, source hierarchy, and confidence levels
argument-hint: [topic or question]
---
# Deep Research Mode

**Progress panel:** on by default. Before planning, follow `~/.claude/references/progress-panel.md`: load the savvy-progress tools if not loaded, then report this run's steps and sub-agents to the bar. If a bar is already running, carry on with it: add your rows, no second bar, no duplicate rows.

## Task

$ARGUMENTS

## Writing rules

Unslop applies. These are the research-specific additions.

**Cut on sight:**
- Filler openers: "It's worth noting that", "It's important to note", "In order to", "Due to the fact that", "As mentioned above"
- Weak qualifiers: "very", "quite", "rather", "somewhat", "pretty much", "basically"
- Padding conclusions: "In summary", "To recap", "As you can see", "Clearly"
- Throat-clearing: any sentence that restates what the next sentence says

**Rewrite rules:**
- Passive → active: "X is used by Y" → "Y uses X"
- Nominalisation → verb: "make an assumption" → "assume", "provide a description" → "describe"
- Vague → specific: "some libraries" → name them; "recent versions" → state the version

**Format rules:**
- Tables over prose for comparisons — always
- Bullets only for true lists; never bullet a single item
- No section that exists only to introduce the next section
- Omit sections with nothing to say — a missing section beats a padded one

## Protocol

The goal is a RESEARCH.md whose every significant claim carries a source and an
honest confidence level. The sections below are the constraints; order the
work however the topic needs.

### Scope

Extract from prompt:
- **Topic** — what to research
- **Scope** — broad survey vs. narrow deep-dive (default: deep)
- **Angle** — e.g. technical, strategic, comparative, "how to build X"

If topic is ambiguous, ask before proceeding.

### Output directory

```bash
SLUG=$(echo "<topic>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g')
DATE_PATH=$(date +%m-%d/%H-%M)
mkdir -p "_r&d/research/${SLUG}/${DATE_PATH}"
```

### Sources

Treat training knowledge as hypothesis — verify before asserting. Follow source hierarchy in order:

#### Source Hierarchy

| Priority | Source | When | Confidence |
|----------|--------|------|------------|
| 1 | **Official docs** (Context7 MCP if registered, else WebFetch of the vendor docs / repo README / CHANGELOG) | Library/framework APIs, features, config | HIGH |
| 2 | **Official docs** via WebFetch | Authoritative specs, changelogs | HIGH |
| 3 | **Official GitHub** via WebFetch | README, releases, issue patterns | MEDIUM-HIGH |
| 4 | **WebSearch + verified** | Community patterns cross-checked with official source | MEDIUM |
| 5 | **WebSearch only** | Ecosystem discovery, single sources | LOW |

#### Research Domains (adapt to topic)

For each relevant domain:

**Landscape** — What exists? What's current state of the art? What do practitioners actually use?

**Deep Dive** — How does it work? Core concepts, mechanisms, tradeoffs.

**Patterns & Best Practices** — Established approaches, architecture, what experts recommend.

**Pitfalls** — What goes wrong? Common mistakes, gotchas, failure modes.

**Alternatives** — What else exists? Tradeoffs vs. standard approach.

**Cutting Edge** — Recent developments, emerging approaches, what's changing.

#### Tool Strategy

```
Official docs (for libraries/frameworks):
  1. If `mcp__context7__*` tools are loaded in this session, use them
     (resolve-library-id → query-docs). Do not call them if they are not
     listed: that wastes a failing round-trip, and Context7 is not registered
     on this machine by default.
  2. Otherwise WebFetch the vendor's docs page, GitHub README, and CHANGELOG
     for the exact version in the project's lockfile.
  Run multiple queries per library (setup, API, patterns, config)

WebFetch (for official sources):
  - Use exact URLs from official docs, GitHub, changelogs
  - Check publication dates — prefer recent

WebSearch (for discovery + verification):
  - Include current year in queries
  - Run multiple query variations
  - Verify with official sources before marking MEDIUM+
```

#### Verification Protocol

For every significant claim:
1. Verified against official docs / source for the pinned version? → HIGH confidence
2. Can official docs verify? → MEDIUM-HIGH
3. Multiple sources agree? → Upgrade one level
4. WebSearch only? → LOW — flag for validation

Never present LOW confidence as fact. "I couldn't find X" is a valid finding.

### Check before writing

- [ ] No negative claims without official verification
- [ ] Critical claims have multiple sources
- [ ] Confidence levels assigned honestly

### Write RESEARCH.md

Output to `_r&d/research/<slug>/<MM-DD>/<HH-MM>/RESEARCH.md`.

---

## RESEARCH.md Template

```markdown
# Research: [Topic]

**Date:** [YYYY-MM-DD]
**Scope:** [broad/narrow — what angle]
**Overall confidence:** [HIGH / MEDIUM / LOW]

---

## TL;DR

[3–5 bullet executive summary. Most important findings only.]

**Bottom line:** [One sentence actionable conclusion.]

---

## Landscape

[Current state of the art. What practitioners use. Key players/tools/approaches.]

### Key Players / Options

| Name | What it is | Adoption | Notes |
|------|-----------|----------|-------|
| ... | ... | ... | ... |

---

## Deep Dive

### [Core Concept 1]
[Explanation. How it works. Why it matters.]

### [Core Concept 2]
[...]

---

## Patterns & Best Practices

### [Pattern Name]
**What:** [description]
**When:** [conditions]
**Source:** [Context7 / official URL]
```[code or config example if applicable]```

### Anti-Patterns
- **[Anti-pattern]:** [why bad, what to do instead]

---

## Pitfalls

### [Pitfall 1]
**What goes wrong:** [description]
**Root cause:** [why]
**Prevention:** [how to avoid]

---

## Alternatives & Tradeoffs

| Option | Strength | Weakness | When to choose |
|--------|----------|----------|----------------|
| ... | ... | ... | ... |

---

## Cutting Edge

[Recent changes, emerging approaches, what's shifting. Include dates/versions.]

| Old approach | Current approach | Changed | Impact |
|-------------|-----------------|---------|--------|
| ... | ... | ... | ... |

---

## Open Questions

Things that couldn't be fully resolved:

1. **[Question]**
   - Known: [partial info]
   - Gap: [what's unclear]
   - Recommendation: [how to handle uncertainty]

---

## Sources

### Primary (HIGH confidence)
- [Context7 library ID / official URL] — [topics covered]

### Secondary (MEDIUM confidence)
- [WebSearch verified with official source]

### Tertiary (LOW confidence — validate before using)
- [WebSearch only]

---

## Confidence Breakdown

| Area | Level | Reason |
|------|-------|--------|
| [Domain 1] | HIGH/MED/LOW | [why] |
| [Domain 2] | HIGH/MED/LOW | [why] |

**Valid until:** [date estimate — 30 days for stable domains, 7 for fast-moving]
```

---

## Completion

When RESEARCH.md is written:
1. Print key findings summary (3–5 bullets) to the conversation
2. State overall confidence and any critical LOW-confidence gaps
3. Suggest follow-up angles if scope warrants
