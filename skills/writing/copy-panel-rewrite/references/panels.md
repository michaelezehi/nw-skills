# Researching the three panels

Each panel is a research agent's job, done once per run, before any packet
exists. The brief it writes is the only thing its judges will read besides
the house rules and the packet, so it has to carry the whole lens.

## Brief for each research agent

Give it: the product in two sentences, who reads the copy, which surfaces are
in scope (questions, answer options, intros, recaps, screens, emails, site),
whether anything is read aloud, the house rules file, and its lens. Do not give
it the proposals, the code, the other lenses' briefs or the owner's preferences.
It owns exactly `judges/P<n>/BRIEF.md`.

## What BRIEF.md must contain

```
# Panel P<n>: <lens>
The lens in one sentence: the question this panel asks of every string.

## 1. The three seats
**Seat 1. <name>, <role>.** <one line of background>. Their question: "<...>"
**Seat 2. ...** (one seat is always a real reader of this product, ideally one
               with English as a second language or reading on a phone)
**Seat 3. ...**

## 2. Findings
**F1. <claim in one line>.**
<what the source says, quoted where it matters>
*Applies:* <how this changes a verdict on our strings, with an example>
*Source:* <URL actually opened>
*Strength:* Strong (standard, peer-reviewed) | Moderate | Weak (practitioner)
... 10 to 18 findings. Include at least one finding that cuts against the lens.

## 3. Judging rubric
| # | Criterion | Definition |   five criteria, each scored 0 fails, 1 flawed, 2 clean
**Gates** (pass or fail before scoring): obeys HOUSE-RULES.md; for answer
options keeps meaning, order, count and any mustKeep keyword; adult register.
**Decision rule:** drop gate failures; higher total wins; named tie-breaks;
WRITE only when both versions fail a gate or the best scores low with a 0,
and the written text beats the best by at least 2 points. Each verdict names
the deciding criterion.

## 4. Where this lens goes too far
One paragraph: the failure this panel would cause if it won every item
(plain language losing meaning, measurement purity making questions stiff,
fun making serious questions glib). Judges use it to check themselves.

## Sources
Count of sources opened; anything cited but not opened is named as such and
not relied on.
```

## Default lenses

**P1 plain language and readability.** Sources to look for: national plain
language standards (ISO 24495-1 via CAN-ASC-3.1, GOV.UK content design,
digital.gov), sentence-length evidence, the case against readability formulas
(Redish and Selzer), jargon studies (Shulman et al.), W3C cognitive
accessibility, broadcast writing for the ear.

**P2 meaning and measurement.** For questionnaires: cognitive response model
(Tourangeau), double-barrelled and leading items, keying direction, scale
anchors, social desirability, the risk that a reworded item measures
something else. For screens only, make it meaning and product truth: does the
string promise only what the product does, keep the legal or safety detail,
and stay accurate.

**P3 engagement, tone and voice.** Survey breakoff and completion, self-
determination theory (autonomy, competence), microcopy evidence, tone for
sensitive topics, and when anything is narrated: writing for the ear,
synthetic speech rate and comprehension, the TTS vendor's own guidance on its
settings. This panel also recommends the narrator preset.

Adapt the lenses when the product needs it (for example a legal-accuracy
panel for a fintech), but keep three, keep them different, and keep one seat
per panel who is a real reader.
