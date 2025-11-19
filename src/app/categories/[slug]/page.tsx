'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useParams } from 'next/navigation';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandModal } from '@/components/ui/BrandModal';
import { alphabet, groupBrandsByLetter } from '@/lib/brandUtils';
import { BrandCategory, getBrandsByCategory, getBrandsByNames, LocalBrand, brandMetadata, countryNames, subcategoryNames } from '@/lib/brands';
import { categoryData } from '@/lib/categoryData';
import { getCategoryMeta, isCategorySlug } from '@/lib/categoryMeta';
import type { SimpleBrand } from '@/lib/types';

const FALLBACK_BRAND_CATEGORY: BrandCategory = 'auto';

export default function CategoryPage() {
  const { locale } = useLanguage();
  const lang = (locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';
  const params = useParams<{ slug?: string }>();
  const slugParam = params?.slug ?? '';
  const categorySlug = isCategorySlug(slugParam) ? slugParam : undefined;
  const meta = categorySlug ? getCategoryMeta(categorySlug) : undefined;
  const categoryInfo = categorySlug ? categoryData.find(cat => cat.slug === categorySlug) : undefined;
  const brandCategory: BrandCategory = categoryInfo?.segment === 'moto' ? 'moto' : FALLBACK_BRAND_CATEGORY;
  
  // State for the modal should use the type the modal expects
  const [selectedBrand, setSelectedBrand] = useState<SimpleBrand | null>(null);
  
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => setMounted(true), []);

  // Handle scroll for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle deep link hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && /^[A-Z]$/.test(hash)) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [mounted]);

  // These brands are of type LocalBrand
  const curatedBrands: LocalBrand[] = useMemo(() => {
    if (categoryInfo) {
      const matches = getBrandsByNames(categoryInfo.brands, brandCategory);
      if (matches.length) {
        return matches;
      }
    }
    return getBrandsByCategory(brandCategory);
  }, [brandCategory, categoryInfo]);

  const allBrands: LocalBrand[] = useMemo(() => curatedBrands, [curatedBrands]);
  
  const brands: LocalBrand[] = useMemo(() => {
    if (!searchQuery.trim()) return allBrands;
    const q = searchQuery.toLowerCase();
    return allBrands.filter(b => b.name.toLowerCase().includes(q));
  }, [allBrands, searchQuery]);

  const grouped = useMemo(() => groupBrandsByLetter(brands), [brands]);
  const lettersWithBrands = useMemo(() => alphabet.filter(l => grouped[l]?.length), [grouped]);

  // This function converts a LocalBrand to a SimpleBrand for the modal
  const handleBrandClick = (brand: LocalBrand) => {
    const resolvedCategory: BrandCategory = brand.category ?? brandCategory;
    const simpleBrand: SimpleBrand = {
      name: brand.name,
      logo: brand.logoUrl,
      category: resolvedCategory,
      description: brand.description,
      website: brand.website,
      features: brand.specialties,
      technologies: [], // LocalBrand doesn't have this, so pass an empty array
    };
    setSelectedBrand(simpleBrand);
  };

  if (!meta) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">
        <div className="text-white/60">{locale==='ua' ? 'Категорію не знайдено' : 'Category not found'}</div>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60 text-sm tracking-widest uppercase">{locale==='ua' ? 'Завантаження...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="relative bg-black min-h-screen text-white overflow-hidden">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-gradient-to-br from-orange-500/10 via-rose-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-amber-500/10 via-yellow-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <main className="relative container mx-auto px-6 py-20">
        {/* Intro */}
        <header className="mb-16 text-center animate-fade-in">
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/30 font-light mb-4">{locale==='ua' ? 'Категорія' : 'Category'}</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">{locale==='ua' ? meta.title.ua : meta.title.en}</h1>
          <p className="text-white/70 font-light text-lg max-w-3xl mx-auto">{locale==='ua' ? meta.intro.ua : meta.intro.en}</p>
        </header>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto mb-12 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="relative group">
            <input
              type="text"
              placeholder={locale==='ua' ? 'Пошук брендів...' : 'Search brands...'}
              className="w-full bg-gradient-to-br from-white/[0.08] to-white/[0.03] text-white px-8 py-4 border border-white/10 focus:border-orange-500/30 focus:outline-none transition-all duration-300 text-sm tracking-wider placeholder:text-white/30 backdrop-blur-sm shadow-lg rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg 
              className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-orange-500/60 transition-colors duration-300" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-14 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* Sticky side alphabet nav (desktop only) */}
          <aside className="hidden lg:block sticky top-24 w-16 flex-shrink-0">
            <nav className="space-y-1">
              {alphabet.map(letter => {
                const count = grouped[letter]?.length || 0;
                const has = count > 0;
                return (
                  <a
                    key={letter}
                    href={has ? `#${letter}` : undefined}
                    aria-disabled={!has}
                    className={`group relative flex items-center justify-center w-12 h-12 text-xs font-light tracking-wider transition-all duration-300 ${
                      has
                        ? 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white hover:scale-110 border border-white/10'
                        : 'bg-white/[0.02] text-white/15 border border-white/5 cursor-default'
                    }`}
                    title={has ? `${letter} (${count})` : letter}
                  >
                    {letter}
                    {has && count > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500/80 text-white text-[9px] flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        {count}
                      </span>
                    )}
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Main content area */}
          <div className="flex-1 min-w-0">

            {/* Brand groups */}
            <section className="space-y-10">
              {lettersWithBrands.map((letter, idx) => (
                <div 
                  key={letter} 
                  id={letter} 
                  className="scroll-mt-28 animate-fade-in"
                  style={{ animationDelay: `${200 + idx * 50}ms` }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-white/80 text-sm font-light border border-white/10 rounded-lg shadow-lg">
                      {letter}
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
                    <span className="text-xs text-white/40 font-light">{grouped[letter]!.length} {locale==='ua' ? 'брендів' : 'brands'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped[letter]!.map(brand => {
                      const meta = brandMetadata[brand.name];
                      const country = meta ? countryNames[meta.country][lang] : undefined;
                      const subcategory = meta ? subcategoryNames[meta.subcategory][lang] : undefined;

                      return (
                      <button
                        key={brand.name}
                        onClick={() => handleBrandClick(brand)}
                        className="group relative p-6 bg-gradient-to-br from-white/[0.06] to-white/[0.02] hover:from-white/[0.1] hover:to-white/[0.05] transition-all duration-500 backdrop-blur-sm text-left border border-white/10 rounded-xl shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-36 h-20 bg-white/5 group-hover:bg-white/10 transition-colors rounded-lg p-2">
                            <BrandLogo name={brand.name} src={brand.logoUrl} className="max-w-full" />
                          </div>
                          <div>
                            <div className="text-white/90 group-hover:text-white text-lg font-light mb-1">{brand.name}</div>
                            <div className="text-white/40 text-xs tracking-wider uppercase">
                              {country ? <span className="text-orange-400/80">{country}</span> : null}
                              {country && subcategory ? <span className="mx-1.5 text-white/20">•</span> : null}
                              {subcategory || brand.category}
                            </div>
                          </div>
                        </div>
                      </button>
                    )})}
                  </div>
                </div>
              ))}
            </section>

            {brands.length === 0 && (
              <div className="text-center py-24 text-white/50 animate-fade-in">
                <div className="inline-block p-6 bg-white/5 border border-white/10 rounded-xl mb-6">
                  <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm tracking-wider">{locale==='ua' ? 'Бренди не знайдено' : 'No brands found'}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Back to top button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-50 w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-full shadow-xl hover:shadow-orange-500/40 hover:scale-110 transition-all duration-300 flex items-center justify-center animate-fade-in"
          aria-label="Back to top"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      {selectedBrand && (
        <BrandModal isOpen={!!selectedBrand} onClose={() => setSelectedBrand(null)} brand={selectedBrand} />
      )}
    </div>
  );
}
