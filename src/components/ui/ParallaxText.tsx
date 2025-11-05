'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ParallaxTextProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export default function ParallaxText({ children, speed = 50, className = '' }: ParallaxTextProps) {
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textRef.current) return;

    gsap.to(textRef.current, {
      yPercent: -speed,
      ease: 'none',
      scrollTrigger: {
        trigger: textRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    });
  }, [speed]);

  return (
    <div ref={textRef} className={className}>
      {children}
    </div>
  );
}
