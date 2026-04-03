'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { SupportedLocale } from '@/lib/seo';
import {
  ADRO_HERO,
  ADRO_STATS,
  ADRO_TECHNOLOGY,
  ADRO_MATERIALS,
  ADRO_PRODUCT_LINES,
  ADRO_HERITAGE,
} from '../data/adroHomeData';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function AdroHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-adro-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('adro-vis');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Counter animation ── */
  useEffect(() => {
    const counters = document.querySelectorAll('[data-adro-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.adroCount || '0';
          io.unobserve(el);

          if (!/^\d+$/.test(target.replace(/[^0-9]/g, ''))) {
            el.textContent = target;
            return;
          }

          const num = parseInt(target.replace(/[^0-9]/g, ''), 10);
          const prefix = target.replace(/[0-9]/g, '').replace(/[^−+\-]/g, '');
          const suffix = target.replace(/[0-9]/g, '').replace(/[−+\-]/g, '');
          let current = 0;
          const step = Math.max(1, Math.floor(num / 60));
          const timer = setInterval(() => {
            current += step;
            if (current >= num) {
              current = num;
              clearInterval(timer);
            }
            el.textContent = prefix + current + suffix;
          }, 20);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="adro-home" id="AdroHome">
      {/* ── Back to Stores ── */}
      <div className="adro-back">
        <Link href={`/${locale}/shop`} className="adro-back__link">
          ← {L(isUa, 'All our stores', 'Усі наші магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-hero" id="adro-hero-section">
        <div className="adro-hero__bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ADRO_HERO.heroImage}
            alt="ADRO Carbon Aerokit"
            loading="eager"
          />
        </div>

        <div className="adro-hero__content" data-adro-reveal>
          <p className="adro-hero__overtitle">
            One Company × ADRO
          </p>

          <h1 className="adro-hero__title">
            {L(isUa, 'Carbon', 'Карбон')}<br />
            <em>{L(isUa, 'Precision', 'Точність')}</em>
          </h1>

          <p className="adro-hero__subtitle">
            {L(isUa, ADRO_HERO.subtitle, ADRO_HERO.subtitleUk)}
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="adro-hero__scroll" aria-hidden>
          <div className="adro-hero__scroll-line" />
        </div>

        {/* Stats bar */}
        <div className="adro-hero__stats" data-adro-reveal>
          {ADRO_STATS.map((s, i) => (
            <div key={i} className="adro-hero__stat">
              <span className="adro-hero__stat-num" data-adro-count={s.val}>
                0
              </span>
              <span className="adro-hero__stat-label">
                {L(isUa, s.en, s.ua)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — CFD ENGINEERING
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-tech">
        <div className="adro-tech__header">
          <span className="adro-label">
            {L(isUa, 'Engineering', 'Інженерія')}
          </span>
        </div>

        <div className="adro-tech-card" data-adro-reveal>
          <div className="adro-tech-card__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ADRO_TECHNOLOGY.image}
              alt="CFD Engineering"
              loading="lazy"
            />
          </div>
          <div className="adro-tech-card__text">
            <span className="adro-label">
              {L(isUa, 'Technology', 'Технологія')}
            </span>
            <h2 className="adro-tech-card__title">
              {L(isUa, ADRO_TECHNOLOGY.title, ADRO_TECHNOLOGY.titleUk)}
            </h2>
            <div className="adro-tech-card__shimmer" />
            <p className="adro-tech-card__desc">
              {L(isUa, ADRO_TECHNOLOGY.description, ADRO_TECHNOLOGY.descriptionUk)}
            </p>
            <div className="adro-tech-card__specs">
              {ADRO_TECHNOLOGY.specs.map((spec, i) => (
                <div key={i} className="adro-tech-card__spec">
                  <span className="adro-tech-card__spec-val">{spec.val}</span>
                  <span className="adro-tech-card__spec-label">
                    {L(isUa, spec.label, spec.labelUk)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PREPREG CARBON FIBER
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-tech">
        <div className="adro-tech-card adro-tech-card--reverse" data-adro-reveal>
          <div className="adro-tech-card__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ADRO_MATERIALS.image}
              alt="Prepreg Carbon Fiber"
              loading="lazy"
            />
          </div>
          <div className="adro-tech-card__text">
            <span className="adro-label">
              {L(isUa, 'Material', 'Матеріал')}
            </span>
            <h2 className="adro-tech-card__title">
              {L(isUa, ADRO_MATERIALS.title, ADRO_MATERIALS.titleUk)}
            </h2>
            <div className="adro-tech-card__shimmer" />
            <p className="adro-tech-card__desc">
              {L(isUa, ADRO_MATERIALS.description, ADRO_MATERIALS.descriptionUk)}
            </p>
            <div className="adro-tech-card__specs">
              {ADRO_MATERIALS.specs.map((spec, i) => (
                <div key={i} className="adro-tech-card__spec">
                  <span className="adro-tech-card__spec-val">{spec.val}</span>
                  <span className="adro-tech-card__spec-label">
                    {L(isUa, spec.label, spec.labelUk)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-lines" data-adro-reveal>
        <div className="adro-lines__header">
          <span className="adro-label">
            {L(isUa, 'Shop by Vehicle', 'Каталог за автомобілем')}
          </span>
          <h2 className="adro-section-title">
            {L(isUa, 'Find Your Kit', 'Знайдіть свій кіт')}
          </h2>
          <div className="adro-divider adro-divider--center" />
        </div>

        <div className="adro-lines__track">
          {ADRO_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="adro-line-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="adro-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                loading="lazy"
              />
              <div className="adro-line-card__overlay" />
              <span className="adro-line-card__badge">
                {L(isUa, line.badge, line.badgeUk)}
              </span>
              <div className="adro-line-card__content">
                <h3 className="adro-line-card__name">
                  {L(isUa, line.name, line.nameUk)}
                </h3>
                <p className="adro-line-card__desc">
                  {L(isUa, line.description, line.descriptionUk)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — CARBON WEAVE DIVIDER
      ════════════════════════════════════════════════════════════════ */}
      <div className="adro-weave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 6 + Math.cos(i * 0.4) * 14 + Math.random() * 10;
          return (
            <div
              key={i}
              className="adro-weave__bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${i * 0.06}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6 — HERITAGE
      ════════════════════════════════════════════════════════════════ */}
      <section className="adro-heritage" data-adro-reveal>
        <div className="adro-heritage__bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ADRO_HERITAGE.fallbackImage}
            alt="ADRO Heritage"
            loading="lazy"
          />
        </div>

        <div className="adro-heritage__content">
          <span className="adro-label">
            {L(isUa, 'Heritage', 'Спадщина')}
          </span>
          <h2 className="adro-heritage__title">
            {L(isUa, ADRO_HERITAGE.title, ADRO_HERITAGE.titleUk)}
          </h2>
          <div className="adro-divider adro-divider--center" />
          <p className="adro-heritage__desc">
            {L(isUa, ADRO_HERITAGE.description, ADRO_HERITAGE.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7 — BOTTOM CTA
      ════════════════════════════════════════════════════════════════ */}
      <div className="adro-bottom-cta" data-adro-reveal>
        <span className="adro-label">
          {L(isUa, 'Ready to transform?', 'Готові до трансформації?')}
        </span>
        <br />
        <Link href={`/${locale}/shop/adro/collections`} className="adro-btn">
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
