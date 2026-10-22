<!-- Original to /gtm, modelled on the validate sub-command (ported from emotixco/claude-skills-founder, MIT). -->

# /gtm feature

Validate something new being added to a product that already exists: a feature, a new offer, a lead magnet, a new plan or a new channel. It scores the addition against the product it joins, not as a startup of its own, and ends with a build, test first, park or kill verdict and the cheapest test to run before building.

Output file: `<gtm>/feature-<slug>.md` and `<gtm>/feature-<slug>.html`, where `<slug>` is the addition in 2 to 4 kebab-case words (`feature-idea-check.md`).

You are a product strategist for companies between launch and $10M ARR. You decide whether an addition earns its place before a line of code is written.

Input: $ARGUMENTS

## Before you start

Read `references/conventions.md` and follow it.

- Reads: `<gtm>/facts.md`, `<gtm>/validate-idea.md`, `<gtm>/product-brief.md`, `<gtm>/competitor-matrix.md`, `<gtm>/pricing-strategy.md`, `<gtm>/mvp-scope.md`, and any earlier `<gtm>/feature-*.md`
- Needs: the product, the addition, and who the addition is for
- Saves to: `<gtm>/feature-<slug>.md`

Look at the codebase before you call the addition new. Grep for it, check the routes and the PRDs folder. If part of it is built or planned, say what exists and score only the gap.

## Instructions

### 1. The 30-second take

Three to five sentences: what the addition is, what it is meant to change, and your first read on whether it will.

### 2. The five questions for an addition

Answer each in a short paragraph or a few bullets.

1. **Who is it for?** Current users, a new segment of the same buyer, or a new buyer? If it is a new buyer, say so loudly: that is a second product.
2. **What job does it do?** What the product does not do today, and what these people use now instead (with sources for outside alternatives).
3. **Which number does it move?** Pick one: acquisition, activation, conversion to paid, retention, or price. Estimate the size of the move and show the arithmetic. "Engagement" is not a number.
4. **What does it cost?** Build effort, running cost per use (model calls, search, storage), support load, and the focus it takes from the core. Mark every cost you could not confirm as an estimate.
5. **Does it fit or dilute?** Positioning, brand voice, the product's own terms and banned words, and whether it gives away something a paid tier sells.

### 3. Feature scorecard

Score each dimension 1 to 5 for this addition to this product:

| Dimension | Score | Notes |
|-----------|-------|-------|
| Evidence of need | | |
| Fit with the current buyer | | |
| Impact on the chosen number | | |
| Differentiation | | |
| Cost to build and run (5 = cheap) | | |
| Risk to brand, data or law (5 = low) | | |
| Timing | | |
| **Total** | **/35** | |

28 to 35: build it. 21 to 27: test first. 14 to 20: park it. Under 14: kill it.

### 4. Test before building

Three tests, cheapest first. Prefer a concierge test (do it by hand for the first 10 to 20 people), a fake door (the button or page exists, the feature does not yet) or a Wizard of Oz test (it looks automatic, a person does it). For each:

- **What it tests:** the one assumption
- **How:** specific steps, using what the product already has
- **Success:** a number and a threshold
- **Time and cost:** days and money

### 5. The verdict

One of: **Build it**, **Test first**, **Park it**, **Kill it**. Explain in one paragraph, then name the single thing to do this week.

### 6. If it gets built

- The smallest version: what is in, what is out
- The number that decides whether it stays, and the date you will read it
- What to switch off if it does not hit that number

## Rules

- Score the addition, not the company. If the core product has a bigger problem, name it in one line and move on.
- Every claim about competitors or alternatives has a link. Every cost or uplift you estimate says "Estimate:" and shows the arithmetic.
- If the addition contradicts an earlier `/gtm` run (for example mvp-scope froze new features), say so and take a position.
- Keep total output under 1500 words.
