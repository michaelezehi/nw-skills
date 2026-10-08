# Image Generation Rules

How many images to generate, at what format, and how to handle unclear or detail views.

## Hard output rule — one image per section

**Generate one separate horizontal image PER section. Always. No exceptions.**

- 1 section requested -> 1 image
- 2 sections -> 2 images
- 3 sections -> 3 images
- 4 sections requested -> 4 images
- 5 sections -> 5 images
- 6 sections -> 6 images
- 7 sections -> 7 images
- 8 sections requested -> 8 images
- 9 sections -> 9 images
- 10 sections -> 10 images
- 12 sections requested -> 12 images
- and so on when reasonable

Each image is one section, generated as its own image call. Never combine multiple sections into one frame. Never return a single tall image that contains the whole page.

- never combine multiple sections in a single image
- never return a single tall slice that contains the whole page
- never return one "best" image and skip the rest
- never replace several sections with one collage
- do not default to one giant multi-column collage or one long compressed board with tiny unreadable text

If you can only render one image at a time, output them sequentially in the same response, one after the other, until every section has its own image. Announce each one ("Section 1 of 8: Hero", "Section 2 of 8: Trust bar", etc.).

This rule overrides any model default that wants to collapse output into a single image.

Why one image per section is preferred:
- text stays readable
- typography becomes analyzable
- spacing stays visible
- button details stay visible
- layout proportions stay visible
- extraction quality becomes much better
- implementation becomes more faithful

Treat each section as its own analyzable unit:
- one section = one primary image
- one complex section = one primary image + one or more optional detail images
- one unclear section = regenerate it again as a fresh clean standalone image

## Default section counts when the request is ambiguous

Default high:
- "hero" -> 1 image
- "landing page" / "site template" -> default to 6 sections -> 6 images
- "full website" / "full website template" -> default to 8 sections -> 8 images
- "marketing site" -> default to 8 sections -> 8 images
- "product page" -> default to 6 sections -> 6 images
- "portfolio" -> default to 6 sections -> 6 images

The default section packs (4 / 8 / 12) are in `section-catalogue.md`.

## Format

- Always horizontal (16:9, 16:10, or 21:9 depending on density)
- Each image renders one focused section in high fidelity
- Hero usually 16:9 or 21:9; narrower content sections may be 16:10

Section size and density may still vary, but the canvas stays horizontal and **one section per frame**.

## Generate enough images rule

Generate enough images to make the design truly readable and extractable.

Do not be lazy with image count.

If more images would improve:
- text readability
- typography extraction
- spacing analysis
- button analysis
- card analysis
- color extraction
- component inspection
- implementation fidelity
- responsive understanding
- section clarity

then generate more images.

Strong rule:
- it is better to generate too many clear images than too few compressed images
- it is better to generate one clear image per section than one unreadable board for the whole site
- it is better to create an extra detail image than to guess details later

Never reduce image count just for convenience if that harms quality.

## Do not crop old images rule

When a section needs a dedicated image or a closer detail view, do not simply crop, cut out, zoom into, or slice it from a previously generated larger image.

Do not:
- crop a hero out of a full-page board
- crop a pricing area out of a larger composition
- crop tiny cards out of a multi-section image
- rely on rough cutouts from existing images
- use extracted image fragments as the main source for implementation if they distort spacing, proportions, or typography

Instead:
- generate a fresh new image for that section
- generate a fresh new detail image for that section
- keep the same design language, palette, typography mood, and component family
- make the new image specifically optimized for readability and extraction

Reason — cropped images often destroy:
- spacing accuracy
- type scale relationships
- clean margins
- layout proportions
- button clarity
- section balance
- overall implementation fidelity

Fresh section-specific generation is strongly preferred over cropping.

## Fresh re-generation rule

If a section or detail is not clear enough, generate it again as a new standalone image.

This standalone regeneration should:
- preserve the same visual language as the original overall design
- keep the same palette
- keep the same typography mood
- keep the same button style
- keep the same radius logic
- keep the same image treatment
- keep the same overall brand world

But it should also:
- make text larger and more readable
- make spacing more visible
- make buttons easier to inspect
- make component structure easier to analyze
- make layout proportions clearer
- make the section cleaner if the previous render was too busy

This is not a different design.
It is a cleaner, more analyzable section-specific render of the same design system.

## Optional detail / extraction image rule

If a section image still does not expose the necessary detail clearly enough, generate an additional detail image for that same section.

Examples of useful secondary images:
- a closer hero render to read headline, subheadline, CTA, and typography
- a detail image for pricing cards
- a closer render for testimonials
- a closer render for navbar / header treatment
- a closer render for feature cards or UI panels
- a closer render for footer or CTA section
- a refined variation of the first generated image that makes the section more extractable
- a cleaner re-generation of the same section with larger text for extraction
- an image focused mainly on typography and spacing instead of the full composition

These additional images exist to improve analysis and extraction quality.

Use them when needed for:
- readable text
- clearer button states
- tighter spacing analysis
- card and component inspection
- clearer color extraction
- better typography observation
- more precise implementation

Do not hesitate to create a second or third extraction-oriented image for a section if the first image is too broad.

## Continuity rule

Across all per-section images, enforce one brand world:
- same palette and accent logic
- same typography family and scale
- same CTA family (style variations are fine, identity is not)
- same border radius language
- same image treatment (color grade, materials, framing)
- same tonal voice in any short copy

A viewer scrolling through all frames must read them as one site.
