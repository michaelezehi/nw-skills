"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type EmptyStateActionVariant = "primary" | "secondary";

export interface EmptyStateAction {
  label: React.ReactNode;
  href?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  variant?: EmptyStateActionVariant;
  className?: string;
}

interface EmptyStateProps {
  title: React.ReactNode;
  titleClassName?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  eyebrow?: React.ReactNode;
  eyebrowIcon?: React.ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  hint?: React.ReactNode;
  preview?: React.ReactNode;
  /** Render extra content below the title/description and above the actions. */
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
}

const ACTION_VARIANTS: Record<EmptyStateActionVariant, string> = {
  primary:
    "bg-zinc-950 text-white shadow-[0_16px_44px_-18px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-zinc-900 focus-visible:ring-zinc-950/20",
  secondary:
    "border border-zinc-900/15 bg-transparent text-zinc-900/58 hover:-translate-y-0.5 hover:border-zinc-900/25 hover:bg-white/30 hover:text-zinc-900 focus-visible:ring-primary/25",
};

/**
 * Inline empty state — large eyebrow pill, display-weight title, optional
 * description, action buttons, and an optional side `preview` panel.
 *
 * Renders directly on the page background. No outer card; the side preview is
 * the only visual surface. Mirrors perspiva's `ResultEmptyState` 1:1 in
 * structure.
 */
export function EmptyState({
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
  className,
  contentClassName,
  bodyClassName,
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative flex min-h-[360px] items-end justify-center overflow-hidden rounded-[2rem] px-5 py-8 sm:min-h-[430px] sm:px-8 lg:px-12 lg:py-12",
        className
      )}
    >
      <div
        className={cn(
          "grid w-full max-w-5xl items-end gap-5 lg:grid-cols-[minmax(0,1fr)_280px]",
          contentClassName
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.55,
            delay: reduceMotion ? 0 : 0.08,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={cn("max-w-xl pb-2 lg:pb-12", bodyClassName)}
        >
          {eyebrow && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-900/55 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-900/15 bg-white/58 text-zinc-900/55 ring-1 ring-white/70">
                {eyebrowIcon ?? <Sparkle size={14} weight="duotone" />}
              </span>
              {eyebrow}
            </div>
          )}
          <h2
            className={cn(
              "max-w-[27rem] text-3xl font-semibold leading-[1.04] tracking-tight text-zinc-900 sm:text-4xl",
              titleClassName
            )}
          >
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                "mt-4 max-w-xl text-sm leading-6 text-zinc-900/62",
                descriptionClassName
              )}
            >
              {description}
            </p>
          )}
          {children}
          {(primaryAction || secondaryAction) && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {primaryAction && <EmptyStateButton action={primaryAction} />}
              {secondaryAction && (
                <EmptyStateButton
                  action={{ variant: "secondary", ...secondaryAction }}
                />
              )}
            </div>
          )}
          {hint && (
            <p className="mt-3 text-[11px] text-zinc-900/35">{hint}</p>
          )}
        </motion.div>
        {preview}
      </div>
    </div>
  );
}

function EmptyStateButton({ action }: { action: EmptyStateAction }) {
  const variant = action.variant ?? "primary";
  const showTrailingArrow =
    !action.trailingIcon && variant === "primary" && !action.icon;
  const className = cn(
    "group inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0",
    ACTION_VARIANTS[variant],
    action.className
  );

  const inner = (
    <>
      {action.icon}
      {action.label}
      {action.trailingIcon ??
        (showTrailingArrow ? (
          <ArrowRight
            size={16}
            weight="bold"
            className="transition-transform group-hover:translate-x-0.5"
          />
        ) : null)}
    </>
  );

  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={className}
    >
      {inner}
    </button>
  );
}

interface EmptyStatePreviewProps {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  iconElement?: PhosphorIcon;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Side panel that pairs with `EmptyState` — circular icon badge, optional
 * status pill, and a soft gradient placeholder body. Pass `iconElement` for a
 * Phosphor icon shorthand or `icon` for a custom node.
 */
export function EmptyStatePreview({
  label,
  icon,
  iconElement: IconElement = Sparkle,
  children,
  className,
}: EmptyStatePreviewProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      initial={{ opacity: 0, x: 28, y: 18 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        delay: reduceMotion ? 0 : 0.16,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        // {{THEME_PREVIEW_SHADOW_START}}
        "min-w-0 rounded-3xl border border-white/70 bg-white/62 p-4 shadow-[0_28px_70px_-30px_rgba(202,138,4,0.45),0_10px_28px_-18px_rgba(202,138,4,0.28)] backdrop-blur-2xl",
        // {{THEME_PREVIEW_SHADOW_END}}
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex size-20 items-center justify-center rounded-full border border-primary/25 bg-white/76 text-primary shadow-[0_18px_48px_-24px_rgba(202,138,4,0.4)] ring-1 ring-white/80 backdrop-blur-xl">
          {icon ?? <IconElement size={36} weight="duotone" />}
        </div>
        {label && (
          <span className="rounded-full border border-white/70 bg-white/58 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-900/42">
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
