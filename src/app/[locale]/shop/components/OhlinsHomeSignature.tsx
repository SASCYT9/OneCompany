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

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
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
          ← {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — PRECISION HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-precision-hero">
        <div className="oh-brand-badge" data-oh-reveal>
          One Company × Öhlins
        </div>

        <h1 className="sr-only">
          {L(isUa, 'Öhlins Racing | Premium Suspension Systems & Shock Absorbers', 'Öhlins Racing | Преміальні системи підвіски та амортизатори')}
        </h1>
        <p className="oh-hero-title" data-oh-reveal style={{ transitionDelay: '0.1s' }}>
          {L(isUa, 'Feel The', 'Відчуй')}<br />
          <em>{L(isUa, 'Road', 'Дорогу')}</em>
        </p>

        <p className="oh-hero-subtitle" data-oh-reveal style={{ transitionDelay: '0.2s' }}>
          {L(
            isUa,
            OHLINS_HERO.description,
            'Передові підвіски Öhlins Racing для найвимогливіших водіїв. Чемпіонська технологія з 1976 року — від MotoGP до вашого авто.'
          )}
        </p>

        <div className="oh-hero-stats" data-oh-reveal style={{ transitionDelay: '0.3s' }}>
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="oh-stat">
              <span className="oh-stat-val">{s.value}</span>
              <span className="oh-stat-label">{L(isUa, s.label, s.label)}</span>
            </div>
          ))}
        </div>

        <Link href={`/${locale}/shop/ohlins/collections`} className="oh-btn" data-oh-reveal style={{ transitionDelay: '0.4s' }}>
          {L(isUa, 'Discover Engineering', 'Відкрити інженерію')}
        </Link>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — DFV DECODER (MATERIALS)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-dfv-decoder">
        {OHLINS_MATERIALS.map((mat, i) => {
          const isEven = i % 2 === 0;
          return (
            <div key={i} className="oh-dfv-inner" style={{ marginBottom: i !== OHLINS_MATERIALS.length - 1 ? '6rem' : 0 }}>
              {isEven ? (
                <>
                  <div className="oh-decoder-text" data-oh-reveal>
                    <h2>{L(isUa, mat.name, mat.name)}</h2>
                    <p>{L(isUa, mat.description, mat.description)}</p>
                  </div>
                  <div className="oh-decoder-visual" data-oh-reveal style={{ transitionDelay: '0.2s' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mat.image} alt={mat.name} loading="lazy" />
                  </div>
                </>
              ) : (
                <>
                  <div className="oh-decoder-visual" data-oh-reveal style={{ transitionDelay: '0.2s' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mat.image} alt={mat.name} loading="lazy" />
                  </div>
                  <div className="oh-decoder-text" data-oh-reveal>
                    <h2>{L(isUa, mat.name, mat.name)}</h2>
                    <p>{L(isUa, mat.description, mat.description)}</p>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — APPLICATIONS GRID
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-applications">
        <div className="oh-applications-inner">
          <div className="oh-app-header" data-oh-reveal>
            <h2>{L(isUa, 'Complete Collections', 'Повні колекції')}</h2>
          </div>
          <div className="oh-app-grid">
            {OHLINS_PRODUCT_LINES.map((line, idx) => (
              <Link key={line.id} href={line.link} className="oh-app-card" data-oh-reveal style={{ transitionDelay: `${idx * 0.1}s` }}>
                <h3>{L(isUa, line.name, line.name)}</h3>
                <p>{L(isUa, line.description, line.description)}</p>
                <div className="oh-catalog-link">
                  {L(isUa, 'View Details', 'Детальніше')}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HERITAGE TIMELINE
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-heritage-timeline">
        <div className="oh-heritage-inner" data-oh-reveal>
          <h2>{L(isUa, OHLINS_HERITAGE.title, OHLINS_HERITAGE.title)}</h2>
          <p>{L(isUa, OHLINS_HERITAGE.description, OHLINS_HERITAGE.description)}</p>
        </div>
      </section>

    </div>
  );
}
