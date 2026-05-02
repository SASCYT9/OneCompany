'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import {
  DO88_COLLECTION_CARDS,
  DO88_COLLECTIONS_GRID_SETTINGS,
} from '../data/do88CollectionsList';
import type { Do88CollectionCard } from '../data/do88CollectionsList';

const DO88_LOGO = '/images/shop/do88/logo-white.png'; // Make sure this exists or it will gracefully break

type Do88CollectionsGridProps = {
  locale: SupportedLocale;
  cards?: Do88CollectionCard[];
};

export default function Do88CollectionsGrid({ locale, cards: cardsProp }: Do88CollectionsGridProps) {
  const isUa = locale === 'ua';
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const searchParams = useSearchParams();

  // When used on the homepage (no `cards` prop), drop entries flagged
  // `hiddenFromHome` — those categories stay reachable via the filter dropdown
  // and the dedicated /collections listing, just not on the home grid.
  // When the caller explicitly passes `cards` (e.g. /collections listing),
  // trust them and render exactly what was passed.
  const baseCards = cardsProp ?? DO88_COLLECTION_CARDS.filter((card) => !card.hiddenFromHome);

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

  const subheading = isUa
    ? DO88_COLLECTIONS_GRID_SETTINGS.subheadingUk
    : DO88_COLLECTIONS_GRID_SETTINGS.subheading;
  const exploreLabel = isUa ? 'Переглянути' : 'Explore';

  // Construct search params string if vehicle filter was used
  const brand = searchParams?.get('brand');
  const keyword = searchParams?.get('keyword');
  const qs = new URLSearchParams();
  if (brand) qs.set('brand', brand);
  if (keyword) qs.set('keyword', keyword);
  const qString = qs.toString() ? `?${qs.toString()}` : '';

  return (
    <section
      ref={rootRef}
      id="catalog"
      className={`ucg ${visible ? 'is-visible' : ''}`}
      style={{ minHeight: 'auto', paddingBottom: '80px' }}
    >
      <div className="ucg__grid" style={{ paddingTop: 40 }}>
        {baseCards.map((card, idx) => {
          const cardTitle = isUa ? (card.titleUk || card.title) : card.title;
          
          return (
            <div
              key={card.categoryHandle}
              className="ucg__card"
            >
              <Link
                href={`/${locale}/shop/do88/collections/${card.categoryHandle}${qString}`}
                className="ucg__card-link"
                aria-label={cardTitle}
              />
              <img
                className="ucg__card-img"
                src={card.externalImageUrl}
                alt={cardTitle}
                loading="lazy"
              />
              <div className="ucg__card-gradient" />
              
              <div className="ucg__card-content">
                <p className="ucg__card-brand text-white/40 font-light uppercase tracking-widest text-[10px]">DO88 Cooling</p>
                <h2 className="ucg__card-title">{cardTitle}</h2>
                <div className="ucg__card-arrow text-white/50 hover:text-white transition">
                  {exploreLabel}
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
