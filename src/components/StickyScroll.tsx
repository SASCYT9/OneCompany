"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";
import clsx from "clsx";
import { BadgeCheck, Search, Globe, History, MapPin, Briefcase, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StickyScrollItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
};

const ICONS: Record<string, LucideIcon> = {
  brands: BadgeCheck,
  sourcing: Search,
  logistics: Globe,
  experience: History,
  network: MapPin,
  b2b: Briefcase,
  authenticity: ShieldCheck,
};

export function StickyScroll({ items }: { items: StickyScrollItem[] }) {
  const [activeCard, setActiveCard] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastValueRef = useRef<number>(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const cardLength = items.length;

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // RAF-throttled update for smooth 120Hz/144Hz/160Hz/240Hz support
  const updateActiveCard = useCallback(
    (latest: number) => {
      lastValueRef.current = latest;

      // Only schedule RAF if not already pending
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;

          const cardsBreakpoints = items.map((_, index) => index / cardLength);
          const closestBreakpointIndex = cardsBreakpoints.reduce((acc, breakpoint, index) => {
            const distance = Math.abs(lastValueRef.current - breakpoint);
            if (distance < Math.abs(lastValueRef.current - cardsBreakpoints[acc])) {
              return index;
            }
            return acc;
          }, 0);

          // Only update state if index actually changed
          setActiveCard((prev) =>
            prev !== closestBreakpointIndex ? closestBreakpointIndex : prev
          );
        });
      }
    },
    [items, cardLength]
  );

  useMotionValueEvent(scrollYProgress, "change", updateActiveCard);

  return (
    <section ref={ref} className="relative w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-24">
      <div className="flex flex-col items-center">
        {/* Centered Text Content */}
        <div className="w-full max-w-4xl relative z-10">
          {items.map((item, index) => {
            const Icon = ICONS[item.id] || BadgeCheck;
            const isActive = activeCard === index;
            return (
              <div
                key={item.id}
                className={clsx(
                  "flex flex-col justify-center items-center text-center",
                  // Mobile: explicit card surface so text reads against the video bg
                  "min-h-[50vh] mb-8 sm:mb-16 p-6 sm:p-8 relative overflow-hidden",
                  "rounded-2xl border border-foreground/10 bg-card/55 dark:bg-black/45 backdrop-blur-md",
                  // Desktop: stacked clean style with cross-fade based on scroll
                  "lg:min-h-[60vh] lg:mb-0 lg:p-0 lg:rounded-none lg:border-none lg:bg-transparent lg:backdrop-blur-none lg:overflow-visible",
                  // Opacity dim only on desktop where items stack; mobile keeps full readability
                  "transition-opacity duration-300 ease-out",
                  isActive ? "opacity-100" : "opacity-100 lg:opacity-20"
                )}
                style={{
                  transform: "translateZ(0)",
                  willChange: "opacity",
                }}
              >
                {/* Mobile Watermark */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 opacity-[0.06] pointer-events-none rotate-[-15deg] lg:hidden">
                  <img
                    src="/branding/one-company-logo.svg"
                    alt=""
                    aria-hidden
                    className="h-full w-full object-contain dark:invert"
                    loading="lazy"
                  />
                </div>

                <div className="flex items-center justify-center gap-4 mb-4 sm:mb-6 relative z-10">
                  <div
                    className={clsx(
                      "p-4 rounded-2xl lg:border transition-colors duration-300",
                      activeCard === index
                        ? "lg:bg-foreground/10 lg:border-foreground/20"
                        : "lg:bg-foreground/5 lg:border-foreground/10"
                    )}
                  >
                    <Icon className="w-8 h-8 text-foreground/90" strokeWidth={1.5} />
                  </div>
                </div>

                <h3 className="text-xl sm:text-4xl md:text-5xl lg:text-[45px] font-semibold text-foreground mb-4 sm:mb-8 leading-tight relative z-10 tracking-tight text-balance">
                  {item.title}
                </h3>
                <p className="text-sm md:text-lg lg:text-[13.5px] text-foreground/60 leading-relaxed max-w-2xl mx-auto relative z-10 text-pretty">
                  {item.description}
                </p>
                <div className="mt-6 pt-6 sm:mt-10 sm:pt-10 border-t border-foreground/10 w-full max-w-xs mx-auto relative z-10">
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute left-1/2 -translate-x-1/2 -top-px h-px bg-primary transition-all duration-500",
                      isActive ? "w-12" : "w-0"
                    )}
                  />
                  <span className="text-xs sm:text-sm lg:text-[10.5px] text-foreground/60 uppercase tracking-widest">
                    {item.meta}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="h-[20vh]" />
        </div>
      </div>
    </section>
  );
}
