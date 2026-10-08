# Click Burst — Examples

## 1. Button with delayed navigation (default pace)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useBurstController, BURST_COLORS } from "@/components/shared/BurstOverlay";

export function ContinueButton() {
  const router = useRouter();
  const { burstNode, fireBurstFromElement } = useBurstController();

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          fireBurstFromElement(
            event.currentTarget,
            BURST_COLORS.brand,
            () => router.push("/dashboard"),
          );
        }}
      >
        Continue
      </button>
      {burstNode}
    </>
  );
}
```

## 2. Card picker — burst from icon center on click only

```tsx
const clickingRef = useRef(false);
const iconRef = useRef<HTMLDivElement>(null);

const handleCardClick = () => {
  if (clickingRef.current) return;
  clickingRef.current = true;

  const el = iconRef.current;
  if (!el) {
    onPick();
    return;
  }

  const rect = el.getBoundingClientRect();
  fireBurst(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    BURST_COLORS.purple,
    onPick,
  );
};

// Hover may expand cards — but must NOT call fireBurst
```

## 3. Instant action + cosmetic burst

```tsx
const { burstNode, fireBurstFromElement } = useBurstController({
  durationMs: 1400,
  navigateDelayMs: 0,
});

<button
  onClick={(e) => {
    fireBurstFromElement(e.currentTarget, BURST_COLORS.teal);
    setTab("changes"); // runs immediately
  }}
>
  Changes
</button>
```

## 4. Custom color and cinematic pace

```tsx
const { burstNode, fireBurstFromElement } = useBurstController({
  durationMs: 2800,
  navigateDelayMs: 900,
  finalScale: 7,
  initialOpacity: 0.72,
});

fireBurstFromElement(
  event.currentTarget,
  "rgba(34, 197, 94, 0.55)", // one-off green
  () => router.push("/success"),
);
```

## 5. Render-prop wrapper

```tsx
<BurstTrigger config={{ navigateDelayMs: 760 }}>
  {(fire) => (
    <button
      type="button"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        fire(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          BURST_COLORS.gold,
          () => doSomething(),
        );
      }}
    >
      Get started
    </button>
  )}
</BurstTrigger>
```

## 6. Multiple buttons, one burst controller

Mount `burstNode` once at the feature root; pass `fireBurstFromElement` to child handlers. Each click increments the internal id so `AnimatePresence` replays cleanly.

```tsx
export function Toolbar({ onBack, onSave }: Props) {
  const { burstNode, fireBurstFromElement } = useBurstController();

  return (
    <>
      <button onClick={(e) => fireBurstFromElement(e.currentTarget, BURST_COLORS.pink, onBack)}>
        Back
      </button>
      <button onClick={(e) => fireBurstFromElement(e.currentTarget, BURST_COLORS.brand, onSave)}>
        Save
      </button>
      {burstNode}
    </>
  );
}
```
