'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface LightBurstProps {
  isActive?: boolean;
  interval?: number;
  colors?: string[];
}

export function LightBurst({ 
  isActive = true,
  interval = 5,
  colors = ['#ff6b35', '#4fc3f7', '#c24fc7']
}: LightBurstProps) {
  const burstRef = useRef<HTMLDivElement>(null);
  const particles = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!burstRef.current || !isActive) return;

    const burst = burstRef.current;
    const particleElements = particles.current;

    // GSAP Timeline для спалаху
    const tl = gsap.timeline({
      repeat: -1,
      repeatDelay: interval - 1.5
    });

    // Основний спалах
    tl.fromTo(burst,
      {
        scale: 0,
        opacity: 0,
        rotation: 0,
      },
      {
        scale: 3,
        opacity: 0.6,
        rotation: 180,
        duration: 0.8,
        ease: 'power2.out',
      }
    ).to(burst, {
      scale: 5,
      opacity: 0,
      rotation: 360,
      duration: 0.7,
      ease: 'power2.in',
    });

    // Анімація частинок
    particleElements.forEach((particle, index) => {
      if (!particle) return;
      
      const angle = (index / particleElements.length) * Math.PI * 2;
      const distance = 200;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      gsap.fromTo(particle,
        {
          x: 0,
          y: 0,
          scale: 0,
          opacity: 0,
        },
        {
          x: x,
          y: y,
          scale: 1,
          opacity: 1,
          duration: 0.6,
          delay: 0.2,
          repeat: -1,
          repeatDelay: interval - 0.6,
          ease: 'power2.out',
          yoyo: false,
          onComplete: () => {
            gsap.to(particle, {
              opacity: 0,
              scale: 0,
              duration: 0.4,
            });
          }
        }
      );
    });

    return () => {
      tl.kill();
      gsap.killTweensOf(particleElements);
    };
  }, [isActive, interval, colors]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Головний спалах */}
      <div
        ref={burstRef}
        className="absolute w-64 h-64"
        style={{
          background: `radial-gradient(circle, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
          filter: 'blur(40px)',
          opacity: 0,
        }}
      />

      {/* Частинки */}
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) particles.current[index] = el;
          }}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: colors[index % colors.length],
            boxShadow: `0 0 20px ${colors[index % colors.length]}`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
