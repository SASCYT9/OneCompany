'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LocalBrand } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import Image from 'next/image';
import Link from 'next/link';

// Define moto product categories with brand tags
const productCategories = [
  { 
    name: 'exhaust', 
    href: '/categories/moto-exhaust',
    brands: ['Akrapovic', 'SC-Project', 'Termignoni', 'Arrow'],
    hiddenBrandsCount: 4
  },
  { 
    name: 'suspension', 
    href: '/categories/moto-suspension',
    brands: ['Bitubo', 'Öhlins', 'Nitron', 'Hyperpro'],
    hiddenBrandsCount: 4
  },
  { 
    name: 'wheels', 
    href: '/categories/moto-wheels',
    brands: ['Rotobox', 'BST Carbon Fiber', 'Marchesini', 'Brembo'],
    hiddenBrandsCount: 4
  },
  { 
    name: 'carbon', 
    href: '/categories/moto-carbon',
    brands: ['Ilmberger Carbon', 'Fullsix Carbon', 'Carbon2Race', 'CRC Fairings'],
    hiddenBrandsCount: 4
  },
  { 
    name: 'controls', 
    href: '/categories/moto-controls',
    brands: ['CNC Racing', 'Valtermoto', 'Gilles Tooling', 'Rizoma'],
    hiddenBrandsCount: 4
  },
  { 
    name: 'electronics', 
    href: '/categories/moto-electronics',
    brands: ['Starlane', 'AiM Sports', 'Dynojet', 'Bazzaz'],
    hiddenBrandsCount: 4
  },
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

interface MotoPageClientProps {
  brands: LocalBrand[];
  locale: string;
}

export default function MotoPageClient({ brands, locale }: MotoPageClientProps) {
  const t = useTranslations('moto');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const filteredBrands = brands.filter((brand) => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLetter = activeLetter ? brand.name.toUpperCase().startsWith(activeLetter) : true;
    return matchesSearch && matchesLetter;
  });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Hero Section */}
      <header className="relative text-center py-32 bg-gradient-to-b from-black via-gray-900 to-black overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,107,0,0.1),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-orange-100 to-orange-300 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-xl text-white/80 font-light max-w-4xl mx-auto px-6 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>
      </header>

      {/* Product Categories Section */}
      <section className="container mx-auto px-6 py-20">
        <p className="text-center text-white/50 text-sm tracking-[0.3em] uppercase mb-4">
          {locale === 'ua' ? 'Категорії брендів' : 'Brand Categories'}
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          {t('title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productCategories.map((cat) => (
            <div 
              key={cat.name} 
              className="group relative p-6 bg-black rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300"
            >
              {/* Category Title */}
              <h3 className="text-xl font-semibold text-white mb-3">
                {t(`categories.${cat.name}`)}
              </h3>
              
              {/* Category Description */}
              <p className="text-white/60 text-sm mb-2 leading-relaxed">
                {t(`categoryDescriptions.${cat.name}.line1`)}
              </p>
              <p className="text-white/40 text-xs mb-6 leading-relaxed">
                {t(`categoryDescriptions.${cat.name}.line2`)}
              </p>
              
              {/* Brand Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {cat.brands.map((brand) => (
                  <span 
                    key={brand}
                    className="px-3 py-1.5 text-xs font-medium text-white/80 bg-white/5 border border-white/10 rounded-full"
                  >
                    {brand.toUpperCase()}
                  </span>
                ))}
                {cat.hiddenBrandsCount > 0 && (
                  <span className="px-3 py-1.5 text-xs font-medium text-white/60 bg-white/5 border border-white/10 rounded-full">
                    +{cat.hiddenBrandsCount} {locale === 'ua' ? 'ЩЕ' : 'MORE'}
                  </span>
                )}
              </div>
              
              {/* Open Link */}
              <Link 
                href={`/${locale}${cat.href}`}
                className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium tracking-wide uppercase transition-colors group/link"
              >
                <span>{locale === 'ua' ? 'Відкрити' : 'Open'}</span>
                <span className="w-16 h-px bg-white/20 group-hover/link:bg-white/40 transition-colors" />
                <svg 
                  className="w-4 h-4 transform group-hover/link:translate-x-1 transition-transform" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Top 10 Brands Section */}
      <section className="py-24 bg-gradient-to-b from-gray-900/30 to-black relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,107,0,0.05),transparent_50%)]" />
        <div className="container mx-auto px-6 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t('featuredBrands')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {featuredBrands.map((brand, index) => (
              <div 
                key={`${brand.name}-${index}`} 
                className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-2xl flex flex-col items-center justify-center p-6 text-center overflow-hidden group hover:from-orange-500/20 hover:to-orange-600/10 transition-all duration-300 border border-white/10 hover:border-orange-500/50 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-transparent group-hover:from-orange-500/10 transition-all duration-500" />
                <div className="relative w-full aspect-video mb-4">
                  <Image
                    src={getBrandLogo(brand.name)}
                    alt={brand.name}
                    fill
                    className="object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                    sizes="(max-width: 768px) 50vw, 20vw"
                    unoptimized
                  />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white/90 group-hover:text-white transition-colors">{brand.name}</h3>
                <p className="text-xs text-white/60 group-hover:text-white/80 line-clamp-2 transition-colors">{brand.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Brands A-Z Section */}
      <section className="container mx-auto px-6 py-24">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          {t('allBrands')}
        </h2>
        
        {/* Search Bar */}
        <div className="flex justify-center mb-12">
          <div className="relative w-full max-w-2xl">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl px-8 py-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 transition-all duration-300 text-lg"
            />
          </div>
        </div>

        {/* Alphabet Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-16">
          <button 
            onClick={() => setActiveLetter(null)} 
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
              !activeLetter 
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/50 scale-110' 
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            {t('all')}
          </button>
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => setActiveLetter(letter)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activeLetter === letter 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/50 scale-110' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Brands Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredBrands.length > 0 ? (
            filteredBrands.map((brand) => (
              <div
                key={brand.name}
                className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 hover:from-orange-500/20 hover:to-orange-600/10 hover:border-orange-500/50 transition-all duration-300 p-5 flex flex-col items-center justify-center text-center hover:scale-105 cursor-pointer overflow-hidden relative"
                title={brand.name}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-transparent group-hover:from-orange-500/10 transition-all duration-500" />
                <div className="relative w-full aspect-video mb-3">
                  <Image
                    src={getBrandLogo(brand.name)}
                    alt={brand.name}
                    fill
                    className="object-contain opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    unoptimized
                  />
                </div>
                <span className="text-sm font-medium text-white/70 group-hover:text-white truncate w-full transition-colors">{brand.name}</span>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <p className="text-xl text-white/70">{t('noBrands')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
