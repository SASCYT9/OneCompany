'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
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
    setActiveCard(closestBreakpointIndex);
  });

  return (
    <section ref={ref} className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-24">
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-20">
        {/* Left Column: Text Content */}
        <div className="w-full lg:w-1/2 relative z-10">
          {items.map((item, index) => {
            const Icon = ICONS[item.id] || BadgeCheck;
            return (
              <div 
                key={item.id} 
                className={clsx(
                  "flex flex-col justify-center transition-all duration-500",
                  // Mobile: Card Style
                  "min-h-[50vh] mb-16 p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md relative overflow-hidden",
                  // Desktop: Clean Text Style
                  "lg:min-h-[60vh] lg:mb-0 lg:p-0 lg:rounded-none lg:border-none lg:bg-transparent lg:backdrop-blur-none lg:overflow-visible",
                  // Active State
                  activeCard === index 
                    ? "opacity-100 translate-x-0 scale-100" 
                    : "opacity-40 blur-[1px] scale-95 lg:opacity-20 lg:blur-[2px] lg:-translate-x-4 lg:scale-100"
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

                <div className="flex items-center gap-4 mb-6 lg:hidden relative z-10">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <Icon className="w-6 h-6 text-white/80" strokeWidth={1.5} />
                  </div>
                </div>

                <span className="text-xs font-mono text-white/50 mb-4 block uppercase tracking-widest relative z-10">{item.eyebrow}</span>
                <h3 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight relative z-10">
                  {item.title}
                </h3>
                <p className="text-lg text-white/60 leading-relaxed max-w-md relative z-10">
                  {item.description}
                </p>
                <div className="mt-8 pt-8 border-t border-white/10 relative z-10">
                  <span className="text-sm text-white/40 uppercase tracking-widest">{item.meta}</span>
                </div>
              </div>
            );
          })}
          <div className="h-[20vh]" />
        </div>

        {/* Right Column: Sticky Visuals */}
        <div className="hidden lg:block w-full lg:w-1/2 sticky top-32 h-[600px] flex items-center justify-center">
           <div className="relative w-full aspect-square max-w-[500px]">
             {items.map((item, index) => {
               const Icon = ICONS[item.id] || BadgeCheck;
               return (
                 <motion.div
                   key={item.id}
                   initial={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }}
                   animate={{ 
                     opacity: activeCard === index ? 1 : 0, 
                     scale: activeCard === index ? 1 : 0.9,
                     filter: activeCard === index ? "blur(0px)" : "blur(20px)",
                     zIndex: activeCard === index ? 10 : 0
                   }}
                   transition={{ duration: 0.7, ease: "circOut" }}
                   className="absolute inset-0 rounded-3xl bg-black/80 border border-white/10 backdrop-blur-2xl p-10 flex flex-col justify-between overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                 >
                    {/* Cinematic Background - Monochrome Spotlight & Grain */}
                    <div className="absolute inset-0 bg-[url('/images/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50" />
                    <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-white/5 blur-[100px] rounded-full pointer-events-none" />
                    
                    {/* Watermark Logo */}
                    <div className="absolute -bottom-20 -right-20 w-[120%] h-[120%] opacity-[0.03] pointer-events-none rotate-[-15deg]">
                       <Image 
                         src="/branding/one-company-logo.svg" 
                         alt="Watermark" 
                         fill
                         className="object-contain invert"
                       />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex justify-end items-start">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
                        <Icon className="w-12 h-12 text-white/80" strokeWidth={1} />
                      </div>
                    </div>

                    <div className="relative z-10 mt-auto">
                       <div className="h-px w-full bg-white/10 mb-6 relative overflow-hidden">
                          <motion.div 
                            initial={{ x: "-100%" }}
                            animate={{ x: activeCard === index ? "0%" : "-100%" }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="absolute inset-0 bg-white/50"
                          />
                       </div>
                       <div className="text-2xl font-light text-white mb-2">
                         {item.title}
                       </div>
                       <div className="text-sm text-white/40 font-mono uppercase tracking-widest">
                         {item.eyebrow}
                       </div>
                    </div>
                 </motion.div>
               );
             })}
           </div>
        </div>
      </div>
    </section>
  );
}
