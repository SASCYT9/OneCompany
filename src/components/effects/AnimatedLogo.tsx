'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { LightStreak } from './LightStreak';
import { LightBurst } from './LightBurst';
import { createSeededRandom } from '@/lib/random';

interface AnimatedLogoProps {
  text: string;
  gradient?: string;
  enableStreak?: boolean;
  enableBurst?: boolean;
  className?: string;
}

export function AnimatedLogo({ 
  text,
  gradient = 'from-orange-500 via-cyan-400 to-purple-500',
  enableStreak = true,
  enableBurst = true,
  className = ''
}: AnimatedLogoProps) {
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!textRef.current) return;

    const chars = textRef.current.textContent?.split('') || [];
    const html = chars.map((char, i) => 
      `<span class="char inline-block" data-char="${i}">${char === ' ' ? '&nbsp;' : char}</span>`
    ).join('');
    
    textRef.current.innerHTML = html;

    const charElements = textRef.current.querySelectorAll('.char');

    // Початкова анімація появи
    gsap.fromTo(charElements,
      {
        opacity: 0,
        y: 50,
        rotationX: -90,
      },
      {
        opacity: 1,
        y: 0,
        rotationX: 0,
        duration: 1,
        stagger: 0.03,
        ease: 'back.out(1.7)',
        delay: 0.3,
      }
    );

    // Постійна анімація "дихання"
    gsap.to(charElements, {
      y: -10,
      duration: 2,
      stagger: {
        each: 0.1,
        from: 'center',
        repeat: -1,
        yoyo: true,
      },
      ease: 'sine.inOut',
    });

    // Випадкові спалахи на літерах
    const rand = createSeededRandom(chars.length || 1);
    charElements.forEach((char) => {
      gsap.to(char, {
        textShadow: '0 0 30px rgba(255, 255, 255, 0.8), 0 0 60px rgba(79, 195, 247, 0.6)',
        duration: 0.3,
        repeat: -1,
        repeatDelay: rand() * 8 + 4,
        yoyo: true,
        ease: 'power2.inOut',
      });
    });

  }, [text]);

  return (
    <div ref={logoRef} className={`relative ${className}`}>
      {/* Світловий шлейф */}
      {enableStreak && (
        <>
          <LightStreak 
            color="rgba(255, 107, 53, 0.6)" 
            duration={2.5}
            delay={0}
          />
          <LightStreak 
            color="rgba(79, 195, 247, 0.6)" 
            duration={3}
            delay={1.5}
          />
          <LightStreak 
            color="rgba(194, 79, 199, 0.6)" 
            duration={2.8}
            delay={3}
          />
        </>
      )}

      {/* Світловий спалах */}
      {enableBurst && <LightBurst interval={6} />}

      {/* Основний текст логотипа */}
      <h1 
        ref={textRef}
        className={`
          text-6xl md:text-8xl lg:text-9xl font-extralight tracking-wider text-center
          bg-gradient-to-r ${gradient} 
          bg-clip-text text-transparent
          relative z-10
        `}
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d',
        }}
      >
        {text}
      </h1>

      {/* Додатковий glow ефект */}
      <div 
        className={`
          absolute inset-0 -z-10
          bg-gradient-to-r ${gradient}
          blur-3xl opacity-30
          animate-pulse
        `}
        aria-hidden="true"
      />
    </div>
  );
}
