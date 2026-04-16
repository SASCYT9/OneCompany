import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  OHLINS_HERO,
  OHLINS_STATS,
  OHLINS_PRODUCT_LINES,
  OHLINS_HERITAGE,
  OHLINS_MATERIALS,
} from '../data/ohlinsHomeData';

import OhlinsCanvas from './canvas/OhlinsCanvas';
import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string | undefined) {
  return isUa && ua ? ua : en;
}

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="oh-home" id="OhlinsHome">
      <ScrollRevealClient selector="[data-oh-reveal]" revealClass="oh-vis" />

      {/* ── Gold Dust Canvas ── */}
      <OhlinsCanvas />

      {/* ── Back to Stores ── */}
      <div className="oh-back">
        <Link href={`/${locale}/shop`} className="oh-back__link">
          ← {L(isUa, 'All Stores', 'Всі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — PRECISION HERO (STEALTH WEALTH)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-precision-hero">
        {/* Ambient Video Background */}
        <video 
          className="oh-hero-bg-video"
          src="/videos/shop/ohlins-hero-bg.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline
        />
        <div className="oh-hero-bg-overlay"></div>

        <div className="oh-hero-content">
          <div className="oh-brand-badge" data-oh-reveal>
            One Company × Öhlins
          </div>

          <h1 className="sr-only">
            {L(isUa, 'Öhlins Racing | Premium Suspension Systems & Shock Absorbers', 'Öhlins Racing | Преміальні системи підвіски та амортизатори')}
          </h1>
          <p className="oh-hero-title" data-oh-reveal style={{ transitionDelay: '0.1s' }}>
            {L(isUa, OHLINS_HERO.title, OHLINS_HERO.titleUa)}<br />
            <em>{L(isUa, 'PERFORMANCE', 'ДОСКОНАЛІСТЬ')}</em>
          </p>

          <p className="oh-hero-subtitle" data-oh-reveal style={{ transitionDelay: '0.2s' }}>
            {L(isUa, OHLINS_HERO.description, OHLINS_HERO.descriptionUa)}
          </p>

          <div className="oh-hero-stats" data-oh-reveal style={{ transitionDelay: '0.3s' }}>
            {OHLINS_STATS.map((s, i) => (
              <div key={i} className="oh-stat">
                <span className="oh-stat-val">{s.value}</span>
                <span className="oh-stat-label">{L(isUa, s.label, s.labelUa)}</span>
              </div>
            ))}
          </div>

          <Link href={`/${locale}/shop/ohlins/catalog`} className="oh-btn" data-oh-reveal style={{ transitionDelay: '0.4s' }}>
            {L(isUa, 'Find Your Suspension', 'Знайти свою підвіску')}
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — DFV DECODER (MATERIALS BENTO)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-dfv-decoder">
        <div className="oh-dfv-inner">
          {OHLINS_MATERIALS.map((mat, i) => {
            const isEven = i % 2 === 0;
            return (
              <div key={i} className="oh-decoder-row" data-oh-reveal>
                {isEven ? (
                  <>
                    <div className="oh-decoder-text">
                      <h2>{L(isUa, mat.name, mat.nameUa)}</h2>
                      <p>{L(isUa, mat.description, mat.descriptionUa)}</p>
                    </div>
                    <div className="oh-decoder-visual">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mat.image} alt={mat.name} loading="lazy" />
                      <div className="oh-decoder-glow"></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="oh-decoder-visual">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mat.image} alt={mat.name} loading="lazy" />
                      <div className="oh-decoder-glow"></div>
                    </div>
                    <div className="oh-decoder-text">
                      <h2>{L(isUa, mat.name, mat.nameUa)}</h2>
                      <p>{L(isUa, mat.description, mat.descriptionUa)}</p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — APPLICATIONS BENTO GRID
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-applications">
        <div className="oh-applications-inner">
          <div className="oh-app-header" data-oh-reveal>
            <h2>{L(isUa, 'Complete Collections', 'Повні колекції')}</h2>
          </div>
          <div className="oh-app-bento-grid">
            {OHLINS_PRODUCT_LINES.map((line, idx) => {
              // Ensure we don't duplicate dynamic locale routes
              const targetUrl = line.link.startsWith('/shop') 
                ? `/${locale}${line.link}` 
                : `/${locale}/shop/ohlins/collections/${line.link}`;

              return (
                <Link key={line.id} href={targetUrl} className={`oh-bento-card card-${idx}`} data-oh-reveal style={{ transitionDelay: `${idx * 0.1}s` }}>
                  <div className="oh-bento-content">
                    <h3>{L(isUa, line.name, line.nameUa)}</h3>
                    <p>{L(isUa, line.description, line.descriptionUa)}</p>
                    <div className="oh-catalog-link">
                      {L(isUa, 'View Details', 'Детальніше')}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                  <div className="oh-bento-img-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={line.image} alt={line.name} className="oh-bento-img" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Full Catalog CTA */}
          <div style={{ textAlign: 'center', marginTop: '4rem' }} data-oh-reveal>
            <Link href={`/${locale}/shop/ohlins/catalog`} className="oh-btn">
              {L(isUa, 'Browse Full Catalog', 'Переглянути весь каталог')}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HERITAGE
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-heritage-timeline">
        <div className="oh-heritage-inner" data-oh-reveal>
          <div className="oh-heritage-text">
            <h2>{L(isUa, OHLINS_HERITAGE.title, OHLINS_HERITAGE.titleUa)}</h2>
            <p>{L(isUa, OHLINS_HERITAGE.description, OHLINS_HERITAGE.descriptionUa)}</p>
          </div>
          <div className="oh-heritage-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={OHLINS_HERITAGE.image} alt={OHLINS_HERITAGE.title} className="oh-heritage-img" />
          </div>
        </div>
      </section>

    </div>
  );
}
