"use client";

import { useState, type ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shopify-style collapsible card.
 *
 * Used for advanced/optional sections in long editor forms — Dimensions, SEO,
 * Metafields, Activity. The card header stays visible and acts as a button;
 * clicking it expands the body. Designed to be lighter than `AdminEditorSection`
 * so a stack of these doesn't feel as heavy.
 */
export function AdminCollapsibleSection({
  id,
  title,
  description,
  badge,
  defaultOpen = false,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  /** Optional pill on the right of the title (e.g. "Optional", "0 fields"). */
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className={cn("scroll-mt-24 border border-white/5 bg-[#171717]", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/2 md:px-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-50">{title}</h2>
            {badge ? <span className="shrink-0">{badge}</span> : null}
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="border-t border-white/5 px-5 py-5 md:px-6 md:py-6">{children}</div>
      ) : null}
    </section>
  );
}
