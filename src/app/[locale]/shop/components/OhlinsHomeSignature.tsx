'use client';

import { useEffect, useMemo } from 'react';
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

function L(isUa: boolean, en: string, ua: string = en) {
  return isUa ? ua : en;
}

/* ── Dense gold dust cloud ── */
function GoldDust() {
  const particles = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${15 + Math.random() * 70}%`,
      top: `${20 + Math.random() * 60}%`,
      delay: `${Math.random() * 5}s`,
      size: `${1 + Math.random() * 4}px`,
      duration: `${2 + Math.random() * 4}s`,
      opacity: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  return (
    <div className="ohlins-hero__dust">
      <div className="ohlins-dust-glow" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="ohlins-dust-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            ['--dur' as string]: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-ohlins-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('ohlins-vis'); io.unobserve(e.target); }
      }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Counter animation ── */
  useEffect(() => {
    const counters = document.querySelectorAll('[data-ohlins-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const target = el.dataset.ohlinsCount || '0';
        io.unobserve(el);
        if (!/^\d+$/.test(target.replace(/[^0-9]/g, ''))) { el.textContent = target; return; }
        const num = parseInt(target.replace(/[^0-9]/g, ''), 10);
        const prefix = target.replace(/[0-9]/g, '').replace(/[^−+\-]/g, '');
        const suffix = target.replace(/[0-9]/g, '').replace(/[−+\-]/g, '');
        let current = 0;
        const step = Math.max(1, Math.floor(num / 50));
        const timer = setInterval(() => {
          current += step;
          if (current >= num) { current = num; clearInterval(timer); }
          el.textContent = prefix + current + suffix;
        }, 20);
      }),
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ohlins-shop" id="OhlinsHome">

      {/* ── Back ── */}
      <div className="fixed top-8 left-8 z-50 mix-blend-difference">
        <Link href={`/${locale}/shop`} className="text-xs font-medium tracking-[0.2em] text-white/50 hover:text-white uppercase transition-colors">
          ← {L(isUa, 'All stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          HERO — Title BEHIND product, gold dust cloud
      ════════════════════════════════════════════════════════════════ */}
      <section className="ohlins-hero">
        {/* Gold dust particles */}
        <GoldDust />

        {/* BIG title (z-index 1 — sits BEHIND the product) */}
        <h1 className="ohlins-hero__title" data-ohlins-reveal>
          {L(isUa, 'FEEL THE ROAD', 'FEEL THE ROAD')}
        </h1>

        {/* Product image (z-index 2 — sits IN FRONT of the title) */}
        <div className="ohlins-hero__product" data-ohlins-reveal>
          <Image
            src="/images/shop/ohlins/hero-fallback.jpg"
            alt="Öhlins Coilover"
            fill
            className="object-contain drop-shadow-[0_25px_60px_rgba(200,168,78,0.3)]"
            priority
          />
        </div>

        {/* Subtitle */}
        <p className="ohlins-hero__subtitle" data-ohlins-reveal>
          {L(
            isUa,
            OHLINS_HERO.description,
            'Öhlins Racing — передові підвіски для найвимогливіших водіїв та гонщиків. Чемпіонська технологія з 1976 року.'
          )}
        </p>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          STATS BAR — Gold top border, 3 columns, inline value+label
      ════════════════════════════════════════════════════════════════ */}
      <section className="px-6 pb-12" data-ohlins-reveal>
        <div className="ohlins-stats-bar">
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="ohlins-stat-cell">
              <span className="ohlins-stat-value" data-ohlins-count={s.value}>0</span>
              <span className="ohlins-stat-label">{L(isUa, s.label, s.label)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          PRODUCT GRID — 2×2 cards, text left, image right
      ════════════════════════════════════════════════════════════════ */}
      <section className="px-6 pb-24 lg:pb-32" data-ohlins-reveal>
        <div className="ohlins-grid">
          {OHLINS_PRODUCT_LINES.map((line, idx) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className={`ohlins-product-card group ${idx === 0 ? 'ohlins-product-card--featured' : ''}`}
            >
              {/* Text side */}
              <div className="ohlins-product-card__text">
                <div>
                  <h3 className="ohlins-product-card__title">{L(isUa, line.name, line.name)}</h3>
                  <p className="ohlins-product-card__desc">{L(isUa, line.description, line.description)}</p>
                </div>
                <span className="ohlins-shop-btn">
                  {L(isUa, 'Shop now', 'Переглянути')}
                </span>
              </div>

              {/* Image side */}
              <div className="ohlins-product-card__image">
                <Image
                  src={line.image}
                  alt={line.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 45vw, 25vw"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          TECHNOLOGY — Golden Standard
      ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 px-6 lg:px-12">
        <div className="ohlins-shimmer-line mb-16" />
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16" data-ohlins-reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-3">
              {L(isUa, 'Technology', 'Технології')}
            </p>
            <h2 className="ohlins-cta-title">
              <span className="ohlins-gradient-text">
                {L(isUa, 'Golden Standard', 'Золотий Стандарт')}
              </span>
            </h2>
          </div>

          <div className="space-y-16 lg:space-y-24">
            {OHLINS_MATERIALS.map((mat, i) => (
              <div
                key={i}
                className={`ohlins-tech-row ${i % 2 !== 0 ? 'ohlins-tech-row--reverse' : ''}`}
                data-ohlins-reveal
              >
                <div className="ohlins-tech-img">
                  <Image src={mat.image} alt={mat.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
                </div>
                <div className="ohlins-tech-text flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 mb-3">{`0${i + 1}.`}</p>
                  <div className="ohlins-gold-line" />
                  <h3 className="text-xl lg:text-2xl font-bold uppercase tracking-tight mb-3">{L(isUa, mat.name, mat.name)}</h3>
                  <p className="text-sm text-white/35 leading-[1.8] font-light">{L(isUa, mat.description, mat.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CTA — Ride With Champions
      ════════════════════════════════════════════════════════════════ */}
      <section className="ohlins-cta" data-ohlins-reveal>
        <Image src={OHLINS_HERITAGE.image} alt="Öhlins Heritage" fill className="object-cover opacity-[0.06]" />

        <div className="relative z-10 space-y-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/25">
            {L(isUa, 'Born in Sweden, Proven Worldwide', 'Народжено у Швеції, Доведено у Світі')}
          </p>
          <h2 className="ohlins-cta-title">
            <span className="text-white/90">{L(isUa, 'Ride With', 'Їдь З')}</span>{' '}
            <span className="ohlins-gradient-text">{L(isUa, 'Champions', 'Чемпіонами')}</span>
          </h2>
          <p className="text-sm text-white/30 max-w-xl mx-auto leading-relaxed font-light">
            {L(
              isUa,
              OHLINS_HERITAGE.description,
              'Кожен продукт Öhlins розроблено та протестовано на нашому шведському заводі. Від MotoGP до Ле-Ман — золоті амортизатори є вибором чемпіонів.'
            )}
          </p>
          <div className="pt-4">
            <Link href={`/${locale}/shop/ohlins/collections`} className="ohlins-btn">
              {L(isUa, 'View Collections', 'Переглянути Колекції')}
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
