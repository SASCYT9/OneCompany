import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  RACECHIP_HERO,
  RACECHIP_STATS,
  RACECHIP_PRODUCT_LINES,
  RACECHIP_APP,
  RACECHIP_ENGINEERING,
  RACECHIP_HERITAGE,
} from '../data/racechipHomeData';
import ScrollRevealClient from './ScrollRevealClient';
import '../racechip/racechip-shop.css';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function RacechipHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  return (
    <div className="rc" id="RacechipHome">
      <ScrollRevealClient selector="[data-rc]" revealClass="is-vis" />

      {/* ── Back to Stores ── */}
      <div className="rc__back">
        <Link href={`/${locale}/shop`} className="rc__back-link">
          &larr; {L(isUa, 'All Stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          1 · CINEMATIC HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/shop/racechip/hero-stealth-fixed.png"
          alt=""
          className="rc__hero-img"
        />
        <div className="rc__hero-dim" />

        <div className="rc__hero-body">
          <p className="rc__eyebrow" data-rc>
            {L(isUa, RACECHIP_HERO.eyebrow, RACECHIP_HERO.eyebrowUk)}
          </p>

          <h1 className="rc__hero-wordmark" data-rc data-rc-delay="1">
            <span className="rc__wordmark-text">
              RACECHIP
            </span>
            <span className="rc__wordmark-r">®</span>
            <span className="rc__wordmark-sub">Chiptuning — Made in Germany</span>
          </h1>

          <p className="rc__hero-sub" data-rc data-rc-delay="2">
            {L(isUa, RACECHIP_HERO.subtitle, RACECHIP_HERO.subtitleUk)}
          </p>

          <div data-rc data-rc-delay="3">
            <Link
              href={`/${locale}${RACECHIP_HERO.primaryButtonLink}`}
              className="rc__cta"
            >
              {L(isUa, RACECHIP_HERO.primaryButtonLabel, RACECHIP_HERO.primaryButtonLabelUk)}
              <span className="rc__cta-arrow">→</span>
            </Link>
          </div>
        </div>

        <div className="rc__scroll-hint" aria-hidden="true">
          <span>Scroll</span>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          2 · PRODUCT LINEUP
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__lineup">
        <div className="rc__lineup-inner">
          <div className="rc__lineup-header" data-rc>
            <h2 className="rc__lineup-title">
              {L(isUa, 'Product Range', 'Модельний ряд')}
            </h2>
            <span className="rc__lineup-count">
              {RACECHIP_PRODUCT_LINES.length} {L(isUa, 'products', 'продуктів')}
            </span>
          </div>

          <div className="rc__lineup-grid">
            {RACECHIP_PRODUCT_LINES.map((line, idx) => (
              <Link
                key={line.title}
                href={`/${locale}${line.link}`}
                className="rc__card"
                data-rc
                data-rc-delay={`${Math.min(idx + 1, 4)}`}
              >
                <div className="rc__card-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={line.imageUrl}
                    alt={L(isUa, line.title, line.titleUk)}
                    loading="lazy"
                  />
                  <span className="rc__card-badge">
                    {L(isUa, line.badge, line.badgeUk)}
                  </span>
                </div>
                <div className="rc__card-body">
                  <h3>{L(isUa, line.title, line.titleUk)}</h3>
                  <p className="rc__card-sub">
                    {L(isUa, line.subtitle, line.subtitleUk)}
                  </p>
                  <p className="rc__card-desc">
                    {L(isUa, line.description, line.descriptionUk)}
                  </p>
                  <span className="rc__card-link">
                    {L(isUa, 'Explore', 'Дослідити')} <span>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          3 · APP CONTROL FEATURE
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__feature">
        <div className="rc__feature-glow" />
        <div className="rc__feature-inner">
          <div className="rc__feature-media" data-rc>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={RACECHIP_APP.imageUrl}
              alt="RaceChip App Control Interface"
              loading="lazy"
            />
          </div>
          <div data-rc data-rc-delay="1">
            <div className="rc__feature-label">
              <span>{L(isUa, RACECHIP_APP.label, RACECHIP_APP.labelUk)}</span>
            </div>
            <h2 className="rc__feature-title">
              {L(isUa, RACECHIP_APP.title, RACECHIP_APP.titleUk)}
            </h2>
            <p className="rc__feature-desc">
              {L(isUa, RACECHIP_APP.description, RACECHIP_APP.descriptionUk)}
            </p>
            <ul className="rc__feature-list">
              {RACECHIP_APP.features.map((f, i) => (
                <li key={i}>{L(isUa, f.en, f.uk)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          4 · PRECISION ENGINEERING
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__feature rc__feature--reverse">
        <div className="rc__feature-glow" />
        <div className="rc__feature-inner">
          <div className="rc__feature-text" data-rc>
            <div className="rc__feature-label">
              <span>{L(isUa, RACECHIP_ENGINEERING.label, RACECHIP_ENGINEERING.labelUk)}</span>
            </div>
            <h2 className="rc__feature-title">
              {L(isUa, RACECHIP_ENGINEERING.title, RACECHIP_ENGINEERING.titleUk)}
            </h2>
            <p className="rc__feature-desc">
              {L(isUa, RACECHIP_ENGINEERING.description, RACECHIP_ENGINEERING.descriptionUk)}
            </p>
            <ul className="rc__feature-list">
              {RACECHIP_ENGINEERING.features.map((f, i) => (
                <li key={i}>{L(isUa, f.en, f.uk)}</li>
              ))}
            </ul>
          </div>
          <div className="rc__feature-media" data-rc data-rc-delay="1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={RACECHIP_ENGINEERING.imageUrl}
              alt="RaceChip GTS Black Carbon Module"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          5 · HERITAGE
      ════════════════════════════════════════════════════════════════ */}
      <section className="rc__heritage" data-rc>
        <div className="rc__heritage-inner">
          <h2 className="rc__heritage-title">
            {L(isUa, RACECHIP_HERITAGE.title, RACECHIP_HERITAGE.titleUk)}
          </h2>
          <p className="rc__heritage-desc">
            {L(isUa, RACECHIP_HERITAGE.description, RACECHIP_HERITAGE.descriptionUk)}
          </p>
          <Link href={`/${locale}/shop/racechip/catalog`} className="rc__cta">
            {L(isUa, 'Browse Full Catalog', 'Переглянути повний каталог')}
            <span className="rc__cta-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <div className="rc__footer-cta">
        <Link href={`/${locale}/shop/racechip/catalog`}>
          {L(isUa, 'Explore the Full Range', 'Переглянути повний модельний ряд')}
          <span className="rc__cta-arrow">→</span>
        </Link>
      </div>

    </div>
  );
}
