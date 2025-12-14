'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { SimpleBrand } from '@/lib/types';
import { BrandLogo } from './BrandLogo';

interface MagicBrandCardProps {
  brand: SimpleBrand;
  onClick: () => void;
  index: number;
}

export function MagicBrandCard({ brand, onClick, index }: MagicBrandCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Entrance animation
    gsap.fromTo(
      card,
      { y: 50, opacity: 0, scale: 0.9 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: 'power3.out',
        delay: index * 0.05,
      }
    );

    // 3D tilt effect - subtle movement
    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 50; // Reduced from 20 to 50 for less tilt
      const rotateY = (centerX - x) / 50; // Reduced from 20 to 50 for less tilt

      gsap.to(card, {
        rotateX,
        rotateY,
        duration: 0.5,
        ease: 'power2.out',
        transformPerspective: 1000,
      });

      // Glow effect follows cursor
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          x: x - rect.width / 2,
          y: y - rect.height / 2,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    };

    const handleMouseEnter = () => {
      gsap.to(card, {
        scale: 1.02, // Reduced from 1.05 to 1.02 for more subtle effect
        duration: 0.4,
        ease: 'power2.out',
      });
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          opacity: 1,
          duration: 0.3,
        });
      }
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        duration: 0.5,
        ease: 'power2.out',
      });
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          opacity: 0,
          duration: 0.3,
        });
      }
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [index]);

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-white/[0.01] backdrop-blur-sm cursor-pointer rounded-2xl shadow-lg"
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      aria-label={`Show info for ${brand.name}`}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Animated glow */}
      <div
        ref={glowRef}
        className="absolute w-64 h-64 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500/30 to-rose-500/30 rounded-full blur-3xl opacity-0 pointer-events-none"
        style={{ top: '50%', left: '50%' }}
      />

      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-rose-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/[0.05] to-transparent group-hover:via-white/[0.08] transition-all duration-700" />

      <div className="relative flex flex-col h-full">
        {/* Hero Logo Section - Full width with dramatic backdrop */}
        <div className="relative h-64 flex items-center justify-center bg-gradient-to-br from-black/40 via-black/20 to-transparent backdrop-blur-sm overflow-hidden group-hover:h-72 transition-all duration-500">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-rose-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          {/* Radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.15)_0%,_transparent_70%)]" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500">
            <div className="absolute inset-0" style={{
              backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
              backgroundSize: '50px 50px'
            }} />
          </div>
          
          {/* Logo with fallback */}
          <div className="relative z-10 w-full max-w-sm px-8 group-hover:scale-110 transition-transform duration-500">
            {brand.logo ? (
              <BrandLogo name={brand.name} src={brand.logo} className="w-full drop-shadow-2xl filter brightness-110" />
            ) : (
              <div className="w-full aspect-[3/1] flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 rounded-xl border border-white/20">
                <span className="text-4xl font-light tracking-wider text-white/80">
                  {brand.name.split(' ').map(w => w[0]).join('')}
                </span>
              </div>
            )}
          </div>
          
          {/* Floating category badge */}
          <div className="absolute top-6 right-6 group-hover:top-4 group-hover:right-4 transition-all duration-500">
            <div className="px-4 py-2 bg-gradient-to-r from-orange-500/20 to-rose-500/20 backdrop-blur-md border border-white/20 rounded-full shadow-xl">
              <span className="text-[9px] tracking-[0.3em] uppercase text-white/90 font-light">
                {brand.category}
              </span>
            </div>
          </div>

          {/* Corner accent */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-rose-500/20 to-transparent blur-3xl" />
        </div>

        {/* Content Section - Premium spacing */}
        <div className="relative flex flex-col flex-1 p-8 bg-gradient-to-b from-white/[0.02] to-transparent">
          {/* Brand name with accent line */}
          <div className="mb-4">
            <h3 className="text-3xl font-light tracking-tight text-white/95 group-hover:text-white mb-2 transition-colors duration-500">
              {brand.name.toUpperCase()}
            </h3>
            <div className="w-16 h-0.5 bg-gradient-to-r from-orange-500 to-rose-500 group-hover:w-24 transition-all duration-500" />
          </div>
          
          {/* Description */}
          <p className="text-white/60 text-sm leading-relaxed font-light group-hover:text-white/80 transition-colors duration-500 mb-8 flex-1">
            {brand.description}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="relative flex-1 min-w-[160px] px-6 py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300 rounded-xl shadow-lg hover:shadow-2xl hover:shadow-orange-500/40 overflow-hidden group/btn"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <span className="relative z-10">Детальніше</span>
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-purple-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
            </button>
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white/70 hover:text-white text-[11px] tracking-[0.2em] uppercase font-light transition-all duration-300 rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                Сайт →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bottom shine line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-700" />
    </div>
  );
}
