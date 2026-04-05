import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  GIRODISC_HERO,
  GIRODISC_STATS,
  GIRODISC_PRODUCT_LINES,
  GIRODISC_MATERIALS,
  GIRODISC_HERITAGE,
} from '../data/girodiscHomeData';

import ScrollRevealClient from './ScrollRevealClient';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function GiroDiscHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="gd-home" id="GiroDiscHome">
      <ScrollRevealClient selector="[data-gd-reveal]" revealClass="gd-vis" />

      {/* ── Back to Stores ── */}
      <div className="gd-back">
        <Link href={`/${locale}/shop`} className="gd-back__link">
          ← {L(isUa, 'Stores', 'Магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — FORGE HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-forge-hero">
        <div className="gd-forge-hero__bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GIRODISC_HERO.heroImageFallback} alt="GiroDisc Rotors Background" />
        </div>

        <div className="gd-hero-content" data-gd-reveal>
          <h1 className="sr-only">
            {L(isUa, 'GiroDisc | High Performance Brake Rotors', 'GiroDisc | Високопродуктивні гальмівні диски')}
          </h1>
          <p className="gd-hero-title">
            Braking <span>Forged</span>
          </p>
          <p className="gd-hero-subtitle">
            {L(isUa, GIRODISC_HERO.subtitle, GIRODISC_HERO.subtitleUk)}
          </p>
          <Link href={`/${locale}/shop/girodisc/collections`} className="gd-btn">
            {L(isUa, GIRODISC_HERO.ctaText, GIRODISC_HERO.ctaTextUk)}
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — FOUNDRY SPECS
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-foundry-specs">
        {GIRODISC_STATS.map((s, i) => (
          <div key={i} className="gd-spec-block" data-gd-reveal style={{ transitionDelay: `${i * 0.1}s` }}>
            <span className="gd-spec-val">{s.val}</span>
            <span className="gd-spec-label">{L(isUa, s.en, s.ua)}</span>
          </div>
        ))}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — VANE TECHNOLOGY
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-vane-tech">
        <div className="gd-vane-inner">
          {GIRODISC_MATERIALS.map((mat, i) => (
            <div key={i} className="gd-vane-item" data-gd-reveal>
              <div className="gd-vi-text">
                <h2>{L(isUa, mat.title, mat.titleUk)}</h2>
                <p>{L(isUa, mat.description, mat.descriptionUk)}</p>
              </div>
              <div className="gd-vi-image">
                <div className="gd-vi-image-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mat.image} alt={L(isUa, mat.title, mat.titleUk)} loading="lazy" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HARDWARE GRID
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-hardware">
        <div className="gd-hw-inner">
          <div className="gd-hw-header" data-gd-reveal>
            <h2>{L(isUa, 'Performance Hardware', 'Елементи гальмування')}</h2>
          </div>
          <div className="gd-hw-grid">
            {GIRODISC_PRODUCT_LINES.map((line, idx) => (
              <Link key={line.id} href={line.link} className="gd-hw-card" data-gd-reveal style={{ transitionDelay: `${idx * 0.1}s` }}>
                <div className="gd-hc-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={line.image} alt={L(isUa, line.name, line.nameUk)} loading="lazy" />
                </div>
                <div className="gd-hc-content">
                  <span className="gd-hc-badge">{L(isUa, line.badge, line.badgeUk)}</span>
                  <h3 className="gd-hc-title">{L(isUa, line.name, line.nameUk)}</h3>
                  <p className="gd-hc-desc">{L(isUa, line.description, line.descriptionUk)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — HERITAGE
      ════════════════════════════════════════════════════════════════ */}
      <section className="gd-heritage" data-gd-reveal>
        <div className="gd-ht-inner">
          <h2>{L(isUa, GIRODISC_HERITAGE.title, GIRODISC_HERITAGE.titleUk)}</h2>
          <p>{L(isUa, GIRODISC_HERITAGE.description, GIRODISC_HERITAGE.descriptionUk)}</p>
        </div>
      </section>

    </div>
  );
}
