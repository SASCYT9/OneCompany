'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface HeroLogoProps {
  className?: string;
}

export function HeroLogo({ className = '' }: HeroLogoProps) {
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!textRef.current || !logoRef.current) return;

    // Анімація появи логотипа
    gsap.fromTo(logoRef.current,
      {
        opacity: 0,
        y: 30,
        scale: 0.95,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1.5,
        ease: 'power3.out',
        delay: 0.3,
      }
    );

    // Пульсація glow ефекту
    gsap.to(logoRef.current, {
      filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.3))',
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

  }, []);

  return (
    <div ref={logoRef} className={`relative ${className}`}>
      {/* Основний текст логотипа */}
      <div className="relative z-20">
        <h1 
          ref={textRef}
          className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extralight tracking-wide text-center mb-6"
          style={{
            background: 'linear-gradient(90deg, #ff6b35 0%, #ffffff 30%, #4fc3f7 60%, #ffffff 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          onecompany
        </h1>

        {/* Слоган */}
        <p className="text-lg md:text-xl lg:text-2xl font-light text-white/80 text-center max-w-3xl mx-auto px-4">
          Преміум автотюнінг. Три напрями. Одна філософія.
        </p>
      </div>

      {/* Фонове свічення */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.15) 0%, rgba(79, 195, 247, 0.15) 50%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}
