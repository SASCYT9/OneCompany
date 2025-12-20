'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface HeroSectionProps {
  videoSrc: string;
  title: string;
  subtitle: string;
}

export function HeroSection({ videoSrc, title, subtitle }: HeroSectionProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!titleRef.current || !subtitleRef.current) return;

    const tl = gsap.timeline();
    
    tl.fromTo(titleRef.current,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }
    ).fromTo(subtitleRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: 'power2.out' },
      '-=0.6'
    );
  }, []);

  return (
    <section className="relative h-dvh w-full flex items-center justify-center overflow-hidden">
      <video
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/60 z-10" />

      <div className="relative z-20 text-center px-8 max-w-6xl">
        <h1 
          ref={titleRef}
          className="text-6xl md:text-7xl lg:text-8xl font-light tracking-tight text-white mb-6"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        <p 
          ref={subtitleRef}
          className="text-xl md:text-2xl font-light text-white/80"
        >
          {subtitle}
        </p>
      </div>
    </section>
  );
}
