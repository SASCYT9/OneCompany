import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  IPE_HERO,
  IPE_STATS,
  IPE_VALVETRONIC,
  IPE_MATERIALS,
  IPE_PRODUCT_LINES,
} from '../data/ipeHomeData';

import IpeAudioConsole from './IpeAudioConsole';
import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
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
          SECTION 1 — ACOUSTIC STUDIO HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-acoustic-hero">
        <div className="ipe-acoustic-hero__bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IPE_HERO.heroImage} alt="iPE Valvetronic Exhaust Concept" />
        </div>

        <div className="ipe-acoustic-hero__content" data-ipe-reveal>
          {/* Audio Console & Canvas integrated directly into Hero */}
          <IpeAudioConsole />

          <h1 className="sr-only">
            {L(isUa, 'iPE Exhaust | Valvetronic Exhaust Systems', 'iPE Exhaust | Вихлопні системи Valvetronic')}
          </h1>
          <p className="ipe-hero-title">
            {L(isUa, 'Crimson', 'Барвистий')}<br />
            {L(isUa, 'Velocity', 'Звук')}
          </p>

          <p className="ipe-hero-subtitle">
            {L(isUa, IPE_HERO.subtitle, IPE_HERO.subtitleUk)}
          </p>

          <Link href={`/${locale}/shop/ipe/collections`} className="ipe-btn">
            {L(isUa, 'Discover the Collection', 'Переглянути колекцію')}
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>

        {/* Floating Metrics Bar */}
        <div className="ipe-metrics">
          {IPE_STATS.map((m, i) => (
            <div key={i} className="ipe-metric">
              <span className="ipe-metric-val">{m.val}</span>
              <span className="ipe-metric-label">{L(isUa, m.en, m.ua)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — VALVETRONIC DASHBOARD
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-valve-dash">
        <div className="ipe-dash-inner">
          <div className="ipe-dash-visual" data-ipe-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IPE_VALVETRONIC.image} alt={L(isUa, IPE_VALVETRONIC.title, IPE_VALVETRONIC.titleUk)} />
          </div>
          <div className="ipe-dash-content" data-ipe-reveal>
            <h2>{L(isUa, IPE_VALVETRONIC.title, IPE_VALVETRONIC.titleUk)}</h2>
            <p>{L(isUa, IPE_VALVETRONIC.description, IPE_VALVETRONIC.descriptionUk)}</p>
            
            <div className="ipe-specs-list">
              {IPE_VALVETRONIC.specs.map((s, i) => (
                <div key={i} className="ipe-spec-item">
                  <span className="ipe-spec-v">{s.val}</span>
                  <span className="ipe-spec-l">{L(isUa, s.label, s.labelUk)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — THERMAL TITANIUM PROCESS
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-thermal-process">
        <div className="ipe-thermal-inner">
          <div className="ipe-thermal-text" data-ipe-reveal>
            <h2>{L(isUa, IPE_MATERIALS.title, IPE_MATERIALS.titleUk)}</h2>
            <p>{L(isUa, IPE_MATERIALS.description, IPE_MATERIALS.descriptionUk)}</p>
            
            <div className="ipe-specs-list" style={{ marginTop: '2rem' }}>
              {IPE_MATERIALS.specs.map((s, i) => (
                <div key={i} className="ipe-spec-item">
                  <span className="ipe-spec-v">{s.val}</span>
                  <span className="ipe-spec-l">{L(isUa, s.label, s.labelUk)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ipe-thermal-image" data-ipe-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IPE_MATERIALS.image} alt={L(isUa, IPE_MATERIALS.title, IPE_MATERIALS.titleUk)} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — DNA TRACKLIST (Modular Lineup)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ipe-dna-tracklist">
        <div className="ipe-dna-inner">
          <div className="ipe-dna-header" data-ipe-reveal>
            <h2>{L(isUa, 'Vehicle DNA', 'Модельний Ряд')}</h2>
          </div>
          <div className="ipe-track-grid">
            {IPE_PRODUCT_LINES.map((line, idx) => (
              <Link key={line.id} href={line.link} className="ipe-track" data-ipe-reveal style={{ transitionDelay: `${(idx % 3) * 0.1}s` }}>
                <div className="ipe-track-no">0{idx + 1}</div>
                <div className="ipe-track-info">
                  <span className="ipe-track-name">{L(isUa, line.name, line.nameUk)}</span>
                  <span className="ipe-track-desc">{L(isUa, line.description, line.descriptionUk)}</span>
                </div>
                <div className="ipe-track-action">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
