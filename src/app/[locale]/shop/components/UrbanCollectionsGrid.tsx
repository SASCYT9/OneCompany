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
      className={`ucg ${visible ? 'is-visible' : ''}`}
    >
      <div className="ucg__hero">
        <div
          className="ucg__hero-bg"
          style={{
            backgroundImage: `url(${URBAN_COLLECTIONS_GRID_SETTINGS.heroImage})`,
          }}
        />
        <div className="ucg__hero-overlay" />
        <div className="ucg__hero-content">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ucg__hero-logo"
            src={ONE_COMPANY_LOGO}
            alt="One Company"
            width={260}
            height={96}
          />
          {subheading && <p className="ucg__hero-sub">{subheading}</p>}
        </div>
      </div>

      {URBAN_COLLECTIONS_GRID_SETTINGS.showFilters && (
        <div className="ucg__filters">
          <button
            type="button"
            className={`ucg__filter-btn ${filter === 'all' ? 'is-active' : ''}`}
            data-filter="all"
            onClick={() => setFilter('all')}
          >
            {isUa ? 'Всі' : 'All'}
          </button>
          {URBAN_COLLECTION_BRANDS.map((brand) => {
            const key = slugifyBrand(brand);
            return (
              <button
                key={brand}
                type="button"
                className={`ucg__filter-btn ${filter === key ? 'is-active' : ''}`}
                data-filter={key}
                onClick={() => setFilter(key)}
              >
                {brand}
              </button>
            );
          })}
        </div>
      )}

      <div className="ucg__grid">
        {filteredCards.map((card, idx) => (
          <div
            key={card.collectionHandle}
            className="ucg__card"
            data-brand={slugifyBrand(card.brand)}
          >
            <Link
              href={`/${locale}/shop/urban/collections/${card.collectionHandle}`}
              className="ucg__card-link"
              aria-label={card.title}
            />
            <img
              className="ucg__card-img"
              src={card.externalImageUrl}
              alt=""
              loading="lazy"
            />
            <div className="ucg__card-gradient" />
            {card.productCount && (
              <div className="ucg__card-count">{card.productCount}</div>
            )}
            <div className="ucg__card-content">
              {card.brand && <p className="ucg__card-brand">{card.brand}</p>}
              <h2 className="ucg__card-title">{card.title}</h2>
              <div className="ucg__card-arrow">
                {exploreLabel}
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
