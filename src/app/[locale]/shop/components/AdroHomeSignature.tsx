import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  ADRO_HERO,
  ADRO_STATS,
  ADRO_PRODUCT_LINES,
  ADRO_TECHNOLOGY,
  ADRO_MATERIALS,
} from '../data/adroHomeData';

import AdroCanvas from './canvas/AdroCanvas';
import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function AdroHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="adro-home" id="AdroHome">
      <ScrollRevealClient selector="[data-adro-reveal]" revealClass="adro-vis" />

      {/* ── Flow Matrix Canvas ── */}
      <AdroCanvas />

      {/* ── Back to Stores ── */}
      <div className="adro-back">
        <Link href={`/${locale}/shop`} className="adro-back__link">
          [ESC] {L(isUa, 'Return to Index', 'Повернутись')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — FLOW HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-flow-hero">
        <div className="adro-crosshair adro-crosshair-top-left"></div>
        <div className="adro-crosshair adro-crosshair-top-right"></div>
        <div className="adro-crosshair adro-crosshair-bottom-left"></div>
        <div className="adro-crosshair adro-crosshair-bottom-right"></div>

        <div className="adro-flow-content" data-adro-reveal>
          <h1 className="sr-only">
            {L(isUa, 'ADRO | Aerodynamics & Carbon Fiber Aero Kits', 'ADRO | Аеродинаміка та карбонові обвіси')}
          </h1>
          <p className="adro-hero-title">
            {L(isUa, 'Carbon', 'Карбоновий')}<br />
            <em>{L(isUa, 'Phantom', 'Фантом')}</em>
          </p>
          <p className="adro-hero-subtitle">
            {L(isUa, ADRO_HERO.subtitle, ADRO_HERO.subtitleUk)}
          </p>

          <Link href={`/${locale}/shop/adro/collections`} className="adro-btn">
            {L(isUa, 'Initiate Data Link', 'Запустити каталог')}
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — CFD HUD DASHBOARD
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-cfd-hud">
        <div className="adro-hud-grid">
          
          <div className="adro-hud-panel" data-adro-reveal>
            <h2>{L(isUa, 'SYS_METRICS', 'МЕТРИКИ')}</h2>
            <div className="adro-metrics-grid">
              {ADRO_STATS.map((s, i) => (
                <div key={i} className="adro-metric-box">
                  <span className="adro-metric-val">{s.val}</span>
                  <span className="adro-metric-label">{L(isUa, s.en, s.ua)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '2rem' }}>
              <h2>{L(isUa, ADRO_TECHNOLOGY.title, ADRO_TECHNOLOGY.titleUk)}</h2>
              <p>{L(isUa, ADRO_TECHNOLOGY.description, ADRO_TECHNOLOGY.descriptionUk)}</p>
            </div>
          </div>

          <div className="adro-hud-panel adro-hud-panel--visual" data-adro-reveal style={{ transitionDelay: '0.2s' }}>
            <div className="adro-hud-overlay-text">CFD_SIMULATION_ACTIVE</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ADRO_TECHNOLOGY.image} alt={L(isUa, ADRO_TECHNOLOGY.title, ADRO_TECHNOLOGY.titleUk)} />
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — CARBON MACRO
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-macro">
        <div className="adro-macro-inner">
          <div className="adro-macro-image" data-adro-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ADRO_MATERIALS.image} alt={L(isUa, ADRO_MATERIALS.title, ADRO_MATERIALS.titleUk)} />
          </div>
          <div className="adro-macro-content" data-adro-reveal style={{ transitionDelay: '0.2s' }}>
            <h2>{L(isUa, ADRO_MATERIALS.title, ADRO_MATERIALS.titleUk)}</h2>
            <p>{L(isUa, ADRO_MATERIALS.description, ADRO_MATERIALS.descriptionUk)}</p>
            
            <div className="adro-macro-specs">
              {ADRO_MATERIALS.specs.map((s, i) => (
                <div key={i} className="adro-ms-item">
                  <span className="adro-ms-val">{s.val}</span>
                  <span className="adro-ms-label">{L(isUa, s.label, s.labelUk)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — SKEWED PLATFORM TRACK
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-platforms">
        <div className="adro-platforms-inner">
          <div className="adro-platforms-header" data-adro-reveal>
            <h2>{L(isUa, 'Platform Data', 'База Платформ')}</h2>
          </div>
          
          <div className="adro-skew-grid">
            {ADRO_PRODUCT_LINES.map((line, idx) => (
              <Link key={line.id} href={line.link} className="adro-skew-card" data-adro-reveal style={{ transitionDelay: `${(idx * 0.1)}s` }}>
                <div className="adro-sc-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={line.image} alt={L(isUa, line.name, line.nameUk)} />
                </div>
                <div className="adro-sc-content">
                  <span className="adro-sc-badge">{L(isUa, line.badge, line.badgeUk)}</span>
                  <div style={{ padding: '1rem 0' }}>
                    <h3 className="adro-sc-title">{L(isUa, line.name, line.nameUk)}</h3>
                    <p className="adro-sc-desc">{L(isUa, line.description, line.descriptionUk)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
