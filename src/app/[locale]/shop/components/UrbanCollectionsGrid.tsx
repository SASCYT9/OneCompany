'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import {
  URBAN_COLLECTION_CARDS,
  URBAN_COLLECTIONS_GRID_SETTINGS,
  URBAN_COLLECTION_BRANDS,
} from '../data/urbanCollectionsList';
import type { UrbanCollectionCard } from '../data/urbanCollectionsList';

const ONE_COMPANY_LOGO = 'https://onecompany.global/branding/logo-light.svg';

type UrbanCollectionsGridProps = {
  locale: SupportedLocale;
  /** When provided, only these cards are shown (e.g. those with a collection page config). */
  cards?: UrbanCollectionCard[];
};

function slugifyBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function UrbanCollectionsGrid({ locale, cards: cardsProp }: UrbanCollectionsGridProps) {
  const isUa = locale === 'ua';
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const baseCards = cardsProp ?? URBAN_COLLECTION_CARDS;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.05 }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  const filteredCards = filter === 'all'
    ? baseCards
    : baseCards.filter((c) => slugifyBrand(c.brand) === filter);

  const subheading = isUa
    ? URBAN_COLLECTIONS_GRID_SETTINGS.subheadingUk
    : URBAN_COLLECTIONS_GRID_SETTINGS.subheading;
  const exploreLabel = isUa ? 'Дослідити' : 'Explore';

  return (
    <section
      ref={rootRef}
      id="UrbanCollGrid"
      className={`mx-auto w-full max-w-[1720px] px-6 py-12 md:px-12 lg:px-16 xl:py-20 transition-all duration-1000 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className="relative aspect-[3/1] min-h-[440px] w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#050505] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] ease-linear hover:scale-110"
          style={{
            backgroundImage: `url(${URBAN_COLLECTIONS_GRID_SETTINGS.heroImage})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 backdrop-blur-[2px]" />
        
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c29d59] drop-shadow-md">
            {URBAN_COLLECTIONS_GRID_SETTINGS.eyebrow}
          </p>
          <img
            className="mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            src={ONE_COMPANY_LOGO}
            alt="One Company"
            width={280}
            height={104}
          />
          {subheading && (
            <p className="max-w-2xl text-balance text-lg font-light leading-relaxed text-white/80 drop-shadow-md md:text-xl">
              {subheading}
            </p>
          )}
        </div>
      </div>

      {URBAN_COLLECTIONS_GRID_SETTINGS.showFilters && (
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-[13px] font-medium uppercase tracking-[0.15em] transition duration-300 ${
              filter === 'all'
                ? 'border-[#c29d59]/50 bg-gradient-to-br from-[#c29d59]/20 to-[#c29d59]/5 text-[#ead29d] shadow-[0_8px_30px_rgba(194,157,89,0.2)]'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:bg-white/10 hover:text-white'
            }`}
            data-filter="all"
            onClick={() => setFilter('all')}
          >
            {isUa ? 'Всі' : 'All'}
          </button>
          
          {URBAN_COLLECTION_BRANDS.map((brand) => {
            const key = slugifyBrand(brand);
            const isActive = filter === key;
            return (
              <button
                key={brand}
                type="button"
                className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-[13px] font-medium uppercase tracking-[0.15em] transition duration-300 ${
                  isActive
                    ? 'border-[#c29d59]/50 bg-gradient-to-br from-[#c29d59]/20 to-[#c29d59]/5 text-[#ead29d] shadow-[0_8px_30px_rgba(194,157,89,0.2)]'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:bg-white/10 hover:text-white'
                }`}
                data-filter={key}
                onClick={() => setFilter(key)}
              >
                {brand}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCards.map((card) => (
          <div
            key={card.collectionHandle}
            className="group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] shadow-[0_20px_70px_rgba(0,0,0,0.28)] transition-all duration-500 hover:-translate-y-2 hover:border-[#c29d59]/40 hover:shadow-[0_30px_90px_rgba(194,157,89,0.15)]"
            data-brand={slugifyBrand(card.brand)}
          >
            <Link
              href={`/${locale}/shop/urban/collections/${card.collectionHandle}`}
              className="absolute inset-0 z-20"
              aria-label={card.title}
            />
            <div className="absolute inset-0 z-0 h-full w-full overflow-hidden bg-[#0a0a0a]">
              <img
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 group-hover:opacity-90"
                src={card.externalImageUrl}
                alt=""
                loading="lazy"
              />
            </div>
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            
            {card.productCount && (
              <div className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                {card.productCount}
              </div>
            )}
            
            <div className="relative z-10 mt-auto p-6 md:p-8">
              {card.brand && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c29d59]">
                  {card.brand}
                </p>
              )}
              <h2 className="text-2xl font-bold leading-tight text-white drop-shadow-lg transition-colors duration-300 group-hover:text-[#ead29d]">
                {card.title}
              </h2>
              <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/70 transition-colors duration-300 group-hover:text-white">
                {exploreLabel}
                <svg
                  viewBox="0 0 24 24"
                  width={16}
                  height={16}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
