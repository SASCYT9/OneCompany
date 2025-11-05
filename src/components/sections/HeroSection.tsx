'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface HeroSectionProps {
  isActive: boolean;
}

export function HeroSection({ isActive }: HeroSectionProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!isActive || !titleRef.current || !subtitleRef.current) return;

    const tl = gsap.timeline();
    
    tl.fromTo(titleRef.current,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }
    ).fromTo(subtitleRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: 'power2.out' },
      '-=0.6'
    );
  }, [isActive]);

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background - темний градієнт */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      {/* Золоті акценти */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-amber-500/10 via-transparent to-transparent blur-3xl" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-radial from-amber-600/10 via-transparent to-transparent blur-3xl" />

      {/* Контент */}
      <div className="relative z-10 text-center px-8 max-w-6xl">
        <div ref={titleRef} className="mb-8">
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-light tracking-tight mb-4">
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              one
            </span>
            <span className="text-white">company</span>
          </h1>
        </div>

        <p 
          ref={subtitleRef}
          className="text-xl md:text-2xl lg:text-3xl font-light text-slate-300 tracking-wide"
        >
          Преміум автотюнінг. Три напрями. Одна філософія.
        </p>

        {/* Scroll indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 border-2 border-amber-400/50 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-amber-400 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
}
