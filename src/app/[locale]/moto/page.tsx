// src/app/[locale]/moto/page.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { allMotoBrands, LocalBrand } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import Image from 'next/image';
import Link from 'next/link';

// Define product categories
const productCategories = [
  { name: 'exhaust', href: '/categories/exhaust' },
  { name: 'suspension', href: '/categories/suspension' },
  { name: 'brakes', href: '/categories/brakes' },
  { name: 'gear', href: '/categories/gear' },
  { name: 'helmets', href: '/categories/helmets' },
  { name: 'accessories', href: '/categories/accessories' },
  { name: 'luggage', href: '/categories/luggage' },
  { name: 'carbon', href: '/categories/carbon' },
];

// Placeholder for featured brands
const featuredBrands: LocalBrand[] = [
  { name: 'Akrapovic', description: 'High-performance exhaust systems' },
  { name: 'Brembo', description: 'World leader in braking systems' },
  { name: 'SC-Project', description: 'Racing exhaust systems' },
  { name: 'Bitubo Suspension', description: 'Suspension and steering dampers' },
  { name: 'Arrow', description: 'Exhaust systems for sportbikes' },
  { name: 'Termignoni', description: 'Italian performance exhausts' },
  { name: 'Rotobox', description: 'Carbon fiber wheels' },
  { name: 'Ilmberger Carbon', description: 'Premium carbon fiber parts' },
  { name: 'CNC Racing', description: 'High-end custom components' },
  { name: 'Austin Racing', description: 'Handmade, high-performance exhausts' },
].slice(0, 10);

export default function MotoPage() {
  const t = useTranslations('moto');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const filteredBrands = allMotoBrands.filter((brand) => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLetter = activeLetter ? brand.name.toUpperCase().startsWith(activeLetter) : true;
    return matchesSearch && matchesLetter;
  });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Hero Section */}
      <header className="text-center py-24 bg-gradient-to-b from-black via-gray-900 to-black">
        <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-4">{t('title')}</h1>
        <p className="text-lg text-white/70 font-light max-w-3xl mx-auto">{t('subtitle')}</p>
      </header>

      {/* Product Categories Section */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-light text-center mb-12">{t('productCategories')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {productCategories.map((cat) => (
            <Link key={cat.name} href={cat.href} className="group p-6 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-center">
              <h3 className="text-lg font-light text-white/90 group-hover:text-white">{t(`categories.${cat.name}`)}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Top 10 Brands Section */}
      <section className="py-16 bg-gray-900/50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-light text-center mb-12">{t('featuredBrands')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {featuredBrands.map((brand, index) => (
              <div key={`${brand.name}-${index}`} className="relative bg-white/5 rounded-lg flex flex-col items-center justify-center p-6 text-center overflow-hidden group hover:bg-white/10 transition-all">
                <div className="relative w-full aspect-video mb-4">
                  <Image
                    src={getBrandLogo(brand.name)}
                    alt={brand.name}
                    fill
                    className="object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                    sizes="(max-width: 768px) 50vw, 20vw"
                    unoptimized
                  />
                </div>
                <h3 className="text-lg font-medium mb-1">{brand.name}</h3>
                <p className="text-xs text-white/60 line-clamp-2">{brand.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Brands A-Z Section */}
      <section className="container mx-auto px-6 py-24">
        <h2 className="text-3xl font-light text-center mb-8">{t('allBrands')}</h2>
        <div className="flex justify-center mb-8">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md bg-white/5 border border-white/10 rounded-full px-6 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          <button onClick={() => setActiveLetter(null)} className={`px-3 py-1 text-sm rounded-full ${!activeLetter ? 'bg-orange-500 text-black' : 'bg-white/10 text-white/70'}`}>
            {t('all')}
          </button>
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => setActiveLetter(letter)}
              className={`px-3 py-1 text-sm rounded-full ${activeLetter === letter ? 'bg-orange-500 text-black' : 'bg-white/10 text-white/70'}`}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredBrands.length > 0 ? (
            filteredBrands.map((brand) => (
              <div
                key={brand.name}
                className="group rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all p-4 flex flex-col items-center justify-center text-center"
                title={brand.name}
              >
                <div className="relative w-full aspect-video mb-2">
                  <Image
                    src={getBrandLogo(brand.name)}
                    alt={brand.name}
                    fill
                    className="object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    unoptimized
                  />
                </div>
                <span className="text-xs text-white/70 truncate w-full">{brand.name}</span>
              </div>
            ))
          ) : (
            <p className="col-span-full text-center text-white/70">{t('noBrands')}</p>
          )}
        </div>
      </section>
    </div>
  );
}