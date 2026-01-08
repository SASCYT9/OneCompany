'use client';

import { useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import Image from 'next/image';
import clsx from 'clsx';
import {
  BadgeCheck,
  Search,
  Globe,
  History,
  MapPin,
  Briefcase,
  ShieldCheck,
  LucideIcon
} from 'lucide-react';

type StickyScrollItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
};

const ICONS: Record<string, LucideIcon> = {
  'brands': BadgeCheck,
  'sourcing': Search,
  'logistics': Globe,
  'experience': History,
  'network': MapPin,
  'b2b': Briefcase,
  'authenticity': ShieldCheck
};

export function StickyScroll({ items }: { items: StickyScrollItem[] }) {
  const [activeCard, setActiveCard] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const cardLength = items.length;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const cardsBreakpoints = items.map((_, index) => index / cardLength);
    const closestBreakpointIndex = cardsBreakpoints.reduce(
      (acc, breakpoint, index) => {
        const distance = Math.abs(latest - breakpoint);
        if (distance < Math.abs(latest - cardsBreakpoints[acc])) {
          return index;
        }
        return acc;
      },
      0
    );
    
    // Optimization: Only update state if index actually changed
    if (closestBreakpointIndex !== activeCard) {
      setActiveCard(closestBreakpointIndex);
    }
  });

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
                  "flex flex-col justify-center items-center text-center transition-all duration-500 will-change-transform",
                  // Mobile: Card Style
                  "min-h-[50vh] mb-8 sm:mb-16 p-4 sm:p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm relative overflow-hidden",
                  // Desktop: Clean Text Style (removed blur transition to fix lag)
                  "lg:min-h-[60vh] lg:mb-0 lg:p-0 lg:rounded-none lg:border-none lg:bg-transparent lg:backdrop-blur-none lg:overflow-visible",
                  // Active State
                  isActive
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-30 scale-95 translate-y-4"
                )}
              >
                {/* Mobile Watermark */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 opacity-[0.05] pointer-events-none rotate-[-15deg] lg:hidden">
                  <Image
                    src="/branding/one-company-logo.svg"
                    alt="Watermark"
                    fill
                    className="object-contain invert"
                  />
                </div>

                <div className="flex items-center justify-center gap-4 mb-4 sm:mb-6 relative z-10">
                  <div className={clsx(
                    "p-4 rounded-2xl border backdrop-blur-sm transition-all duration-500",
                    activeCard === index
                      ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                      : "bg-white/5 border-white/10"
                  )}>
                    <Icon className="w-8 h-8 text-white/90" strokeWidth={1.5} />
                  </div>
                </div>

                <span className="text-xs lg:text-[9px] font-mono text-white/50 mb-3 sm:mb-6 block uppercase tracking-[0.2em] relative z-10">{item.eyebrow}</span>
                <h3 className="text-xl sm:text-4xl md:text-5xl lg:text-[45px] font-semibold text-white mb-4 sm:mb-8 leading-tight relative z-10 tracking-tight text-balance">
                  {item.title}
                </h3>
                <p className="text-sm md:text-lg lg:text-[13.5px] text-white/60 leading-relaxed max-w-2xl mx-auto relative z-10 text-pretty">
                  {item.description}
                </p>
                <div className="mt-6 pt-6 sm:mt-10 sm:pt-10 border-t border-white/10 w-full max-w-xs mx-auto relative z-10">
                  <span className="text-xs sm:text-sm lg:text-[10.5px] text-white/60 uppercase tracking-widest">{item.meta}</span>
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
