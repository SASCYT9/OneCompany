'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { BRAND_LOGO_MAP } from '@/lib/brandLogos';

export default function BrandsPage() {
  const locale = useLocale();
  const [search, setSearch] = useState('');

  const brands = Object.entries(BRAND_LOGO_MAP).sort((a, b) => a[0].localeCompare(b[0]));
  
  const filteredBrands = brands.filter(([name]) => 
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(255,255,255,0.05)_0%,_transparent_70%)] rounded-full blur-3xl" />
      </div>

      <main className="relative container mx-auto px-6 py-24">
        <header className="text-center mb-16">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/30 font-light mb-4">
            {locale === 'ua' ? 'Партнери' : 'Partners'}
          </p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70 text-balance">
            {locale === 'ua' ? 'Всі бренди' : 'All Brands'}
          </h1>
          
          <div className="max-w-md mx-auto relative">
            <input
              type="text"
              placeholder={locale === 'ua' ? 'Пошук бренду...' : 'Search brands...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-6 py-3 bg-white/[0.05] border border-white/10 rounded-full text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all text-center font-light"
            />
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredBrands.map(([name, logo]) => (
            <div 
              key={name}
              className="group relative aspect-[3/2] flex items-center justify-center p-6 bg-white/[0.02] border border-white/10 rounded-2xl hover:bg-white/[0.05] hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-500 backdrop-blur-sm overflow-hidden"
            >
              {/* Radial white backlight for dark logos */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[80%] h-[80%] bg-[radial-gradient(circle,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0.04)_40%,_transparent_70%)] group-hover:bg-[radial-gradient(circle,_rgba(255,255,255,0.18)_0%,_rgba(255,255,255,0.08)_40%,_transparent_70%)] transition-all duration-500 rounded-full" />
              </div>

              {/* Logo with unified sizing */}
              <div className="relative w-full h-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-all duration-500">
                <div className="relative w-full h-full p-2" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
                  <Image
                    src={logo}
                    alt={name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                  />
                </div>
              </div>

              {/* Brand name tooltip */}
              <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] uppercase tracking-wider text-white/50 font-light truncate px-2">{name}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredBrands.length === 0 && (
          <div className="text-center py-20 text-white/30 font-light">
            {locale === 'ua' ? 'Нічого не знайдено' : 'No brands found'}
          </div>
        )}
      </main>
    </div>
  );
}