'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface LightStreakProps {
  isActive?: boolean;
  duration?: number;
  delay?: number;
  color?: string;
}

export function LightStreak({ 
  isActive = true, 
  duration = 2,
  delay = 0,
  color = 'rgba(255, 255, 255, 0.8)'
}: LightStreakProps) {
  const streakRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streakRef.current || !isActive) return;

    const streak = streakRef.current;

    // GSAP Timeline для світлового шлейфу
    const tl = gsap.timeline({
      repeat: -1,
      delay: delay,
      repeatDelay: 3
    });

    tl.fromTo(streak,
      {
        left: '-100%',
        opacity: 0,
        scaleX: 0.5,
      },
      {
        left: '200%',
        opacity: 1,
        scaleX: 1,
        duration: duration,
        ease: 'power2.inOut',
      }
    ).to(streak, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
    }, '-=0.5');

    return () => {
      tl.kill();
    };
  }, [isActive, duration, delay]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        ref={streakRef}
        className="absolute top-0 w-1/3 h-full opacity-0"
        style={{
          background: `linear-gradient(90deg, 
            transparent 0%, 
            ${color} 50%, 
            transparent 100%)`,
          filter: 'blur(20px)',
          transform: 'skewX(-20deg)',
        }}
      />
    </div>
  );
}
