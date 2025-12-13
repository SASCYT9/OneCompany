'use client';

import { useRef, useState, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CarouselItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
};

export function HomeCarousel({ items }: { items: CarouselItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // Allow a small buffer (1px) for calculation errors
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
      <div className="relative">
        {/* Navigation Buttons */}
        <button 
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className={clsx(
            "absolute -left-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black disabled:opacity-0 disabled:pointer-events-none sm:-left-12",
            !canScrollLeft && "hidden"
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button 
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className={clsx(
            "absolute -right-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black disabled:opacity-0 disabled:pointer-events-none sm:-right-12",
            !canScrollRight && "hidden"
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Gradients to indicate scroll */}
        <div className={clsx(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black to-transparent transition-opacity duration-300",
            canScrollLeft ? "opacity-100" : "opacity-0"
        )} />
        <div className={clsx(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black to-transparent transition-opacity duration-300",
            canScrollRight ? "opacity-100" : "opacity-0"
        )} />

        {/* Scroll Container */}
        <div 
          ref={containerRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:gap-6 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style jsx>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {items.map((item) => (
            <div
              key={item.id}
              className={clsx(
                "relative flex h-[280px] w-[280px] flex-shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-3xl transition-all duration-500 hover:border-white/20 hover:bg-white/[0.04] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:h-[320px] sm:w-[320px] sm:p-8 snap-start"
              )}
            >
              <div>
                <div className="text-[9px] uppercase tracking-[0.3em] text-white/50 sm:text-[10px] sm:tracking-[0.4em]">{item.eyebrow}</div>
                <h3 className="mt-4 text-2xl font-light text-white sm:text-3xl">{item.title}</h3>
              </div>
              
              <div>
                <p className="text-sm leading-relaxed text-white/60 transition-colors group-hover:text-white/80">
                  {item.description}
                </p>
                <div className="mt-6 h-px w-full bg-white/10" />
                <p className="mt-4 text-[9px] uppercase tracking-[0.2em] text-white/40 sm:text-[10px]">
                  {item.meta}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
