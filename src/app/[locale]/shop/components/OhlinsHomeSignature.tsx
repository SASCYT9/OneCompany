'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SupportedLocale } from '@/lib/seo';
import {
  OHLINS_HERO,
  OHLINS_STATS,
  OHLINS_MATERIALS,
  OHLINS_PRODUCT_LINES,
  OHLINS_HERITAGE,
} from '../data/ohlinsHomeData';

type Props = { locale: SupportedLocale };

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-oh-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('oh-vis');
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
    const counters = document.querySelectorAll('[data-oh-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const raw = el.dataset.ohCount || '0';
          io.unobserve(el);

          const numStr = raw.replace(/[^0-9]/g, '');
          if (!numStr) {
            el.textContent = raw;
            return;
          }
          const target = parseInt(numStr, 10);
          const prefix = raw.slice(0, raw.indexOf(numStr[0]));
          const suffix = raw.slice(raw.lastIndexOf(numStr[numStr.length - 1]) + 1);
          let cur = 0;
          const step = Math.max(1, Math.floor(target / 60));
          const timer = setInterval(() => {
            cur = Math.min(cur + step, target);
            el.textContent = prefix + cur + suffix;
            if (cur >= target) clearInterval(timer);
          }, 20);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ohlins-shop" id="OhlinsHome">
      {/* ── Back to Stores ── */}
      <div className="oh-back">
        <Link href={`/${locale}/shop`} className="oh-back__link">
          ← {L(isUa, 'All stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO (full viewport)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-hero">
        <div className="oh-hero__bg">
          <Image
            src="/images/shop/ohlins/hero-bg.png"
            alt="Motorsport racing"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="oh-hero__content" data-oh-reveal>
          <p className="oh-hero__overtitle">
            One Company × Öhlins Racing
          </p>

          <h1 className="oh-hero__title">
            {L(isUa, 'Feel The', 'Відчуй')}<br />
            <em>{L(isUa, 'Road', 'Дорогу')}</em>
          </h1>

          <p className="oh-hero__subtitle">
            {L(
              isUa,
              OHLINS_HERO.description,
              'Передові підвіски Öhlins Racing для найвимогливіших водіїв. Чемпіонська технологія з 1976 року — від MotoGP до вашого авто.'
            )}
          </p>
        </div>

        {/* Stats bar */}
        <div className="oh-hero__stats" data-oh-reveal>
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="oh-hero__stat">
              <span className="oh-hero__stat-num" data-oh-count={s.value}>
                0
              </span>
              <span className="oh-hero__stat-label">
                {L(isUa, s.label, s.label)}
              </span>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="oh-hero__scroll" aria-hidden>
          <div className="oh-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — MATERIAL SHOWCASE (DFV + Gold Materials)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-materials">
        {/* DFV Technology */}
        <div className="oh-material" data-oh-reveal>
          <div className="oh-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OHLINS_MATERIALS[0].image}
              alt="Dual Flow Valve technology"
              loading="lazy"
            />
          </div>
          <div className="oh-material__text">
            <span className="oh-label">
              {L(isUa, 'Technology', 'Технологія')}
            </span>
            <h2 className="oh-material__title">
              {L(isUa, OHLINS_MATERIALS[0].name, 'Двопотоковий Клапан (DFV)')}
            </h2>
            <div className="oh-divider" />
            <p className="oh-material__desc">
              {L(
                isUa,
                OHLINS_MATERIALS[0].description,
                'Наша запатентована технологія DFV забезпечує однакові характеристики при стисканні та відбої. Це дозволяє колесу швидко повертатися на дорожнє покриття після нерівності, забезпечуючи максимальне зчеплення без компромісу з комфортом.'
              )}
            </p>
          </div>
        </div>

        {/* Gold Anodized Materials */}
        <div className="oh-material oh-material--reverse" data-oh-reveal>
          <div className="oh-material__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/shop/ohlins/gold-material.png"
              alt="Gold anodized aluminum"
              loading="lazy"
            />
          </div>
          <div className="oh-material__text">
            <span className="oh-label">
              {L(isUa, 'Material', 'Матеріал')}
            </span>
            <h2 className="oh-material__title">
              {L(isUa, OHLINS_MATERIALS[1].name, 'Авіаційний Алюміній')}
            </h2>
            <div className="oh-divider" />
            <p className="oh-material__desc">
              {L(
                isUa,
                OHLINS_MATERIALS[1].description,
                'Виготовлено з авіаційного алюмінію та покрито нашим фірмовим золотим анодуванням. Це забезпечує максимальний тепловідвід, ідеальну корозійну стійкість та впізнавану візуальну ідентичність Öhlins.'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-lines" data-oh-reveal>
        <div className="oh-lines__header">
          <span className="oh-label">
            {L(isUa, 'Product Lines', 'Лінійки продукції')}
          </span>
          <h2 className="oh-section-title">
            {L(isUa, 'Engineered for Performance', 'Створено для Перемог')}
          </h2>
          <div className="oh-divider oh-divider--center" />
        </div>

        <div className="oh-lines__track">
          {OHLINS_PRODUCT_LINES.map((line) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className="oh-line-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="oh-line-card__img"
                src={line.image}
                alt={line.name}
                loading="lazy"
              />
              <div className="oh-line-card__overlay" />
              <span className="oh-line-card__badge">
                {L(isUa, 'Öhlins', 'Öhlins')}
              </span>
              <div className="oh-line-card__content">
                <h3 className="oh-line-card__name">{line.name}</h3>
                <p className="oh-line-card__desc">{line.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          Gold wave divider
      ════════════════════════════════════════════════════════════════ */}
      <div className="oh-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 6 + Math.cos(i * 0.4) * 14 + Math.random() * 10;
          return (
            <div
              key={i}
              className="oh-wave__bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${i * 0.06}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HERITAGE CTA with background
      ════════════════════════════════════════════════════════════════ */}
      <section className="oh-heritage" data-oh-reveal>
        <div className="oh-heritage__bg">
          <Image
            src={OHLINS_HERITAGE.image}
            alt="Öhlins Heritage"
            fill
            className="object-cover"
          />
        </div>

        <div className="oh-heritage__content">
          <span className="oh-label">
            {L(isUa, 'Heritage', 'Спадщина')}
          </span>
          <h2 className="oh-heritage__title">
            {L(isUa, 'Ride With', 'Їдь З')}{' '}
            <span className="oh-gradient-text">
              {L(isUa, 'Champions', 'Чемпіонами')}
            </span>
          </h2>
          <div className="oh-divider oh-divider--center" />
          <p className="oh-heritage__desc">
            {L(
              isUa,
              OHLINS_HERITAGE.description,
              'Кожен продукт Öhlins розроблено та протестовано на нашому шведському заводі. Від MotoGP до Ле-Ман — золоті амортизатори є вибором чемпіонів.'
            )}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — BOTTOM CTA
      ════════════════════════════════════════════════════════════════ */}
      <div className="oh-bottom-cta" data-oh-reveal>
        <span className="oh-label">
          {L(isUa, 'Ready to upgrade?', 'Готові до апгрейду?')}
        </span>
        <br />
        <Link href={`/${locale}/shop/ohlins/collections`} className="oh-btn">
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
