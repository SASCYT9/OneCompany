'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { getBrandLogo } from '@/lib/brandLogos';
import { shouldInvertBrandOrLogo } from '@/lib/invertBrands';

// Select top brands from automotive and moto categories
const topBrands = [
  // Top automotive brands
  'Akrapovic', 'KW Suspension', 'Brembo', 'Eventuri', 'Fi Exhaust',
  'Brabus', 'Novitec', 'Mansory', 'ABT', 'AC Schnitzer',
  'HRE wheels', 'Vorsteiner', 'Capristo', 'Liberty Walk', 'Manhart',
  'APR', 'Cobb tuning', 'ESS Tuning', 'Weistec Engineering', 'RENNtech',
  // Top moto brands
  'SC-Project', 'Arrow', 'Termignoni', 'Rotobox', 'Ilmberger Carbon',
  'CNC Racing', 'Austin Racing', 'Bitubo Suspension', 'GPR Stabilizer',
  'Evotech', 'GBracing', 'Domino', 'Gilles Tooling',
];

// Create featured brands array with logos
const featuredBrands = topBrands.map(name => ({
  name,
  logo: getBrandLogo(name),
}));

export default function BrandsMarquee() {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!marqueeRef.current) return;

    const marquee = marqueeRef.current;
    const firstSet = marquee.children[0] as HTMLElement;
    
    // Clone the first set to create seamless loop
    const clone = firstSet.cloneNode(true);
    marquee.appendChild(clone);

    // Animate with GSAP
    const totalWidth = firstSet.offsetWidth;
    
    gsap.to(marquee, {
      x: -totalWidth,
      duration: 30,
      ease: 'none',
      repeat: -1,
    });
  }, []);

  return (
    <section className="relative py-24 bg-zinc-950 overflow-hidden border-y border-white/5">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black pointer-events-none z-10" />
      
      <div className="container mx-auto mb-12 px-6">
        <h2 className="text-3xl md:text-5xl font-bold text-center bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Ми працюємо з найкращими
        </h2>
        <p className="text-center text-zinc-500 mt-4">Понад 200 світових брендів</p>
      </div>

      {/* Scrolling marquee */}
      <div 
        ref={marqueeRef}
        className="flex gap-16 items-center will-change-transform"
      >
        <div className="flex gap-16 items-center shrink-0">
          {featuredBrands.map((brand) => (
            <div
              key={brand.name}
              className="flex items-center justify-center w-40 h-24 opacity-80 hover:opacity-100 transition-all duration-500"
            >
              <Image
                src={brand.logo}
                alt={brand.name}
                width={160}
                height={80}
                className={`object-contain ${shouldInvertBrandOrLogo(brand.name, brand.logo) ? 'filter brightness-0 invert' : ''}`}
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>

      {/* CTA below marquee */}
      {/* <div className="text-center mt-16">
        <Link
          href="brands"
          className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 rounded-full text-sm text-white/80 hover:text-white hover:border-white/40 transition-all group"
        >
          Переглянути всі бренди
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div> */}
    </section>
  );
}
