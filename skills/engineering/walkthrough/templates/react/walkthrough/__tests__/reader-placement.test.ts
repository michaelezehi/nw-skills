// Where the reader sits: its usual side, the other side when that covers
// what the step is about, a bottom panel when both sides would, else the
// place that covers least. A right-to-left page mirrors the sides.

import { describe, expect, it } from 'vitest';

import { choosePlacement, placementBox, type Box, type PlacementFrame } from '../reader-placement';

const FRAME: PlacementFrame = { width: 1440, height: 900, readerWidth: 380, top: 84, bottomGap: 92, rtl: false };
const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe('choosePlacement', () => {
  it('keeps the usual side when nothing is under it', () => {
    expect(choosePlacement([box(300, 200, 200, 60)], FRAME)).toBe('end');
    expect(choosePlacement([], FRAME)).toBe('end');
  });

  it('moves to the other side when the subject is on the right', () => {
    // A card down the right side of the page.
    expect(choosePlacement([box(1000, 260, 420, 600)], FRAME)).toBe('start');
  });

  it('drops to the bottom rather than cross over a subject on each side', () => {
    expect(choosePlacement([box(1100, 120, 200, 80), box(40, 120, 200, 80)], FRAME)).toBe('bottom');
  });

  it('takes the place that covers least when every place covers something', () => {
    const wide = box(0, 100, 1440, 420);
    const nub = box(1300, 120, 40, 40);
    expect(choosePlacement([wide, nub], FRAME)).toBe('bottom');
  });

  it('mirrors the sides on a right-to-left page', () => {
    const rtl = { ...FRAME, rtl: true };
    expect(placementBox('end', rtl).left).toBe(16);
    expect(choosePlacement([box(20, 200, 300, 300)], rtl)).toBe('start');
  });
});
