'use client';

import { useEffect, useState } from 'react';

interface ScrollProgressProps {
  currentSlide: number;
  totalSlides: number;
}

export function ScrollProgress({ currentSlide, totalSlides }: ScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      setProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Прогрес бар */}
      <div className="h-1 bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 via-cyan-400 to-purple-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Індикатор слайдів */}
      <div className="absolute top-8 right-8 flex flex-col gap-3">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <div
            key={index}
            className={`
              w-2 h-2 rounded-full transition-all duration-500
              ${index === currentSlide 
                ? 'bg-white scale-150 shadow-lg shadow-white/50' 
                : 'bg-white/30 hover:bg-white/50'
              }
            `}
            aria-label={`Слайд ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
