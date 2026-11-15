# Zoom flow: a camera that follows the clicks in a screen recording

Use this for any shot of software on screen: a narrated how-to, a product
walkthrough, a UI demo inside a promo, a screencast. The camera pushes in on a
press now and then, pans between presses that sit close together, holds, and
eases back out. Motion blur shows only while the camera moves.

The numbers were tuned over 36 narrated how-to takes of a web app. Each one
carries the reason it was changed.

## The rules

1. **Log the presses, zoom afterwards.** Record the screen flat, at full size,
   and write every press to a log: seconds from the start, x, y in recording
   pixels. The zoom is a separate pass over the recording and the log, so it
   can be retuned without recording again. Encode the raw take near lossless
   (crf 14 or better), because the zoom magnifies it.
2. **Push in now and then, not on every press.** A push on every press reads
   as constant motion. A push now and then lands harder.
3. **Push gently.** 1.25x. At 1.55x the camera cropped dialogs and hid the
   page around them, so the viewer could not see what the click changed.
4. **Aim near the press, not on it.** Aim 40 percent of the way from the
   press back to the centre of the screen, so the shot keeps the page around
   the press. Keep the zoomed window inside the frame.
5. **Never crop what the click changed.** At 1.25x the window is 80 percent
   of the frame each way. If the press opens a dialog, menu or panel larger
   than that, skip the shot for that press and stay wide. The camera code
   cannot see this: look at the peak still of each shot, and remove the press
   from the log when the shot crops what it opened.
6. **Arrive before the press.** Ease in over 0.55 s and land 0.08 s before
   the press, so the viewer is already close when it happens.
7. **Join nearby presses into one shot.** A press within 1.8 s and 700 px of
   the previous one joins its shot, and the camera pans to it over 0.45 s,
   landing just before it. A shot never follows more than 2 s of presses: a
   run of quick clicks used to merge into one shot that stayed zoomed for most
   of the clip.
8. **Hold, then ease out slower than you came in.** Hold 0.9 s after the last
   press of the shot, then ease out over 0.85 s. The slower, blurrier pull
   back reads as one move instead of a stop.
9. **Stay wide between shots.** After a shot has pulled out, stay wide at
   least 4 s before the next one starts. A shot that would start sooner is
   skipped, not merged into the one before.
10. **Never zoom in the last second.** A shot that cannot pull back out
    before the clip ends has its hold cut short. If that leaves less than
    0.35 s after its last press, drop the shot.
11. **Blur only while moving.** Blur follows how far the frame travels in one
    frame, so a still camera is always sharp. The pull back blurs harder than
    the push in.
12. **Ease with a cubic in-out curve** on every move: zoom in, pan, zoom out.
    No spring overshoot; a whole screen that overshoots reads as a wobble.

A healthy clip ends up with 1 to 7 shots and spends 11 to 51 percent of its
length zoomed or easing (measured over the 36 takes). Before the sparse rules,
one clip stayed zoomed 85 percent of the time and another ended still zoomed.
If a clip comes out zoomed for more than about half its length, the rules are
not being applied.

## The numbers

| Setting | Value | Why |
|---|---|---|
| zoom | 1.25 | 1.55 cropped dialogs and hid what the click changed |
| centreBias | 0.4 | keeps the page around the press in the shot |
| inSec | 0.55 | push in over this long |
| leadSec | 0.08 | land just before the press, not on it |
| joinSec | 1.8 | presses closer than this in time share a shot |
| joinPx | 700 | and closer than this on screen |
| maxSpanSec | 2 | longest run of presses one shot follows |
| panSec | 0.45 | pan between presses in one shot |
| holdSec | 0.9 | stay in after the last press |
| minHoldSec | 0.35 | never cut a hold shorter than this; drop the shot instead |
| outSec | 0.85 | pull back out; was 0.6 and read as a stop |
| minWideSec | 4 | stay wide this long between shots |
| maxBlurPx | 6 | blur cap while pushing in or panning |
| outBlurBoost | 1.8 | the pull back blurs harder, so it reads as one move |
| maxOutBlurPx | 10 | blur cap while pulling out |
| blur floor | 0.35 px | below this, no blur at all |

Blur in px is `travel * 0.09`, where travel is how far the frame centre moved
on screen in one frame plus how far the edges moved from the change in scale:
`hypot(dcx * scale, dcy * scale) + |dscale| * width / 2`. On the pull back it is
multiplied by 1.8. ffmpeg's `gblur` and SVG's `feGaussianBlur` take a sigma;
use `blurPx * 0.6`.

## The camera, as code

One module for every toolchain. Plan the shots once from the log, then read
the camera at any time.

```ts
// zoomCamera.ts: plan shots from a click log once, then read the camera at any time.
export const CAMERA = {
  zoom: 1.25, centreBias: 0.4, inSec: 0.55, leadSec: 0.08,
  joinSec: 1.8, joinPx: 700, maxSpanSec: 2, panSec: 0.45,
  holdSec: 0.9, minHoldSec: 0.35, outSec: 0.85, minWideSec: 4,
  maxBlurPx: 6, outBlurBoost: 1.8, maxOutBlurPx: 10,
};
export type Click = { t: number; x: number; y: number };
export type Shot = { start: number; end: number; clicks: Click[] };

const ease = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

export function buildShots(clicks: Click[], duration: number): Shot[] {
  const C = CAMERA;
  const groups: Shot[] = [];
  for (const c of [...clicks].sort((a, b) => a.t - b.t)) {
    const g = groups.at(-1);
    const p = g?.clicks.at(-1);
    const near = g && p && c.t - p.t <= C.joinSec && c.t - g.clicks[0].t <= C.maxSpanSec
      && Math.hypot(c.x - p.x, c.y - p.y) <= C.joinPx;
    if (near) g.clicks.push(c);
    else groups.push({ start: 0, end: 0, clicks: [c] });
  }
  const kept: Shot[] = [];
  for (const s of groups) {
    const last = s.clicks[s.clicks.length - 1];
    s.start = Math.max(0, s.clicks[0].t - C.leadSec - C.inSec);
    s.end = Math.min(duration, last.t + C.holdSec);
    const prev = kept.at(-1);
    // Too soon after the last shot: skip it, never merge it.
    if (prev && s.start < prev.end + C.outSec + C.minWideSec) continue;
    // Cannot pull back out before the end: shorten the hold, or drop the shot.
    if (s.end + C.outSec > duration) {
      s.end = duration - C.outSec;
      if (s.end < last.t + C.minHoldSec) continue;
    }
    kept.push(s);
  }
  return kept;
}

function rawCamera(shots: Shot[], t: number, w: number, h: number) {
  const C = CAMERA;
  const shot = shots.find((s) => t >= s.start && t <= s.end + C.outSec);
  if (!shot) return { scale: 1, cx: w / 2, cy: h / 2 };
  const zin = ease(clamp01((t - shot.start) / C.inSec));
  const zout = ease(clamp01((t - shot.end) / C.outSec));
  const scale = 1 + (C.zoom - 1) * zin * (1 - zout);
  let { x, y } = shot.clicks[0];
  for (const next of shot.clicks.slice(1)) {
    // Pan to each next press, landing just before it.
    const panEnd = next.t - C.leadSec;
    const k = ease(clamp01((t - (panEnd - C.panSec)) / C.panSec));
    if (k <= 0) break;
    x += (next.x - x) * k;
    y += (next.y - y) * k;
  }
  x += (w / 2 - x) * C.centreBias;
  y += (h / 2 - y) * C.centreBias;
  const hw = w / (2 * scale);
  const hh = h / (2 * scale);
  return { scale, cx: Math.min(w - hw, Math.max(hw, x)), cy: Math.min(h - hh, Math.max(hh, y)) };
}

/** Camera at time t: scale, the source point to centre (cx, cy), and blur in px. */
export function cameraAt(shots: Shot[], t: number, fps: number, w: number, h: number) {
  const C = CAMERA;
  const now = rawCamera(shots, t, w, h);
  const prev = rawCamera(shots, t - 1 / fps, w, h);
  const travel =
    Math.hypot((now.cx - prev.cx) * now.scale, (now.cy - prev.cy) * now.scale) +
    Math.abs(now.scale - prev.scale) * (w / 2);
  const blur = now.scale < prev.scale
    ? Math.min(C.maxOutBlurPx, travel * 0.09 * C.outBlurBoost)
    : Math.min(C.maxBlurPx, travel * 0.09);
  return { ...now, blurPx: blur < 0.35 ? 0 : blur };
}
```

## Getting a click log

- **Scripted capture (Playwright, CDP screencast):** push `{ t, x, y }` at the
  moment of each `mouse.down`, with `t` measured from the first frame and x, y
  in viewport pixels. Write it beside the take as `<id>.events.json`:
  `{ "durationSec", "width", "height", "clicks": [{ "t", "x", "y" }] }`.
  Also draw a cursor into the page: headless Chrome paints none.
- **Footage you did not script:** scrub it and note the frame and position of
  each press by hand. A dozen presses take a few minutes.
- If the take has jump cuts, log times after the cuts, on the final timeline.

## Applying it

### ffmpeg (no framework)

The cheapest route, and the one the numbers were tuned on. Compute the camera
for every frame, write it as ffmpeg commands, and crop, scale back and blur in
one pass. Retuning means editing `CAMERA` and running the pass again; nothing
is recorded twice.

```js
// One line per frame for ffmpeg's sendcmd filter. W, H: recording size.
const lines = [];
for (let n = 0; n <= Math.ceil(durationSec * fps); n++) {
  const t = n / fps;
  const cam = cameraAt(shots, t, fps, W, H);
  const w = Math.min(W, Math.round(W / cam.scale / 2) * 2); // even sizes keep yuv420 aligned
  const h = Math.min(H, Math.round(H / cam.scale / 2) * 2);
  const x = Math.round(Math.min(W - w, Math.max(0, cam.cx - w / 2)));
  const y = Math.round(Math.min(H - h, Math.max(0, cam.cy - h / 2)));
  lines.push(`${t.toFixed(4)} crop@c w ${w}, crop@c h ${h}, crop@c x ${x}, crop@c y ${y}, gblur@b sigma ${(cam.blurPx * 0.6).toFixed(2)};`);
}
fs.writeFileSync('cmds.txt', lines.join('\n'));
```

```bash
ffmpeg -y -i raw.webm -filter_complex \
  "[0:v]sendcmd=f='cmds.txt',crop@c=w=W:h=H:x=0:y=0:exact=1,scale=W:H:flags=lanczos,gblur@b=sigma=0,format=yuv420p" \
  -r 30 -c:v libvpx-vp9 -crf 30 -b:v 0 -row-mt 1 -an zoomed.webm
```

Replace `W` and `H` in the filter with the recording size. Print the shot
count per take and check it against the 1 to 7 range above.

### Remotion

Put the module above in the project as `zoomCamera.ts`, import the click log,
and drive one wrapper around the footage. Keep the composition at the
recording's size, or multiply cx and cy by `width / log.width`.

```tsx
import React, { useMemo } from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildShots, cameraAt, type Click } from './zoomCamera';

type Log = { durationSec: number; clicks: Click[] };

export const ZoomedTake: React.FC<{ src: string; log: Log }> = ({ src, log }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const shots = useMemo(() => buildShots(log.clicks, log.durationSec), [log]);
  const cam = cameraAt(shots, frame / fps, fps, width, height);
  const id = `zoom${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={id}>
          <feGaussianBlur stdDeviation={cam.blurPx * 0.6} edgeMode="duplicate" />
        </filter>
      </svg>
      <AbsoluteFill
        style={{
          transformOrigin: '50% 50%',
          transform: `scale(${cam.scale}) translate(${width / 2 - cam.cx}px, ${height / 2 - cam.cy}px)`,
          filter: cam.blurPx > 0 ? `url(#${id})` : undefined,
        }}
      >
        <OffthreadVideo src={staticFile(src)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- The blur is an SVG filter on purpose. CSS `filter: blur()` on a full-frame
  layer makes Chromium render tiled mosaic or black frames at random.
- To write a move with Remotion's own helpers instead, key `interpolate` to
  the shot times in frames with the same cubic curve:
  `interpolate(frame, [shot.start * fps, (shot.start + 0.55) * fps], [1, 1.25], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })`.
  Use `spring` only with enough damping that it never overshoots.

### Hyperframes

Animate a non-timed inner wrapper inside the clip, never the timed clip
element. Run `buildShots` when the composition script loads (positions are
precomputed constants, never measured at tween time) and author one tween per
move on the paused timeline. GSAP's `power2.inOut` is the cubic in-out curve.

```js
// W, H: composition size, equal to the recording size. shots: buildShots(log.clicks, log.durationSec).
const Z = 1.25, BIAS = 0.4, el = '#take .inner';
const aim = (c) => {
  const hw = W / (2 * Z), hh = H / (2 * Z);
  const x = Math.min(W - hw, Math.max(hw, c.x + (W / 2 - c.x) * BIAS));
  const y = Math.min(H - hh, Math.max(hh, c.y + (H / 2 - c.y) * BIAS));
  return { x: Z * (W / 2 - x), y: Z * (H / 2 - y) }; // translate that centres the aim
};
for (const s of shots) {
  tl.to(el, { scale: Z, ...aim(s.clicks[0]), duration: 0.55, ease: 'power2.inOut' }, s.start);
  for (const c of s.clicks.slice(1)) {
    tl.to(el, { ...aim(c), duration: 0.45, ease: 'power2.inOut' }, c.t - 0.08 - 0.45);
  }
  tl.to(el, { scale: 1, x: 0, y: 0, duration: 0.85, ease: 'power2.inOut' }, s.end);
}
```

For blur, the moving thing is the whole screen, so use the engine's
`motionBlur` render option, which smears only the frames where the wrapper
travels. Read the `hyperframes-animation` skill's `references/motion-blur.md` before
choosing between it and the `motion-blur` component; the component copies the
whole subtree, which is costly on a full-frame video.

## Check before you ship

- Count shots per clip and the share of the clip spent zoomed or easing.
  Expect 1 to 7 shots and 11 to 51 percent.
- Look at one still at the peak of each shot: the thing the click opened or
  changed is fully in frame.
- The last second of every clip is wide.
- Stills between moves are sharp. Blur only appears on frames where the
  camera moves.
