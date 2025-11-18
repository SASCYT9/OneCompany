'use client';

import { useEffect, useState } from 'react';
import { AnimatedLogo } from '../effects/AnimatedLogo';
import { LightStreak } from '../effects/LightStreak';
import { LightBurst } from '../effects/LightBurst';

interface MorphingTitleProps {
  currentSlide: number;
}

const titles = [
  { text: 'onecompany', gradient: 'from-orange-500 via-cyan-400 to-purple-500', streakColor: 'rgba(255, 255, 255, 0.7)' },
  { text: 'KW Suspension', gradient: 'from-orange-500 to-red-600', streakColor: 'rgba(255, 107, 53, 0.7)' },
  { text: 'Fi Exhaust', gradient: 'from-cyan-400 to-blue-600', streakColor: 'rgba(79, 195, 247, 0.7)' },
  { text: 'Eventuri', gradient: 'from-purple-500 to-pink-600', streakColor: 'rgba(194, 79, 199, 0.7)' },
];

export function MorphingTitle({ currentSlide }: MorphingTitleProps) {
  const [displayText, setDisplayText] = useState('onecompany');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showEffects, setShowEffects] = useState(true);

  useEffect(() => {
    if (currentSlide >= 0 && currentSlide < titles.length) {
      setIsAnimating(true);
      setShowEffects(false);
      
      // Анімація морфінгу
      const timer = setTimeout(() => {
        setDisplayText(titles[currentSlide].text);
        setIsAnimating(false);
        setShowEffects(true);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [currentSlide]);

  const currentTitle = titles[Math.min(currentSlide, titles.length - 1)];

  // Для першого слайду (onecompany) - використовуємо повний AnimatedLogo
  if (currentSlide === 0) {
    return (
      <div className={`transition-opacity duration-700 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
        <AnimatedLogo 
          text={displayText}
          gradient={currentTitle.gradient}
          enableStreak={showEffects}
          enableBurst={showEffects}
        />
      </div>
    );
  }

  // Для інших слайдів - простіша версія з окремими ефектами
  return (
    <div className="relative">
      {/* Світлові ефекти */}
      {showEffects && !isAnimating && (
        <>
          <LightStreak 
            color={currentTitle.streakColor}
            duration={2.5}
            delay={0}
          />
          <LightBurst 
            interval={8}
            colors={
              currentSlide === 1 
                ? ['#ff6b35', '#ff8c5a', '#ffa07a']
                : currentSlide === 2
                ? ['#4fc3f7', '#29b6f6', '#03a9f4']
                : ['#c24fc7', '#ba68c8', '#ab47bc']
            }
          />
        </>
      )}

      <h1 
        className={`
          text-6xl md:text-8xl lg:text-9xl font-extralight tracking-wider text-center
          transition-all duration-700 ease-out
          ${isAnimating ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}
        `}
      >
        <span 
          className={`
            bg-gradient-to-r ${currentTitle.gradient} 
            bg-clip-text text-transparent
            inline-block
            animate-gradient-shift
          `}
          style={{
            backgroundSize: '200% 200%',
            textShadow: showEffects ? '0 0 20px rgba(255, 255, 255, 0.3)' : 'none',
          }}
        >
          {displayText}
        </span>
      </h1>
      
      {/* Додатковий ефект світіння */}
      <div 
        className={`
          absolute inset-0 -z-10
          bg-gradient-to-r ${currentTitle.gradient}
          blur-3xl opacity-20
          transition-all duration-1000
          ${isAnimating ? 'scale-110 opacity-30' : 'scale-100 opacity-20'}
          ${showEffects ? 'animate-pulse' : ''}
        `}
        aria-hidden="true"
      />
    </div>
  );
}
