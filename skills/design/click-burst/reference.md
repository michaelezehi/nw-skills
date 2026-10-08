# Click Burst — Reference Implementation

Copy into `components/shared/BurstOverlay.tsx` (adjust import alias to match the project).

**Dependency:** `motion/react` (Framer Motion v12). `"use client"` required in Next.js App Router.

## Config type

```ts
export interface BurstConfig {
  /** Full animation duration in ms */
  durationMs: number;
  /** Delay before onNavigate runs after click */
  navigateDelayMs: number;
  initialScale: number;
  finalScale: number;
  initialOpacity: number;
  finalOpacity: number;
  ease: [number, number, number, number];
  /** Base gradient disc size (CSS length) */
  discSize: string;
  zIndex: number;
}

export const DEFAULT_BURST_CONFIG: BurstConfig = {
  durationMs: 2000,
  navigateDelayMs: 760,
  initialScale: 0,
  finalScale: 6,
  initialOpacity: 0.62,
  finalOpacity: 0,
  ease: [0.22, 1, 0.36, 1],
  discSize: "50vmax",
  zIndex: 99998,
};
```

## Preset colors

```ts
export const BURST_COLORS = {
  purple: "rgba(178, 128, 255, 0.70)",
  pink: "rgba(255, 151, 220, 0.70)",
  teal: "rgba(95, 232, 222, 0.70)",
  brand: "rgba(232, 74, 12, 0.65)",
  gold: "rgba(212, 148, 74, 0.65)",
} as const;
```

## Full component file

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

export interface BurstConfig {
  durationMs: number;
  navigateDelayMs: number;
  initialScale: number;
  finalScale: number;
  initialOpacity: number;
  finalOpacity: number;
  ease: [number, number, number, number];
  discSize: string;
  zIndex: number;
}

export const DEFAULT_BURST_CONFIG: BurstConfig = {
  durationMs: 2000,
  navigateDelayMs: 760,
  initialScale: 0,
  finalScale: 6,
  initialOpacity: 0.62,
  finalOpacity: 0,
  ease: [0.22, 1, 0.36, 1],
  discSize: "50vmax",
  zIndex: 99998,
};

export const BURST_COLORS = {
  purple: "rgba(178, 128, 255, 0.70)",
  pink: "rgba(255, 151, 220, 0.70)",
  teal: "rgba(95, 232, 222, 0.70)",
  brand: "rgba(232, 74, 12, 0.65)",
  gold: "rgba(212, 148, 74, 0.65)",
} as const;

export interface BurstOverlayProps {
  x: number;
  y: number;
  color: string;
  onDone?: () => void;
  config?: Partial<BurstConfig>;
}

function mergeConfig(partial?: Partial<BurstConfig>): BurstConfig {
  return { ...DEFAULT_BURST_CONFIG, ...partial };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BurstOverlay({ x, y, color, onDone, config: configPartial }: BurstOverlayProps) {
  const config = mergeConfig(configPartial);

  if (typeof document === "undefined") return null;

  if (prefersReducedMotion()) {
    onDone?.();
    return null;
  }

  const halfDisc = `calc(${config.discSize} / 2)`;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: config.zIndex }}
    >
      <motion.div
        initial={{ scale: config.initialScale, opacity: config.initialOpacity }}
        animate={{ scale: config.finalScale, opacity: config.finalOpacity }}
        transition={{
          duration: config.durationMs / 1000,
          ease: config.ease,
        }}
        onAnimationComplete={onDone}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: config.discSize,
          height: config.discSize,
          marginLeft: `calc(-1 * ${halfDisc})`,
          marginTop: `calc(-1 * ${halfDisc})`,
          borderRadius: "50%",
          willChange: "transform, opacity",
          background: `radial-gradient(circle, ${color} 0%, ${color} 10%, color-mix(in srgb, ${color} 45%, transparent) 30%, transparent 68%)`,
        }}
      />
    </div>,
    document.body,
  );
}

interface BurstState {
  x: number;
  y: number;
  color: string;
  id: number;
}

export function useBurstController(configPartial?: Partial<BurstConfig>) {
  const config = mergeConfig(configPartial);
  const [burst, setBurst] = useState<BurstState | null>(null);
  const counterRef = useRef(0);

  const fireBurst = useCallback((
    x: number,
    y: number,
    color: string,
    onNavigate?: () => void,
  ) => {
    if (prefersReducedMotion()) {
      onNavigate?.();
      return;
    }

    counterRef.current += 1;
    setBurst({ x, y, color, id: counterRef.current });

    if (onNavigate) {
      window.setTimeout(onNavigate, config.navigateDelayMs);
    }
  }, [config.navigateDelayMs]);

  const fireBurstFromElement = useCallback((
    element: HTMLElement | null,
    color: string,
    onNavigate?: () => void,
  ) => {
    if (!element) {
      onNavigate?.();
      return;
    }

    const rect = element.getBoundingClientRect();
    fireBurst(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      color,
      onNavigate,
    );
  }, [fireBurst]);

  const burstNode = (
    <AnimatePresence>
      {burst && (
        <BurstOverlay
          key={burst.id}
          x={burst.x}
          y={burst.y}
          color={burst.color}
          config={configPartial}
          onDone={() => setBurst(null)}
        />
      )}
    </AnimatePresence>
  );

  return { burstNode, fireBurst, fireBurstFromElement, config };
}

export function BurstTrigger({
  config,
  children,
}: {
  config?: Partial<BurstConfig>;
  children: (
    fire: (x: number, y: number, color: string, onNavigate?: () => void) => void,
  ) => React.ReactNode;
}) {
  const { burstNode, fireBurst } = useBurstController(config);

  return (
    <>
      {children(fireBurst)}
      {burstNode}
    </>
  );
}
```

## Performance notes

- The soft edge is **gradient falloff + GPU scale**, not CSS blur.
- `willChange: transform, opacity` hints compositor promotion for the burst disc only.
- Keep hover interactions on sibling UI to opacity/transform — never `filter: blur()` on expanding panels.

## Pace presets

```ts
export const BURST_PACE = {
  /** Default — masks route change */
  navigation: { durationMs: 2000, navigateDelayMs: 760 },
  /** Cosmetic feedback only, action runs immediately */
  instant: { durationMs: 1400, navigateDelayMs: 0 },
  /** Slower, more dramatic */
  cinematic: { durationMs: 2800, navigateDelayMs: 900 },
} as const;

// Usage:
useBurstController({ ...BURST_PACE.instant });
```
