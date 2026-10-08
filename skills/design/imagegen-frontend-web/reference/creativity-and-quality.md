# Creativity Escalation, Implementation Edge, Clarity Check, and Examples

## Creativity escalation rule

The design must show real creative ambition.

Do not settle for the first obvious layout solution.
Push the work beyond generic SaaS patterns.

Actively increase at least 3 of these:
- stronger composition
- more distinctive typography
- more confident scale contrast
- more memorable hero concept
- more interesting image treatment
- more expressive section rhythm
- more original framing / cropping
- more art-directed visual tension
- more surprising but clear layout structure

Creativity must feel intentional, not chaotic.

Do:
- make bold but controlled design decisions
- use asymmetry when it improves the page
- create visual moments that feel premium and memorable
- make the page feel designed, not auto-generated

Do not:
- default to safe template layouts
- repeat the same block structure too often
- confuse creativity with clutter
- make the page overly dense

## Extra creativity and implementation edge

Apply unless the user opts out:

### Cross-section contrast
Across the slice, deliberately vary foreground/background intensity at least twice (lighter → richer → calmer) so the scroll feels paced, not monotonous slabs.

### CTA specificity
Prefer one unmistakable primary action per major viewport tier; secondary actions must look secondary (scale, outline, ghost), not clones of primary.

### Image variety inside one comp
Mix at least **two distinct image crops** where multiple sections exist — e.g. macro product + contextual environment, or portrait editorial + widescreen artifact — avoiding one repeated stock silhouette.

### Data-viz restraint
Charts, sparklines, and graphs appear only when the site type logically needs them (analytics, pricing, infra, observability brands). Else keep proof human (quotes, receipts, timelines, screenshots of real workflows).

### Cultural / tonal alignment
When the brief names an industry or region, steer palette and typographic temperament to match — don't ship default "neutral SF startup" unless the brief is intentionally generic SaaS.

### Mobile-implied fidelity (even for desktop mocks)
Maintain tap-friendly hit sizes and readable caption sizes visually; stacking order should imply a sane single-column narrative.

### Conversion focus
Each section has a job. Even when the design is artistic, the page must read as a real product or brand site:
- the hero communicates value in seconds and offers one obvious next action
- proof sections (logos, quotes, metrics) feel earned, not stuffed
- pricing or CTA sections feel decisive, not buried
- the final section closes: a single strong CTA + supporting trust cue
Avoid pure mood reels with no funnel logic.

### Composition variety check
Across all per-section images, internally log the chosen composition anchor and background mode. Reject the set if:
- the same composition anchor repeats more than 2 sections in a row
- the same background mode repeats more than 3 sections in a row
- every section is inline-asset (no full-bleed background ever appears) **AND** the brief does not call for minimalism / typography-only / swiss / ultra simple

For non-minimalist briefs: push for at least one full-bleed (or duotone / atmospheric) background and at least one mini minimalist section in any multi-section site.

For minimalist briefs: this rule is suspended. Restraint is the design.

## Clarity check

Before finalizing, verify internally:

1. Has the design been generated first (images before code)?
2. Have all generated images been deeply analyzed?
3. Is the text readable enough? If not, were extra detail images created?
4. Were enough images generated, or was the image count too lazy?
5. Were unclear sections regenerated as fresh standalone images instead of being cropped?
6. Is the hierarchy obvious?
7. Is the hero clean enough?
8. Is typography analyzed properly?
9. Are spacing relationships understood properly?
10. Are buttons and components extracted properly?
11. Are colors analyzed properly?
12. Is the design visually distinctive?
13. Is it free of obvious AI tells?
14. Is it premium rather than template-like?
15. Can someone code from this faithfully?
16. If multiple images exist, do they clearly belong together?
17. Is imagery used strongly enough (with variation, not one repeated crop)?
18. Does the page breathe, or is it too dense?
19. Is there enough spacing between sections, and is it even and controlled?
20. Do smaller sections still have enough surrounding space to feel clean?
21. Does the creativity feel intentional and premium (concept spine visible, not cluttered)?
22. Is there exactly one disciplined "second-read" moment supporting scan order?
23. Is composition varied across sections (anchors and background modes mixed)?
24. Is the hero scale (giant / mid / mini) chosen and executed cleanly?
25. Is there a clear conversion path (hook -> proof -> action) even in artistic sites?
26. Is the palette consistent across all per-section images?
27. Is each image horizontal and one-section-only?
28. Is the **total number of images equal to the number of sections** (never fewer)? Has the set avoided compressing too many sections into one tiny image?
29. Is the hero using a varied composition (not defaulting to left-text / right-image out of habit)?
30. Was the analysis clean, structured, and specific?
31. Has unnecessary nested boxing been removed?
32. Is the first screen still clean and readable on a small laptop?
33. Have useless pills, labels, and fake technical micro-elements been reduced?

If not, refine internally before output. If the count is wrong, regenerate the missing sections. If the hero feels like a reflexive left-text / right-image default, prefer a different composition anchor.

## Example interpretations

### Example 1
User: "make a hero section for an AI startup"

Interpretation:
- 1 horizontal image
- Hero Scale: Mid Editorial or Giant Statement
- Composition Anchor: bottom-left text over full-bleed product/atmosphere image
- Background Mode: full-bleed image with dark tonal overlay
- CTA Variation: outlined inline + small label hint
- Palette: Deep Dark or Bold Studio Solid, one consistent accent
- no cliche dashboard spam, no purple AI glow
- if needed, generate 1 closer extraction image for text/buttons; do not crop a small region out of a larger board
- keep the hero calm and readable; avoid fake utility labels and nested cards
- analyze headline, subheadline, CTA, spacing, colors, hero media — then implement the hero if the user wants code

### Example 2
User: "design 8 sections for a fintech website"

Interpretation:
- 8 separate horizontal images (one per section)
- Hero Scale: Mid Editorial (trust-driven)
- vary Composition Anchor across sections (centered low, right-third caption, bottom-left over chart visual, stacked center for closing CTA)
- Background Mode mix: solid surface, full-bleed image background once, editorial side-image at use cases
- one consistent palette (e.g. ink + paper + single brand accent)
- conversion path: hook -> proof bar -> features -> use case -> testimonial -> pricing -> FAQ -> final CTA
- generate extra detail images where necessary; deeply analyze all 8 sections; if one is still unclear, regenerate it cleanly instead of cropping
- keep sections open and not overboxed; then implement the full site from those references if requested

### Example 3
User: "creative agency landing page, 12 sections"

Interpretation:
- 12 horizontal images (one per section)
- Hero Scale: Giant Statement OR Mini Minimalist (decisive choice, not in-between)
- editorial / poster-like direction; off-grid composition appears 2-3 times
- multiple Background Modes (full-bleed image at hero + showcase, editorial side-image at case studies, solid + accent for process)
- palette consistent throughout, with one bold accent recurring
- closing CTA section: mini minimalist, strong type, single primary action

### Example 4
User: "make a premium creative agency website with 4 sections"

Interpretation:
- generate 4 separate section images
- keep the hero very clean
- ensure text remains readable
- deeply analyze each section
- do not use rough cutouts from the first renders
- regenerate clearer section images if needed
- avoid over-pilled microcopy and container overload
- then implement the site from those 4 references
