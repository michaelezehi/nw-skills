# The three acts

Every role page argues one case in the same shape. The argument is: *we hand
people the whole product before they have a reason to want any of it.*

## Act 1 · Getting in

The full registration and onboarding walk, every stop, in shipped order.

- One `machine` section, `defaultMode: "current"`.
- `detail` bullets carry the evidence: where the steps derive from, how many are
  skippable versus how many are shown, where the one real branch is.
- The sharpest line usually writes itself: *"7 of 16 onboarding steps are
  skippable, yet all 16 are presented to everyone."* Compute both numbers.

## Act 2 · Today

Everything the app hands them the moment onboarding ends.

- A phone-shell mockup of the real day-one home, labelled with real defaults.
- A table of every feature/module with its default on/off for this role.
- Chips for whatever is scoped to them (regions, fellowships, teams, plans).
- Chips for the always-on set — the things with no toggle at all.
- Close on the cost, in the app's own terms: all of it arrives before the person
  has hit the problem the app exists to solve.

## Act 3 · Proposed

The leaner path. Three moves, in this order:

1. **Bare bones** — a home seeded only by what they told you. The empty space is
   the point.
2. **A pathfinder ending** — onboarding ends with one real question that leads to
   one concrete next step, and every follow-up question ships with its answer
   already attached. Never ask something you cannot act on.
3. **Weeks one and two** — features arrive one at a time, each triggered by where
   the person actually is.

Then re-render the machine in `proposed` mode so the collapse is visible.

## Writing rules

- Plain strings, no i18n keys — R&D pages must not touch the host's translation
  gate.
- Sentences, not fragments. This is an argument a stakeholder reads, not a spec
  they parse.
- Never claim a number you did not compute from code.
- If something was found broken while mapping, say so on the page in a "what
  mapping already fixed" group. That is the most credible section you will write.
