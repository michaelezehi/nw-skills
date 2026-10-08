// The two node outlines the state machine draws, from the Sketches repertoire
// ("journey-node" and "journey-decision"). The wobble is deliberate: these are
// hand-drawn paths, not rounded rectangles, and JourneyMachine stretches them
// to each node's fixed box.
//
// Brand-neutral — no palette here. Colour lives in JourneyMachine's constants.
// Re-export these from your `lib/rnd/user-journeys/sketches.ts` alongside the
// project's own icon set.

/** Wobbly rounded rectangle, authored in a 160x56 box. */
export const JOURNEY_NODE_D =
  "M20 8 q60 -5 122 2 q9 1 10 11 q1 12 -2 23 q-2 9 -11 9 q-60 5 -122 -2 q-9 -1 -10 -11 q-1 -12 2 -23 q2 -9 11 -9 z";
export const JOURNEY_NODE_W = 160;
export const JOURNEY_NODE_H = 56;

/** Wobbly decision diamond, authored in a 130x78 box. */
export const JOURNEY_DECISION_D =
  "M65 6 q30 15 58 33 q-28 19 -58 33 q-30 -14 -58 -33 q28 -18 58 -33 z";
export const JOURNEY_DECISION_W = 130;
export const JOURNEY_DECISION_H = 78;
