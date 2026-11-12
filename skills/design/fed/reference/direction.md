# Setting a direction

For the Direct track: a new brand, a new marketing site, a portfolio, or a page with no visual system. SKILL.md lists the five decisions; this file is how to make them well. On Extend none of this applies: the brand has already decided.

## Start from the scene

Write one sentence of physical scene: who uses this, where, under what light, in what mood. Light or dark follows from it. A finance controller at a desk at 9am reads a light, calm surface; a night-time listening app may be dark. Neither is a default.

## Colour strategy

Pick the strategy before any colour:

| Strategy | What it is | Suits |
| --- | --- | --- |
| Restrained | Neutrals plus one accent | Tools, documentation, anything the visitor came to operate or read |
| Committed | One saturated colour carries 30 to 60 percent of the surface | A brand with one strong colour, a launch page |
| Full | Three or four named colour roles | Playful consumer products, editorial with sections |
| Drenched | The surface is the colour | A campaign page, a single-message launch |

Then:

- Name 4 to 6 values in oklch, each with a role (ground, ink, accent, the second neutral, a state).
- Neutrals carry a trace of the brand hue (chroma about 0.005 to 0.01); pure grey and pure black read as unfinished.
- Committed and Drenched colour works at page scale: fields that own whole regions, not small accents scattered over a neutral ground.
- One accent, used identically across every section.

## Choosing faces

- Choose a face the way you would choose an object from the subject's world: its era, its material, its trade, the way its people write. A face picked for its category ("tech wants mono", "books want a serif") is the guess the self-check catches.
- An app takes one family in several weights. A marketing page takes a display face and a body face, contrasting on one clear axis (serif and sans, condensed and wide, geometric and humanist). Two similar sans faces fight.
- System stacks and workhorse UI faces are right for tools; a marketing page wants a face with a point of view.
- Any face is allowed when a reason from the subject supports it. A face is wrong when the only reason is that it is fashionable or that it is not one of the faces you were told to avoid.

## Layout and first viewport

Describe the first viewport in words before code: what sits where, at what scale, and where the primary action is. If the description reads like a mood ("clean and modern"), the layout is not decided yet. The first viewport should show the product's mechanism, at the scale it has in life, rather than trap it inside a standard hero card.

## Signature

One element a visitor would describe an hour later: a type treatment, an interaction, a way the product is demonstrated, a colour field. One, executed fully, with restraint everywhere around it. Every flourish still passes the motion gate.

## Density and motion by surface

These replace numeric dials. Pick the row, then let the brief move you off it.

| Surface | Density | Motion |
| --- | --- | --- |
| Product UI (Extend) | Dense where data lives, regular elsewhere | 150 to 250 ms state changes, nothing else |
| Documentation and long reads | Regular; prose at 65 to 75ch | Almost none |
| Landing page for a product | Airy; one idea per section | One load or reveal moment, hover and press feedback |
| Portfolio or campaign | Airy to gallery-like | Can carry a scroll story when it shows the work |

## The self-check

After the five decisions, ask: could someone guess this from the category alone, or from the category plus the things you avoided? If yes, rework it. The guesses that recur across generated pages:

- Cream ground, high-contrast serif display, terracotta or signal-red accent.
- Near-black ground, one neon accent, glowing edges.
- Broadsheet hairlines, italic display serif, small tracked mono labels.
- Centred hero over a gradient blob or mesh.
- Three equal icon cards under the hero.
- A big-number stats strip under the hero.
- One italic serif word inside a sans headline.
- Geist or a similar neutral sans on zinc with one emerald or electric-blue button.
- Purple to indigo gradients.

Each is fine when the brief or the brand asks for it. Landing on one when nothing asked for it means a decision was skipped. A pinned world pins the world, not its softest rendition: a bookish subject spans book cloth, thread, jackets and endpapers in every colour, and cream paper is only the smallest corner of it.
