import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  OHLINS_HERO,
  OHLINS_PRODUCT_LINES,
  OHLINS_HERITAGE,
  OHLINS_MATERIALS,
  OHLINS_PILLARS,
  OHLINS_LEGENDS,
  OHLINS_RACE_SERIES,
  OHLINS_TIMELINE,
} from '../data/ohlinsHomeData';
import type { OhlinsHeroVehicleMake } from '@/lib/ohlinsCatalog';

import OhlinsCanvas from './canvas/OhlinsCanvas';
import OhlinsHeroFilter from './OhlinsHeroFilter';
import ScrollRevealClient from './ScrollRevealClient';

type Props = {
  locale: SupportedLocale;
  availableVehicles?: OhlinsHeroVehicleMake[];
};

function L(isUa: boolean, en: string, ua: string | undefined) {
  return isUa && ua ? ua : en;
}

function getOhlinsCollectionHref(locale: SupportedLocale, lineId: string) {
  const params = new URLSearchParams();

  if (lineId === 'road-track') {
    params.set('category', 'Road & Track');
  } else if (lineId === 'advanced-track') {
    params.set('category', 'Advanced Trackday');
  } else if (lineId === 'dedicated-track') {
    params.set('category', 'Motorsport');
  }

  const query = params.toString();
  return query
    ? `/${locale}/shop/ohlins/catalog?${query}`
    : `/${locale}/shop/ohlins/catalog`;
}

export default function OhlinsHomeSignature({ locale, availableVehicles }: Props) {
  const isUa = locale === 'ua';
  const vehicles = availableVehicles ?? [];

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
        {/* Cinematic still — BMW M4 at Nürburgring with Ken Burns drift */}
        <div className="oh-hero-bg-image" />
        <div className="oh-hero-bg-overlay"></div>
        <div className="oh-hero-bg-vignette"></div>

        <div className="oh-hero-content">
          <div className="oh-brand-badge" data-oh-reveal>
            <span className="oh-badge-dot"></span>
            {L(isUa,
              'official distributor · est. 2007 · one company',
              'офіційний дистриб\'ютор · з 2007 · one company'
            )}
          </div>

          <h1 className="sr-only">
            {L(isUa, 'Öhlins Racing | Premium Suspension Systems & Shock Absorbers', 'Öhlins Racing | Преміальні системи підвіски та амортизатори')}
          </h1>
          <div className="oh-hero-wordmark" data-oh-reveal style={{ transitionDelay: '0.1s' }}>
            <span className="oh-wordmark-text">ÖHLINS</span>
            <span className="oh-wordmark-r">®</span>
            <span className="oh-wordmark-sub">Racing — Advanced Suspension Technology</span>
          </div>

          <div className="oh-hero-divider" data-oh-reveal style={{ transitionDelay: '0.15s' }} aria-hidden></div>

          <p className="oh-hero-subtitle" data-oh-reveal style={{ transitionDelay: '0.2s' }}>
            {L(isUa, OHLINS_HERO.description, OHLINS_HERO.descriptionUa)}
          </p>

          <div className="oh-hero-actions" data-oh-reveal style={{ transitionDelay: '0.3s' }}>
            <Link href={`/${locale}/shop/ohlins/catalog`} className="oh-btn">
              {L(isUa, 'Browse Catalogue', 'Переглянути каталог')}
            </Link>
            <Link href="#OhlinsTechnology" className="oh-btn-ghost">
              {L(isUa, 'Engineering', 'Технологія')}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </Link>
          </div>

          <div className="oh-hero-filter-wrap" data-oh-reveal style={{ transitionDelay: '0.4s' }}>
            <OhlinsHeroFilter locale={locale} vehicles={vehicles} />
          </div>
        </div>

        {/* Floating product card — gold TTX36 coilover render */}
        <div className="oh-hero-product" data-oh-reveal style={{ transitionDelay: '0.5s' }} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shop/ohlins/hero-product.png" alt="" loading="lazy" />
          <span className="oh-hero-product-tag">TTX36 · Featured</span>
        </div>

        {/* Race series marquee strip — proof points without numbers */}
        <div className="oh-race-marquee" aria-hidden="true">
          <div className="oh-race-marquee-track">
            {(() => {
              const trimmed = OHLINS_RACE_SERIES.slice(0, 5);
              return [...trimmed, ...trimmed].map((s, i) => (
                <span key={i} className="oh-race-chip">{s}</span>
              ));
            })()}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — TECHNOLOGY PILLARS (3-COLUMN GLASS CARDS)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-pillars" id="OhlinsTechnology">
        <div className="oh-pillars-inner">
          <div className="oh-section-eyebrow" data-oh-reveal>
            <span className="oh-eyebrow-line" aria-hidden="true"></span>
            {L(isUa, 'Technology', 'Технологія')}
            <span className="oh-eyebrow-line" aria-hidden="true"></span>
          </div>
          <h2 className="oh-section-title" data-oh-reveal>
            {L(isUa, 'Three principles. One standard.', 'Три принципи. Один стандарт.')}
          </h2>
          <div className="oh-pillars-grid">
            {OHLINS_PILLARS.map((p, i) => (
              <article key={p.icon} className="oh-pillar-card" data-oh-reveal style={{ transitionDelay: `${0.1 + i * 0.1}s` }}>
                <div className="oh-pillar-icon" aria-hidden>
                  {p.icon === 'dfv' && (
                    /* Up/down arrows = symmetric compression / rebound */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M7 8l5-5 5 5"/><path d="M7 16l5 5 5-5"/></svg>
                  )}
                  {p.icon === 'aluminum' && (
                    /* Honeycomb cell = aerospace alloy lattice */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l8.5 5v9L12 21.5 3.5 16.5v-9z"/><path d="M12 7.5v9M3.5 7.5l8.5 5 8.5-5"/></svg>
                  )}
                  {p.icon === 'sweden' && (
                    /* Swedish flag — proper proportions */
                    <svg viewBox="0 0 24 16" fill="none" stroke="none" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="24" height="16" fill="#006aa7"/><rect x="6" y="0" width="3" height="16" fill="#fecc00"/><rect x="0" y="6.5" width="24" height="3" fill="#fecc00"/></svg>
                  )}
                </div>
                <h3 className="oh-pillar-label">{L(isUa, p.label, p.labelUa)}</h3>
                <p className="oh-pillar-body">{L(isUa, p.body, p.bodyUa)}</p>
                <span className="oh-pillar-corner" aria-hidden></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — DFV DECODER (MATERIALS BENTO)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-dfv-decoder">
        <div className="oh-dfv-inner">
          {OHLINS_MATERIALS.map((mat, i) => {
            const isEven = i % 2 === 0;
            const decoderAlt = L(
              isUa,
              `Technical illustration: ${mat.name}`,
              `Технічна ілюстрація: ${mat.name}`
            );
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
                      <img src={mat.image} alt={decoderAlt} loading="lazy" />
                      <div className="oh-decoder-glow" aria-hidden="true"></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="oh-decoder-visual">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mat.image} alt={decoderAlt} loading="lazy" />
                      <div className="oh-decoder-glow" aria-hidden="true"></div>
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
          SECTION 4 — INSTALLED ON LEGENDS (PORSCHE SHOWCASE)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-legends">
        <div className="oh-legends-inner">
          <div className="oh-legends-visual" data-oh-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OHLINS_LEGENDS.image}
              alt={L(isUa,
                'Black Porsche 911 with a gold Öhlins TTX coilover installed on the rear hub',
                'Чорний Porsche 911 із встановленим золотим койловером Öhlins TTX на задній колодці')}
              loading="lazy"
            />
            <div className="oh-legends-tag" aria-hidden="true">Porsche · Öhlins TTX</div>
          </div>
          <div className="oh-legends-text" data-oh-reveal style={{ transitionDelay: '0.15s' }}>
            <div className="oh-section-eyebrow oh-eyebrow-left">
              <span className="oh-eyebrow-line" aria-hidden="true"></span>
              {L(isUa, 'OEM-Sanctioned', 'OEM-санкціоновано')}
            </div>
            <h2 className="oh-section-title oh-title-left">
              {L(isUa, OHLINS_LEGENDS.title, OHLINS_LEGENDS.titleUa)}
            </h2>
            <p className="oh-legends-body">
              {L(isUa, OHLINS_LEGENDS.description, OHLINS_LEGENDS.descriptionUa)}
            </p>
            <div className="oh-legends-brands">
              {OHLINS_LEGENDS.brands.map((b) => (
                <span key={b} className="oh-brand-chip">{b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — APPLICATIONS BENTO GRID
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-applications">
        <div className="oh-applications-inner">
          <div className="oh-app-header" data-oh-reveal>
            <div className="oh-section-eyebrow">
              <span className="oh-eyebrow-line" aria-hidden="true"></span>
              {L(isUa, 'Catalogue', 'Каталог')}
              <span className="oh-eyebrow-line" aria-hidden="true"></span>
            </div>
            <h2>{L(isUa, 'The Catalogue.', 'Повний асортимент.')}</h2>
          </div>
          <div className="oh-app-bento-grid">
            {OHLINS_PRODUCT_LINES.map((line, idx) => {
              const targetUrl = getOhlinsCollectionHref(locale, line.id);

              return (
                <Link key={line.id} href={targetUrl} className={`oh-bento-card card-${idx}`} data-oh-reveal style={{ transitionDelay: `${idx * 0.1}s` }}>
                  <span className="oh-bento-index" aria-hidden>{String(idx + 1).padStart(2, '0')}</span>
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
              {L(isUa, 'Open the full catalogue', 'Відкрити повний каталог')}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6 — HERITAGE
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-heritage-timeline">
        <div className="oh-heritage-inner" data-oh-reveal>
          <div className="oh-heritage-text">
            <div className="oh-section-eyebrow oh-eyebrow-left">
              <span className="oh-eyebrow-line" aria-hidden="true"></span>
              {L(isUa, 'Made in Sweden', 'Зроблено у Швеції')}
              <span
                className="oh-flag-sweden"
                role="img"
                aria-label={L(isUa, 'Flag of Sweden', 'Прапор Швеції')}
              ></span>
            </div>
            <h2>{L(isUa, OHLINS_HERITAGE.title, OHLINS_HERITAGE.titleUa)}</h2>
            <p>{L(isUa, OHLINS_HERITAGE.description, OHLINS_HERITAGE.descriptionUa)}</p>
            <ol className="oh-heritage-timeline-list" aria-label={L(isUa, 'Öhlins timeline', 'Хронологія Öhlins')}>
              {OHLINS_TIMELINE.map((t, i) => (
                <li key={t.year} className="oh-tl-item" data-oh-reveal style={{ transitionDelay: `${0.1 + i * 0.08}s` }}>
                  <span className="oh-tl-dot" aria-hidden="true"></span>
                  <span className="oh-tl-year">{t.year}</span>
                  <span className="oh-tl-label">{L(isUa, t.label, t.labelUa)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="oh-heritage-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OHLINS_HERITAGE.image}
              alt={L(isUa,
                'Öhlins assembly hall in Upplands Väsby, Sweden — engineers building and tuning dampers',
                'Виробничий цех Öhlins у Upplands Väsby, Швеція — інженери збирають і налаштовують амортизатори')}
              className="oh-heritage-img"
            />
            <div className="oh-heritage-img-tag" aria-hidden="true">Öhlins HQ · Sweden</div>
          </div>
        </div>
      </section>

    </div>
  );
}
