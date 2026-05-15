"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type MobileProductDisclosureProps = {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function MobileProductDisclosure({
  title,
  children,
  className,
  contentClassName,
}: MobileProductDisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={className}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-foreground/12 bg-foreground/[0.04] px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/78 transition hover:border-foreground/22 hover:bg-foreground/[0.07] dark:border-white/12 dark:bg-white/4 dark:text-white/78 dark:hover:border-white/22 dark:hover:bg-white/[0.07] sm:hidden"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-foreground/55 dark:text-white/55 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 sm:max-h-none sm:overflow-visible sm:opacity-100 ${
          open
            ? "mt-4 max-h-[4000px] opacity-100 pointer-events-auto"
            : "max-h-0 opacity-0 pointer-events-none sm:mt-0 sm:pointer-events-auto"
        } ${contentClassName ?? ""}`}
      >
        {children}
      </div>
    </section>
  );
}
