"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useInView } from "framer-motion";
import gsap from "gsap";

type MinimalistHeroProps = {
  locale: string;
  ctaAutoLabel?: string;
  ctaMotoLabel?: string;
};

export function MinimalistHero({ 
  locale, 
  ctaAutoLabel = "Automotive", 
  ctaMotoLabel = "Moto" 
}: MinimalistHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!isInView || !containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(".hero-cta", {
        opacity: 0,
        y: 40,
        scale: 0.92,
        filter: "blur(12px)",
        duration: 1.2,
        stagger: 0.25,
        ease: "power3.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, [isInView]);

  return (
    <div 
      ref={containerRef} 
      className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 sm:px-6"
    >
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6">
        <Link 
          href={`/${locale}/auto`} 
          className="hero-cta group inline-flex items-center justify-center gap-3 rounded-full border border-white/25 bg-white/8 px-10 py-4 text-sm font-light uppercase tracking-[0.35em] text-white shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/50 hover:bg-white/15 hover:shadow-white/10 sm:px-14 sm:py-5 sm:text-base"
          aria-label={`Navigate to ${ctaAutoLabel} page`}
        >
          <span>{ctaAutoLabel}</span>
          <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
        
        <Link 
          href={`/${locale}/moto`} 
          className="hero-cta group inline-flex items-center justify-center gap-3 rounded-full border border-white/25 bg-white/8 px-10 py-4 text-sm font-light uppercase tracking-[0.35em] text-white shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/50 hover:bg-white/15 hover:shadow-white/10 sm:px-14 sm:py-5 sm:text-base"
          aria-label={`Navigate to ${ctaMotoLabel} page`}
        >
          <span>{ctaMotoLabel}</span>
          <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </div>
  );
}
