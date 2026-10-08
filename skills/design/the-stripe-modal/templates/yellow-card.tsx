"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardTone =
  | "primary"
  | "butter"
  | "honey"
  | "wheat"
  | "slate"
  | "beaver"
  | "mint";

interface Props {
  children: ReactNode;
  className?: string;
  /**
   * Renders the card with `group` so children can use `group-hover:` to react
   * to interactive parents (Link, button). Default true.
   */
  groupRoot?: boolean;
  /**
   * Color palette. Defaults to `"primary"` — the brand surface. Other tones
   * share the same dot pattern + emboss treatment with palette-shifted
   * gradients and shadows.
   */
  tone?: CardTone;
  /**
   * Drop shadow + inner highlight. Default true. Pass `false` to flatten the
   * card onto its surface (used where the card is the primary surface and
   * shouldn't lift off the page).
   */
  shadow?: boolean;
}

interface Palette {
  background: string;
  shadow: string;
  text: string;
}

// Editorial-press palettes. `primary` is the loud brand asset; the rest are
// pastels and neutrals that recede so the primary always wins the eye first.
// Swap `primary`'s gradient + shadow values to retheme without touching the
// rest of the system. New tones can be appended freely.
const PALETTES: Record<CardTone, Palette> = {
  // {{THEME_PRIMARY_START}}
  primary: {
    background:
      "linear-gradient(155deg, hsl(48 100% 67%) 0%, hsl(48 96% 53%) 45%, hsl(42 95% 55%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -12px rgba(202,138,4,0.45), 0 2px 6px -2px rgba(202,138,4,0.25)",
    text: "text-zinc-900",
  },
  // {{THEME_PRIMARY_END}}
  butter: {
    background:
      "linear-gradient(155deg, hsl(50 100% 94%) 0%, hsl(48 88% 88%) 45%, hsl(45 75% 82%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 30px -12px rgba(202,138,4,0.22), 0 2px 6px -2px rgba(202,138,4,0.12)",
    text: "text-zinc-900",
  },
  honey: {
    background:
      "linear-gradient(155deg, hsl(40 100% 88%) 0%, hsl(36 86% 80%) 45%, hsl(32 78% 74%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -12px rgba(180,120,30,0.28), 0 2px 6px -2px rgba(180,120,30,0.15)",
    text: "text-zinc-900",
  },
  wheat: {
    background:
      "linear-gradient(155deg, hsl(35 45% 92%) 0%, hsl(32 35% 86%) 45%, hsl(28 30% 80%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 30px -12px rgba(120,90,55,0.22), 0 2px 6px -2px rgba(120,90,55,0.12)",
    text: "text-zinc-900",
  },
  slate: {
    background:
      "linear-gradient(155deg, hsl(220 14% 96%) 0%, hsl(220 13% 91%) 45%, hsl(220 13% 85%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 30px -12px rgba(15,23,42,0.18), 0 2px 6px -2px rgba(15,23,42,0.10)",
    text: "text-zinc-900",
  },
  beaver: {
    background:
      "linear-gradient(155deg, hsl(28 55% 70%) 0%, hsl(25 50% 56%) 45%, hsl(22 48% 46%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.55) inset, 0 10px 30px -12px rgba(120,75,30,0.45), 0 2px 6px -2px rgba(120,75,30,0.25)",
    text: "text-zinc-900",
  },
  mint: {
    background:
      "linear-gradient(155deg, hsl(160 65% 78%) 0%, hsl(160 55% 60%) 45%, hsl(165 55% 50%) 100%)",
    shadow:
      "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -12px rgba(20,120,90,0.4), 0 2px 6px -2px rgba(20,120,90,0.22)",
    text: "text-zinc-900",
  },
};

/**
 * Editorial-press card surface with a risograph-style dot pattern.
 *
 * Layered visual treatment:
 *  - Diagonal gradient base (tone-driven)
 *  - Risograph dot pattern, masked with a vertical gradient so dots
 *    fade to transparent as they approach the top edge — keeps the title
 *    crisp while letting the texture breathe at the bottom.
 *  - Soft white glow that fades in on hover from the top-right corner
 *  - Inset white highlight + tone-tinted drop shadow for printed-card depth
 *
 * Use as a wrapping presentation layer; pair with <Link>/<button> as needed.
 */
export function YellowCard({
  children,
  className,
  groupRoot = true,
  tone = "primary",
  shadow = true,
}: Props) {
  const palette = PALETTES[tone];
  return (
    <div
      className={cn(
        "relative rounded-2xl ring-1 ring-zinc-900/10 transition-all overflow-hidden",
        shadow && "hover:ring-zinc-900/20 hover:-translate-y-0.5",
        palette.text,
        groupRoot && "group",
        className
      )}
      style={{
        background: palette.background,
        boxShadow: shadow ? palette.shadow : undefined,
      }}
    >
      {/* Reversed-emboss dot pattern — each dot is a tiny dimple pressed
          into the surface. Top-left rim sits in shadow, bottom-right
          catches the light, so the texture reads as recessed rather than
          raised. Bottom-anchored mask keeps the top of the card clean. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.13) 0.55px, transparent 1.4px)",
            "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 0.55px, transparent 1.4px)",
          ].join(", "),
          backgroundSize: "13px 13px, 13px 13px",
          backgroundPosition: "0 0, 0 0",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Hover glow — top-right warm white spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-opacity"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.55), transparent 70%)",
        }}
      />

      {/* Top inner highlight — sells the printed-card depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />

      <div className="relative h-full">{children}</div>
    </div>
  );
}
