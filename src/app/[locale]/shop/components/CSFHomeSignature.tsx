import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import type { CsfHeroSummary } from '@/lib/csfHeroCatalog';
import {
  CSF_HERO,
  CSF_TECH_PILLARS,
  CSF_PRODUCT_LINES,
  CSF_HERITAGE,
} from '../data/csfHomeData';
import ScrollRevealClient from './ScrollRevealClient';
import CSFVideoBackground from './CSFVideoBackground';
import CSFHeroFilter from './CSFHeroFilter';
import '../csf/csf-shop.css';

type Props = {
  locale: SupportedLocale;
  smmSource?: string;
  heroSummary?: CsfHeroSummary;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function CSFHomeSignature({ locale, heroSummary }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="csf" id="CSFHome">
      <ScrollRevealClient selector="[data-r]" revealClass="is-vis" />

      {/* ── Back ── */}
      <div className="csf__back">
        <Link href={`/${locale}/shop`} className="csf__back-link">
          &larr; {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════
          1 · HERO — Full-width Video Background
      ══════════════════════════════════════════════════ */}
      <section className="csf__hero csf__hero--full">
        {/* Ambient video background (blurred, darkened) */}
        <div className="csf__hero-video-wrap">
          <CSFVideoBackground youtubeId="4BS_Eg0c2Lc" />
        </div>

        {/* Logo watermark */}
        <div className="csf__watermark csf__watermark--hero-center" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shop/csf/csf-logo.svg" alt="" />
        </div>

        {/* Content — centered */}
        <div className="csf__hero-text csf__hero-text--centered">
          {/* CSF Logo instead of text */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop/csf/csf-logo.svg"
            alt="CSF Racing"
            className="csf__hero-logo"
            data-r
            data-r-delay="1"
          />
          <h1 className="csf__hero-h1" data-r data-r-delay="2">
            {L(isUa, 'Cooling Excellence', 'Досконалість охолодження')}
          </h1>
          <p className="csf__hero-sub" data-r data-r-delay="2">
            {L(isUa, CSF_HERO.subtitle, CSF_HERO.subtitleUk)}
          </p>

          <div data-r data-r-delay="3">
            <Link href={`/${locale}/shop/csf/collections`} className="csf__cta">
              {L(isUa, 'Explore Catalog', 'Переглянути каталог')}
              <span className="csf__cta-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Hero quick finder — overlaps the hero on desktop, sits below on mobile */}
      <div className="csf__finder" data-r data-r-delay="4">
        <CSFHeroFilter locale={locale} summary={heroSummary} />
      </div>

      {/* ══════════════════════════════════════════════════
          2 · TECH PILLARS — 3 columns with logo background
      ══════════════════════════════════════════════════ */}
      <section className="csf__tech">
        {/* Background logo watermark */}
        <div className="csf__watermark csf__watermark--tech" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shop/csf/csf-logo.svg" alt="" />
        </div>

        <div className="csf__tech-header" data-r>
          <h2 className="csf__tech-title">
            {L(isUa, 'Engineering & Technology', 'Інженерія та технології')}
          </h2>
        </div>

        <div className="csf__tech-grid">
          {CSF_TECH_PILLARS.map((pillar, idx) => (
            <div
              key={pillar.id}
              className="csf__tech-card"
              data-r
              data-r-delay={`${idx + 1}`}
            >
              <div className="csf__tech-card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pillar.image}
                  alt={L(isUa, pillar.title, pillar.titleUk)}
                  loading="lazy"
                />
              </div>
              <div className="csf__tech-card-body">
                <h3>{L(isUa, pillar.title, pillar.titleUk)}</h3>
                <p>{L(isUa, pillar.description, pillar.descriptionUk)}</p>

                <div className="csf__tech-specs">
                  {pillar.specs.map((spec, si) => (
                    <div key={si} className="csf__tech-spec">
                      <span className="csf__tech-spec-val">{spec.val}</span>
                      <span className="csf__tech-spec-label">
                        {L(isUa, spec.en, spec.ua)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          3 · PRODUCTS — Editorial Grid
      ══════════════════════════════════════════════════ */}
      <section className="csf__products">
        {/* Background logo watermark */}
        <div className="csf__watermark csf__watermark--products" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shop/csf/csf-logo.svg" alt="" />
        </div>

        <div className="csf__products-header" data-r>
          <h2 className="csf__products-title">
            {L(isUa, 'Product Categories', 'Категорії продукції')}
          </h2>
          <span className="csf__products-count">
            {CSF_PRODUCT_LINES.length} {L(isUa, 'categories', 'категорій')}
          </span>
        </div>

        <div className="csf__products-grid">
          {CSF_PRODUCT_LINES.map((line, idx) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}${line.categoryFilter ? `?category=${line.categoryFilter}` : ''}`}
              className={`csf__product-card${line.featured ? ' csf__product-card--featured' : ''}`}
              data-r
              data-r-delay={`${Math.min(idx + 1, 4)}`}
            >
              <div className="csf__product-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={line.image}
                  alt={L(isUa, line.name, line.nameUk)}
                  loading="lazy"
                />
                <span className="csf__product-badge">
                  {L(isUa, line.badge, line.badgeUk)}
                </span>
              </div>
              <div className="csf__product-body">
                <h3>{L(isUa, line.name, line.nameUk)}</h3>
                <p>{L(isUa, line.description, line.descriptionUk)}</p>
                <span className="csf__product-link">
                  {L(isUa, 'Explore', 'Дослідити')} <span>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          3.5 · SPOTLIGHT — Featured platform: Porsche 992 Turbo
      ══════════════════════════════════════════════════ */}
      <section className="csf__spotlight">
        <div className="csf__spotlight-grid">
          <div className="csf__spotlight-media" data-r>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/shop/csf/spotlight-992-turbo.png"
              alt="Porsche 992 Turbo"
              loading="lazy"
            />
          </div>
          <div className="csf__spotlight-body" data-r data-r-delay="1">
            <span className="csf__spotlight-eyebrow">
              {L(isUa, 'Featured Platform', 'Виділена платформа')}
            </span>
            <h2 className="csf__spotlight-h2">992 Turbo</h2>
            <p className="csf__spotlight-sub">Porsche 911 Turbo · 2020+</p>
            <p className="csf__spotlight-desc">
              {L(
                isUa,
                'Track-grade cooling pack for the 992 Turbo — high-performance radiators, charge-air coolers, and heat exchangers engineered for sustained boost on road and circuit.',
                'Гоночний комплект охолодження для 992 Turbo — високопродуктивні радіатори, інтеркулери та теплообмінники для стабільного буст-тиску на дорозі і треку.'
              )}
            </p>
            <ul className="csf__spotlight-specs">
              <li>
                <span className="csf__spotlight-spec-val">+30%</span>
                <span className="csf__spotlight-spec-label">
                  {L(isUa, 'Cooling capacity', 'Тепловіддача')}
                </span>
              </li>
              <li>
                <span className="csf__spotlight-spec-val">−15°C</span>
                <span className="csf__spotlight-spec-label">
                  {L(isUa, 'Charge-air temp', 'Темп. наддуву')}
                </span>
              </li>
              <li>
                <span className="csf__spotlight-spec-val">OEM-fit</span>
                <span className="csf__spotlight-spec-label">
                  {L(isUa, 'Drop-in install', 'Без переробок')}
                </span>
              </li>
            </ul>
            <Link
              href={`/${locale}/shop/csf/collections?make=Porsche&chassis=992`}
              className="csf__cta"
            >
              {L(isUa, '992 Turbo cooling parts', 'Деталі охолодження 992 Turbo')}
              <span className="csf__cta-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          4 · HERITAGE — Full-width Cinematic Statement
      ══════════════════════════════════════════════════ */}
      <section className="csf__heritage">
        <div className="csf__heritage-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CSF_HERITAGE.backgroundImage}
            alt="CSF Racing Heritage"
            loading="lazy"
          />
        </div>
        <div className="csf__heritage-overlay" />

        <div className="csf__heritage-body" data-r>
          {/* CSF Logo above text */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop/csf/csf-logo-white.png"
            alt="CSF Racing"
            className="csf__heritage-logo"
          />
          <p className="csf__heritage-year">
            {L(isUa, 'Since 1947', 'З 1947 року')}
          </p>
          <h2 className="csf__heritage-h2">
            {L(isUa, CSF_HERITAGE.title, CSF_HERITAGE.titleUk)}
          </h2>
          <p className="csf__heritage-desc">
            {L(isUa, CSF_HERITAGE.description, CSF_HERITAGE.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          5 · FOOTER CTA
      ══════════════════════════════════════════════════ */}
      <div className="csf__footer-cta">
        <Link href={`/${locale}/shop/csf/collections`}>
          {L(isUa, 'Explore the Full Catalog', 'Переглянути повний каталог')}
          <span className="csf__cta-arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
