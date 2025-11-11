'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { SimpleBrand } from '@/lib/types';
import { BrandLogo } from './BrandLogo';

interface AppleCardsCarouselProps {
  brands: SimpleBrand[];
  onBrandClick: (brand: SimpleBrand) => void;
}

export function AppleCardsCarousel({ brands, onBrandClick }: AppleCardsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Smooth scroll snap behavior
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.offsetWidth * 0.8; // 80vw per card
      const newIndex = Math.round(scrollLeft / cardWidth);
      setActiveIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCard = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const cardWidth = container.offsetWidth * 0.8;
    const targetScroll = index * cardWidth;
    
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative w-full">
      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8 px-4 lg:px-8"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {brands.map((brand, index) => (
          <div
            key={brand.name}
            className="snap-start flex-shrink-0 w-[85vw] md:w-[70vw] lg:w-[50vw] xl:w-[40vw]"
          >
            <AppleCard
              brand={brand}
              onClick={() => onBrandClick(brand)}
              isActive={index === activeIndex}
            />
          </div>
        ))}
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {brands.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToCard(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? 'w-8 bg-gradient-to-r from-orange-500 to-rose-500'
                : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Go to card ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

interface AppleCardProps {
  brand: SimpleBrand;
  onClick: () => void;
  isActive: boolean;
}

function AppleCard({ brand, onClick, isActive }: AppleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    if (isActive) {
      gsap.to(cardRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      });
    } else {
      gsap.to(cardRef.current, {
        scale: 0.95,
        opacity: 0.6,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  }, [isActive]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="group relative h-[500px] cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br from-black/60 via-black/40 to-black/60 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-500"
    >
      {/* Background Image/Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-rose-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-10">
        {/* Logo Section */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md transform group-hover:scale-105 transition-transform duration-500">
            {brand.logo ? (
              <BrandLogo
                name={brand.name}
                src={brand.logo}
                className="w-full filter drop-shadow-2xl"
              />
            ) : (
              <div className="w-full aspect-[3/1] flex items-center justify-center bg-gradient-to-br from-white/20 to-white/10 rounded-2xl border border-white/20">
                <span className="text-6xl font-light tracking-wider text-white">
                  {brand.name.split(' ').map((w) => w[0]).join('')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="space-y-4">
          {/* Category Badge */}
          <div className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
            <span className="text-xs tracking-[0.2em] uppercase text-white/70 font-light">
              {brand.category}
            </span>
          </div>

          {/* Brand Name */}
          <h3 className="text-4xl font-light tracking-tight text-white">
            {brand.name}
          </h3>

          {/* Description */}
          <p className="text-white/60 text-sm leading-relaxed font-light line-clamp-3">
            {brand.description}
          </p>

          {/* CTA Button */}
          <button
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white text-sm tracking-[0.15em] uppercase font-medium rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-orange-500/30"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            Переглянути
          </button>
        </div>
      </div>

      {/* Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
    </div>
  );
}
