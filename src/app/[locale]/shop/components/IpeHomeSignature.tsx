import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  IPE_HERO,
  IPE_VALVETRONIC,
  IPE_MATERIALS,
  IPE_PRODUCT_LINES,
} from '../data/ipeHomeData';

import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

function getIpeCollectionHref(locale: SupportedLocale, brand: string) {
  const params = new URLSearchParams({ brand });
  return `/${locale}/shop/ipe/collections?${params.toString()}`;
}

export default function IpeHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="ipe-home" id="IpeHome">
      <ScrollRevealClient selector="[data-ipe-reveal]" revealClass="ipe-vis" />

      {/* ── Back to Stores ── */}
      <div className="ipe-back">
        <Link href={`/${locale}/shop`} className="ipe-back__link">
          ← {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-hero">
        <div className="ipe-hero__bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shop/ipe/ipe-lamborghini-svj.jpg" alt="iPE Valvetronic Exhaust System" />
        </div>
        <div className="ipe-hero__overlay" />
        <div className="ipe-hero__accent" aria-hidden />

        <div className="ipe-hero__content" data-ipe-reveal>
          {/* Official iPE logo */}
          <div className="ipe-hero__logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/shop/ipe/ipe-logo.png" alt="iPE Innotech Performance Exhaust" />
          </div>

          <div className="ipe-hero__divider" aria-hidden />

          <h1 className="ipe-hero__title">
            {L(isUa, 'Titanium', 'Титанова')}<br />
            <em>{L(isUa, 'Precision', 'Досконалість')}</em>
          </h1>

          <p className="ipe-hero__eyebrow">
            One Company × iPE Exhaust
          </p>

          <p className="ipe-hero__subtitle">
            {L(isUa, IPE_HERO.subtitle, IPE_HERO.subtitleUk)}
          </p>

          <div className="ipe-hero__buttons">
            <Link href={`/${locale}/shop/ipe/collections`} className="ipe-btn">
              {L(isUa, 'Discover the Collection', 'Переглянути колекцію')}
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="ipe-hero__scroll" aria-hidden>
          <div className="ipe-hero__scroll-line" />
        </div>
      </section>



      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — VALVETRONIC TECHNOLOGY
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-valvetronic">
        <div className="ipe-valvetronic__inner">
          <div className="ipe-valvetronic__image-wrap" data-ipe-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IPE_VALVETRONIC.image} alt={L(isUa, IPE_VALVETRONIC.title, IPE_VALVETRONIC.titleUk)} />
          </div>
          <div className="ipe-valvetronic__content" data-ipe-reveal style={{ transitionDelay: '0.15s' }}>
            <h2>{L(isUa, IPE_VALVETRONIC.title, IPE_VALVETRONIC.titleUk)}</h2>
            <p>{L(isUa, IPE_VALVETRONIC.description, IPE_VALVETRONIC.descriptionUk)}</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — VEHICLE LINEUP (Visual Cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-lineup">
        <div className="ipe-lineup__header" data-ipe-reveal>
          <span className="ipe-label">
            {L(isUa, 'Applications', 'Застосування')}
          </span>
          <h2 className="ipe-section-title">
            {L(isUa, 'Vehicle Lineup', 'Модельний Ряд')}
          </h2>
          <div className="ipe-header-line" />
          <p className="ipe-section-sub" style={{ textAlign: 'center', margin: '1.2rem auto 0' }}>
            {L(isUa,
              'Full titanium Valvetronic systems engineered for the world\'s most iconic machines.',
              'Повноцінні титанові Valvetronic-системи для найкультовіших автомобілів світу.'
            )}
          </p>
        </div>

        <div className="ipe-lineup__grid">
          {IPE_PRODUCT_LINES.map((line, idx) => (
            <Link
              key={line.id}
              href={getIpeCollectionHref(locale, line.name)}
              className="ipe-vehicle-card"
              data-ipe-reveal
              style={{ transitionDelay: `${idx * 0.08}s` }}
            >
              <div className="ipe-vehicle-card__image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={line.image} alt={L(isUa, line.name, line.nameUk)} loading={idx < 3 ? 'eager' : 'lazy'} />
              </div>
              <div className="ipe-vehicle-card__overlay" />
              <span className="ipe-vehicle-card__badge">
                {L(isUa, line.badge, line.badgeUk)}
              </span>
              <div className="ipe-vehicle-card__content">
                <h3 className="ipe-vehicle-card__name">{L(isUa, line.name, line.nameUk)}</h3>
                <p className="ipe-vehicle-card__desc">{L(isUa, line.description, line.descriptionUk)}</p>
                <span className="ipe-vehicle-card__cta">
                  {L(isUa, 'Explore', 'Дослідити')}
                  <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — TITANIUM GRADE
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-titanium">
        <div className="ipe-titanium__inner">
          <div className="ipe-titanium__content" data-ipe-reveal>
            <h2>{L(isUa, IPE_MATERIALS.title, IPE_MATERIALS.titleUk)}</h2>
            <p>{L(isUa, IPE_MATERIALS.description, IPE_MATERIALS.descriptionUk)}</p>
          </div>
          <div className="ipe-titanium__image-wrap" data-ipe-reveal style={{ transitionDelay: '0.15s' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IPE_MATERIALS.image} alt={L(isUa, IPE_MATERIALS.title, IPE_MATERIALS.titleUk)} />
          </div>
        </div>
      </section>



    </div>
  );
}
