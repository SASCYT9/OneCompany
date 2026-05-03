'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import {
  AKRAPOVIC_HERO,
  AKRAPOVIC_GALLERY,
  AKRAPOVIC_PRODUCT_LINES,
  AKRAPOVIC_HERITAGE,
} from '../data/akrapovicHomeData';
import { AKRAPOVIC_SOUNDS } from '../data/akrapovicSoundData';
import AkrapovicVideoBackground from './AkrapovicVideoBackground';
import AkrapovicSoundPlayer from './AkrapovicSoundPlayer';
import AkrapovicVehicleFilter from './AkrapovicVehicleFilter';

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function AkrapovicHomeSignature({ locale, products, viewerContext }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-ak-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('ak-vis');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ak-home" id="AkrapovicHome">
      {/* ── Back to Stores ── */}
      <div className="ak-back">
        <Link href={`/${locale}/shop`} className="ak-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO (full viewport, center-aligned)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-hero" id="ak-hero-section">
        <AkrapovicVideoBackground
          videoSrc={AKRAPOVIC_HERO.heroVideoUrl}
          fallbackImage={AKRAPOVIC_HERO.heroImageFallback}
          fallbackWidth={AKRAPOVIC_HERO.heroImageWidth}
          fallbackHeight={AKRAPOVIC_HERO.heroImageHeight}
          overlayStyle="hero"
          withAudio
          isMuted
        />

        <div className="ak-hero__content" data-ak-reveal>
          <div className="ak-hero__logo-wrapper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/akrapovic.svg" alt="Akrapovič" className="ak-hero__logo" />
          </div>

          <p className="ak-hero__overtitle">
            One Company × Akrapovič
          </p>

          <h1 className="sr-only">
            {L(isUa, 'Akrapovič Exhaust Systems | Titanium & Carbon', 'Автомобільні вихлопні системи Akrapovič | Титан і Карбон')}
          </h1>
          <p className="ak-hero__title">
            {L(isUa, 'The Sound of', 'Звук')}<br />
            <em>{L(isUa, 'Perfection', 'Досконалості')}</em>
          </p>

          <p className="ak-hero__subtitle">
            {L(isUa, AKRAPOVIC_HERO.subtitle, AKRAPOVIC_HERO.subtitleUk)}
          </p>

          <AkrapovicVehicleFilter
            locale={locale}
            products={products}
            viewerContext={viewerContext}
            productPathPrefix={`/${locale}/shop/akrapovic/products`}
            filterOnly
            heroCompact
          />
        </div>

        {/* Scroll indicator */}
        <div className="ak-hero__scroll" aria-hidden>
          <div className="ak-hero__scroll-line" />
        </div>
      </section>

      <section className="ak-gallery" data-ak-reveal>
        <div className="ak-gallery__grid">
          {AKRAPOVIC_GALLERY.map((item, index) => (
            <article
              key={item.id}
              className={`ak-gallery__card${index === 0 ? ' ak-gallery__card--featured' : ''}`}
            >
              <div className="ak-gallery__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt=""
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-lines" data-ak-reveal>
        <div className="ak-lines__header">
          <span className="ak-label">
            {L(isUa, 'Product Lines', 'Лінійки продукції')}
          </span>
          <h2 className="ak-section-title">
            {L(isUa, 'Engineered for Your Machine', 'Створено для вашої машини')}
          </h2>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-lines__track">
          {AKRAPOVIC_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="ak-line-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ak-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                width={line.imageWidth}
                height={line.imageHeight}
                loading="lazy"
                decoding="async"
              />
              <div className="ak-line-card__overlay" />
              <span className="ak-line-card__badge">
                {L(isUa, line.badge, line.badgeUk)}
              </span>
              <div className="ak-line-card__content">
                <h3 className="ak-line-card__name">
                  {L(isUa, line.name, line.nameUk)}
                </h3>
                <p className="ak-line-card__desc">
                  {L(isUa, line.description, line.descriptionUk)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — SOUND COMPARISON GRID (interactive audio)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-sounds" data-ak-reveal>
        <div className="ak-sounds__header">
          <span className="ak-label">
            {L(isUa, 'Hear the difference', 'Почуйте різницю')}
          </span>
          <h2 className="ak-section-title">
            {L(isUa, 'Every Engine Has Its Voice', 'Кожен двигун має свій голос')}
          </h2>
          <p className="ak-section-sub" style={{ margin: '1.5rem auto 0' }}>
            {L(
              isUa,
              'Click on any car to hear the Akrapovič exhaust note. Short clips captured at our test facility.',
              'Натисніть на будь-яке авто, щоб почути звук вихлопу Akrapovič. Короткі записи з нашого тестувального полігону.'
            )}
          </p>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-sounds__grid">
          {AKRAPOVIC_SOUNDS.map((entry) => (
            <AkrapovicSoundPlayer
              key={entry.id}
              entry={entry}
              isUa={isUa}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6 — SOUND WAVE DIVIDER (second)
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 8 + ((i * 13) % 24);
          return (
            <div
              key={i}
              className="ak-wave__bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${Number((i * 0.06).toFixed(2))}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7 — HERITAGE (video background + storytelling)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-heritage" data-ak-reveal>
        <AkrapovicVideoBackground
          videoSrc={AKRAPOVIC_HERITAGE.videoUrl}
          fallbackImage={AKRAPOVIC_HERITAGE.fallbackImage}
          fallbackWidth={AKRAPOVIC_HERITAGE.fallbackWidth}
          fallbackHeight={AKRAPOVIC_HERITAGE.fallbackHeight}
          overlayStyle="heritage"
          defer
        />

        <div className="ak-heritage__content">
          <span className="ak-label">
            {L(isUa, 'Heritage', 'Спадщина')}
          </span>
          <h2 className="ak-heritage__title">
            {L(isUa, AKRAPOVIC_HERITAGE.title, AKRAPOVIC_HERITAGE.titleUk)}
          </h2>
          <div className="ak-divider ak-divider--center" />
          <p className="ak-heritage__desc">
            {L(isUa, AKRAPOVIC_HERITAGE.description, AKRAPOVIC_HERITAGE.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 8 — BOTTOM CTA (single, subtle)
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-bottom-cta" data-ak-reveal>
        <span className="ak-label">
          {L(isUa, 'Ready to upgrade?', 'Готові до апгрейду?')}
        </span>
        <br />
        <Link href={`/${locale}/shop/akrapovic/collections`} className="ak-btn">
          {L(isUa, 'Explore Catalog', 'Переглянути каталог')}
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
