"use client";

import * as React from "react";
import { ArrowRight, Sparkle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type YellowModalFlowActionVariant = "primary" | "secondary" | "destructive";

interface YellowModalFlowAction {
  label: React.ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  variant?: YellowModalFlowActionVariant;
  className?: string;
}

interface YellowModalFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  titleClassName?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  eyebrow?: React.ReactNode;
  eyebrowIcon?: React.ReactNode;
  primaryAction?: YellowModalFlowAction;
  secondaryAction?: YellowModalFlowAction;
  hint?: React.ReactNode;
  preview?: React.ReactNode;
  children?: React.ReactNode;
  closeLabel?: string;
  closeDisabled?: boolean;
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
  ambientGlowClassName?: string;
  ambientGlowStyle?: React.CSSProperties;
}

const ACTION_VARIANTS: Record<YellowModalFlowActionVariant, string> = {
  primary:
    "bg-zinc-950 text-white shadow-[0_16px_44px_-18px_rgba(0,0,0,0.45)] hover:bg-zinc-900 focus-visible:ring-zinc-950/20",
  secondary:
    "border border-zinc-900/15 bg-white/16 text-zinc-900/58 backdrop-blur-xl hover:border-zinc-900/25 hover:bg-white/34 hover:text-zinc-900 focus-visible:ring-primary/25",
  destructive:
    "bg-red-600 text-white shadow-[0_16px_44px_-18px_rgba(185,28,28,0.5)] hover:bg-red-700 focus-visible:ring-red-600/25",
};

// {{THEME_GLOW_BACKGROUND_START}}
const AMBIENT_GLOW_BACKGROUND =
  "radial-gradient(ellipse 82vw 38vh at 100% 82%, hsla(48,100%,67%,0.28) 0%, hsla(48,96%,53%,0.2) 38%, hsla(42,95%,55%,0.1) 66%, rgba(255,255,255,0) 92%), radial-gradient(ellipse 58vw 24vh at 100% 96%, rgba(202,138,4,0.08) 0%, rgba(255,255,255,0) 78%)";
// {{THEME_GLOW_BACKGROUND_END}}

// {{THEME_DOT_COLOR_START}}
const DOT_PATTERN_COLOR = "rgba(113,63,18,0.18)";
// {{THEME_DOT_COLOR_END}}

export function YellowModalFlow({
  open,
  onOpenChange,
  title,
  titleClassName,
  description,
  descriptionClassName,
  eyebrow,
  eyebrowIcon,
  primaryAction,
  secondaryAction,
  hint,
  preview,
  children,
  closeLabel = "Close",
  closeDisabled = false,
  className,
  contentClassName,
  bodyClassName,
  ambientGlowClassName,
  ambientGlowStyle,
}: YellowModalFlowProps) {
  const reduceMotion = useReducedMotion();
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                key="yellow-modal-flow-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.42,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="fixed inset-0 z-[80] bg-transparent backdrop-blur-lg"
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content
              asChild
              forceMount
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              onEscapeKeyDown={(event) => {
                if (closeDisabled) event.preventDefault();
              }}
            >
              <motion.div
                key="yellow-modal-flow-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.42,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "fixed inset-0 isolate z-[81] flex min-h-0 items-end justify-end overflow-hidden px-5 py-8 text-zinc-950 focus:outline-none sm:px-8 lg:px-12 lg:py-12",
                  className
                )}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.42) 20%, rgba(255,255,255,0.82) 34%, rgba(255,255,255,0.98) 42%, rgba(255,255,255,1) 100%)",
                  }}
                />
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0, x: 64, y: 64 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 36, y: 36 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.68,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cn(
                    "pointer-events-none absolute inset-0",
                    ambientGlowClassName
                  )}
                  style={{
                    background: AMBIENT_GLOW_BACKGROUND,
                    filter: "blur(12px)",
                    maskImage:
                      "linear-gradient(90deg, transparent 0%, transparent 18vw, rgba(0,0,0,0.12) 30vw, rgba(0,0,0,0.42) 48vw, rgba(0,0,0,0.84) 68vw, rgba(0,0,0,1) 100%)",
                    WebkitMaskImage:
                      "linear-gradient(90deg, transparent 0%, transparent 18vw, rgba(0,0,0,0.12) 30vw, rgba(0,0,0,0.42) 48vw, rgba(0,0,0,0.84) 68vw, rgba(0,0,0,1) 100%)",
                    ...ambientGlowStyle,
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.08]"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, ${DOT_PATTERN_COLOR} 0.55px, transparent 1.4px)`,
                    backgroundSize: "13px 13px",
                    maskImage:
                      "linear-gradient(90deg, transparent 0%, transparent 28vw, rgba(0,0,0,0.1) 42vw, rgba(0,0,0,0.38) 64vw, rgba(0,0,0,0.84) 100%)",
                    WebkitMaskImage:
                      "linear-gradient(90deg, transparent 0%, transparent 28vw, rgba(0,0,0,0.1) 42vw, rgba(0,0,0,0.38) 64vw, rgba(0,0,0,0.84) 100%)",
                  }}
                />

                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    disabled={closeDisabled}
                    className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-zinc-900/15 bg-white/42 px-3.5 py-2 text-xs font-semibold text-zinc-900/56 shadow-[0_10px_30px_-22px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-zinc-900/25 hover:bg-white/62 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-35 sm:right-8 sm:top-8"
                    aria-label={closeLabel}
                  >
                    <X size={14} weight="bold" />
                    {closeLabel}
                  </button>
                </DialogPrimitive.Close>

                <div
                  className={cn(
                    "relative z-10 grid w-full max-w-5xl items-end gap-5 lg:grid-cols-[minmax(0,1fr)_280px]",
                    contentClassName
                  )}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 14 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.55,
                      delay: reduceMotion ? 0 : 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={cn(
                      "max-w-xl pb-24 sm:pb-28 lg:pb-32",
                      bodyClassName
                    )}
                  >
                    {eyebrow && (
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-900/55 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                        <span className="text-primary">
                          {eyebrowIcon ?? <Sparkle size={13} weight="fill" />}
                        </span>
                        {eyebrow}
                      </div>
                    )}
                    <DialogPrimitive.Title
                      id={titleId}
                      className={cn(
                        "max-w-lg text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl",
                        titleClassName
                      )}
                    >
                      {title}
                    </DialogPrimitive.Title>
                    {description && (
                      <DialogPrimitive.Description
                        id={descriptionId}
                        className={cn(
                          "mt-4 max-w-xl text-sm leading-6 text-zinc-900/62",
                          descriptionClassName
                        )}
                      >
                        {description}
                      </DialogPrimitive.Description>
                    )}
                    {children}
                    {(primaryAction || secondaryAction) && (
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        {primaryAction && (
                          <YellowModalFlowButton action={primaryAction} />
                        )}
                        {secondaryAction && (
                          <YellowModalFlowButton
                            action={{
                              variant: "secondary",
                              ...secondaryAction,
                            }}
                          />
                        )}
                      </div>
                    )}
                    {hint && (
                      <p className="mt-3 text-[11px] text-zinc-900/35">
                        {hint}
                      </p>
                    )}
                  </motion.div>
                  {preview}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function YellowModalFlowButton({ action }: { action: YellowModalFlowAction }) {
  const variant = action.variant ?? "primary";
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(
        "group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0",
        ACTION_VARIANTS[variant],
        action.className
      )}
    >
      {action.icon}
      {action.label}
      {action.trailingIcon ??
        (variant === "primary" ? (
          <ArrowRight
            size={16}
            weight="bold"
            className="transition-transform group-hover:translate-x-0.5"
          />
        ) : null)}
    </button>
  );
}

interface YellowModalFlowPreviewProps {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function YellowModalFlowPreview({
  label,
  icon,
  children,
  className,
}: YellowModalFlowPreviewProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      initial={{ opacity: 0, x: 28, y: 18 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 18, y: 12 }}
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        delay: reduceMotion ? 0 : 0.16,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "min-w-0 rounded-3xl p-4 backdrop-blur-2xl",
        className
      )}
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.44) 58%, rgba(255,255,255,0.08) 100%)",
        boxShadow: "0 28px 80px -52px rgba(0,0,0,0.34)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-white/68 text-primary shadow-[0_16px_44px_-28px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          {icon ?? <Sparkle size={24} weight="fill" />}
        </div>
        {label && (
          <span className="rounded-full bg-white/46 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-900/42">
            {label}
          </span>
        )}
      </div>
      {children ?? (
        <div
          aria-hidden
          className="mt-6 h-28 rounded-3xl"
          style={{
            background:
              "radial-gradient(ellipse at 76% 86%, rgba(245,158,11,0.18), transparent 62%), radial-gradient(ellipse at 38% 68%, rgba(250,204,21,0.12), transparent 68%)",
          }}
        />
      )}
    </motion.aside>
  );
}
