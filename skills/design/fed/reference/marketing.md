# Marketing pages

For landing pages, marketing sites, launch pages and portfolios on the Direct track. Distilled from Leonxlnx/taste-skill (sections 4.3 to 4.11 and the pre-flight in 14), without its rules that conflict with the house rules. When the product has a brand in the shared design system, its fonts, colours and corners stay; this file sets composition, content and motion.

Contents: hero, navigation, calls to action, sections and layout families, eyebrows, cards and shape, images, content density, quotes and logos, theme, motion, copy self-audit, pre-flight.

## Hero

- It fits the first viewport at desktop: the primary action is visible without scrolling.
- At most four text elements: an eyebrow or a brand strip (zero or one), the headline, the subtext, the calls to action (one primary, at most one secondary).
- Headline at most two lines at desktop. Plan the type size and the visual together: `text-4xl md:text-5xl lg:text-6xl` suits most heroes; `text-6xl md:text-7xl` only for a three to five word headline. A four-line headline is a size error, not a copy error.
- Subtext at most 20 words and four lines. If the value cannot be said in 20 words, the value is unclear.
- Top padding at most `pt-24` at desktop. More reads as a layout bug; give room through type or visual scale instead.
- Trust strips, logo walls, pricing teasers, feature bullets and avatar rows go in the section directly below, never inside the hero.
- One real visual. Text over a gradient blob is a placeholder, not a hero.
- Centred or split is a choice from the content: a split suits a product with something to show; a centred stack suits a manifesto or a launch where the words are the design.

## Navigation

- One line at desktop. If the items do not fit at 1024 px, shorten labels, drop secondary items, or move to a menu.
- 64 to 72 px tall, never over 80 px.

## Calls to action

- One label per intent across the whole page: "Get in touch", "Contact us" and "Let's talk" are one intent, so pick one and use it in nav, hero and footer.
- Primary labels are one to three words and fit one line; widen the button or shorten the label, never cap the width.
- Every button passes AA contrast against its own background, including ghost buttons over photos (use a scrim, a backdrop or a stroke).

## Sections and layout families

- A layout family (three image cards, full-width quote, text and image split, bento, marquee, stacked) appears once per page. Eight sections use at least four families.
- At most two text and image splits in a row; the third breaks into a different family.
- A section header is one message: headline with the body stacked below at 65ch, not a big headline left and a small paragraph floating right, unless the right column carries a visual.
- Bento grids have exactly as many cells as items, vary their sizes, and give two or three cells real visual material (an image, a tint, a pattern), not text on white.
- Every multi-column section declares its layout below 768 px in the same component.

## Eyebrows

A small uppercase tracked label above a headline. At most one per three sections, and the hero counts as one. Count them before you finish. Usually the headline is enough; the section's place on the page already categorises it. Section numbers (`01 / Capabilities`) are not a substitute.

## Cards and shape

- Cards only where elevation means hierarchy; otherwise group with `divide-y`, a top rule or space.
- Shadows tinted to the background hue, never pure black.
- One corner system for the page (all sharp, all soft, or pill controls with stated card radii), applied everywhere.

## Images

- Product and brand pages need real images: the user's assets, a generated image when an image tool is available and the brief suits it, or open-licence photography.
- When none exists, leave labelled slots (`<!-- hero product photo, 1600x1200 -->`) and list them in the report.
- Never draw a fake product screenshot out of `div`s. Show the real component at small scale, a real screenshot, or skip the preview.
- Illustration comes from the shared design system's art or the `sketches` skill, not hand-drawn SVG paths.
- No captions or pills laid over images as decoration.

## Content density

- A section is a short headline (about eight words), a short paragraph (about 25 words) and one visual or one action. More needs a reason.
- No data dumps: show the top three to five and link the full list.
- More than five items: group them, use cards, tabs, an accordion or a carousel rather than a long ruled list.
- Numbers come from real data or are labelled as samples. Never invent precise figures.
- One copy register per page.

## Quotes and logos

- A quote is at most three lines; cut a longer one. Attribution is name, role and company, set on its own line.
- A logo wall is logos only, real SVG marks, readable in the page's theme, placed below the hero.

## Theme

One theme for the page. Sections do not flip between light and dark, except one deliberate switch the brief asks for. Tints within the same family are fine.

## Motion

- Motion only where it explains, directs attention or gives feedback. There is no quota; a still page that reads well is finished.
- One orchestrated load or reveal moment beats a reveal on every block.
- Pinned or scrubbed scroll stories use GSAP ScrollTrigger; everything else uses Motion (`motion/react`). Never both in one component tree.
- At most one marquee per page. No scroll cues ("Scroll to explore").

## Copy self-audit

Read every visible string once: headlines, labels, buttons, alt text, footer. Rewrite anything grammatically broken, with an unclear referent, cute wordplay that does not track, or mock-poetic filler. A plain functional sentence beats clever copy. Then the house copy rules: no em or en dash, straight quotes, sentence case, no "AI".

## Pre-flight

Before you report, by reading the code:

- [ ] Track line written; brand tokens used where a brand exists
- [ ] Hero fits: two-line headline, subtext of 20 words or fewer, action visible, four text elements at most, `pt-24` at most
- [ ] Nav on one line, 80 px or less
- [ ] One label per intent; every label fits one line; button contrast AA
- [ ] No layout family twice; no third split in a row; bento cell count equals item count
- [ ] Eyebrows at most one per three sections
- [ ] One theme, one accent, one corner system
- [ ] Real images or labelled slots; no fake screenshots
- [ ] Quotes three lines or fewer; logo wall is logos only
- [ ] Every motion has a one-sentence purpose; reduced motion honoured
- [ ] `min-h-[100dvh]`, never `h-screen`; mobile layout declared per section
- [ ] Copy self-audit done
