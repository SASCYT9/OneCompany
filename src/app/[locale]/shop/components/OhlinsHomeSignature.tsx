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

const T = (isUa: boolean, en: string, ua: string) => (isUa ? ua : en);

/* ── Product images: use real local photos ── */
const HERO_PRODUCT = '/images/shop/ohlins/hero-fallback.jpg';

/* ── Dense gold dust cloud (80 particles) ── */
function GoldDustCloud() {
  const particles = useMemo(() => {
    const rng = (min: number, max: number) => min + Math.random() * (max - min);
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${rng(15, 85)}%`,
      top: `${rng(25, 75)}%`,
      size: `${rng(1.5, 5)}px`,
      delay: `${rng(0, 5)}s`,
      duration: `${rng(2.5, 5.5)}s`,
    }));
  }, []);

  return (
    <div className="oh-dust-cloud">
      <div className="oh-dust-cloud__glow" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="oh-dust-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            ['--delay' as string]: p.delay,
            ['--d' as string]: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* Scroll reveal observer */
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Counter animation */
  useEffect(() => {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const raw = el.dataset.count || '0';
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
          const step = Math.max(1, Math.floor(target / 50));
          const timer = setInterval(() => {
            cur = Math.min(cur + step, target);
            el.textContent = prefix + cur + suffix;
            if (cur >= target) clearInterval(timer);
          }, 22);
        }),
      { threshold: 0.5 }
    );
    counters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ohlins-shop" id="OhlinsHome">
      {/* Back nav */}
      <div className="fixed top-8 left-8 z-50 mix-blend-difference">
        <Link
          href={`/${locale}/shop`}
          className="text-xs font-medium tracking-[0.2em] text-white/50 hover:text-white uppercase transition-colors"
        >
          ← {T(isUa, 'All stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ═══════ HERO ═══════ */}
      <section className="oh-hero">
        <GoldDustCloud />

        {/* Title (z-index: 1 → BEHIND product) */}
        <h1 className="oh-hero__title" data-reveal>
          FEEL THE ROAD
        </h1>

        {/* Product (z-index: 3 → IN FRONT of title) */}
        <div className="oh-hero__product" data-reveal>
          <Image
            src={HERO_PRODUCT}
            alt="Öhlins Racing Coilover"
            fill
            className="object-contain"
            priority
          />
        </div>

        <p className="oh-hero__subtitle" data-reveal>
          {T(
            isUa,
            OHLINS_HERO.description,
            'Öhlins Racing — передові підвіски для найвимогливіших водіїв та гонщиків. Чемпіонська технологія з 1976 року.'
          )}
        </p>
      </section>

      {/* ═══════ STATS BAR ═══════ */}
      <section className="px-6 pb-12" data-reveal>
        <div className="oh-stats">
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="oh-stats__cell">
              <span className="oh-stats__value" data-count={s.value}>
                0
              </span>
              <span className="oh-stats__label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ PRODUCT GRID 2×2 ═══════ */}
      <section className="px-6 pb-24 lg:pb-32" data-reveal>
        <div className="oh-grid">
          {OHLINS_PRODUCT_LINES.map((line, idx) => (
            <Link
              key={line.id}
              href={`/${locale}${line.link}`}
              className={`oh-card group ${idx === 0 ? 'oh-card--featured' : ''}`}
            >
              <div className="oh-card__text">
                <div>
                  <h3 className="oh-card__title">{line.name}</h3>
                  <p className="oh-card__desc">{line.description}</p>
                </div>
                <span className="oh-card__btn">
                  {T(isUa, 'Shop now', 'Переглянути')}
                </span>
              </div>
              <div className="oh-card__img">
                <Image
                  src={line.image}
                  alt={line.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 48vw, 25vw"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════ TECHNOLOGY — Golden Standard ═══════ */}
      <section className="py-20 lg:py-28 px-6 lg:px-12">
        <div className="oh-shimmer mb-16" />
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16" data-reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-3">
              {T(isUa, 'Technology', 'Технології')}
            </p>
            <h2 className="oh-cta__title">
              <span className="oh-gradient-text">
                {T(isUa, 'Golden Standard', 'Золотий Стандарт')}
              </span>
            </h2>
          </div>

          <div className="space-y-16 lg:space-y-24">
            {OHLINS_MATERIALS.map((mat, i) => (
              <div
                key={i}
                className={`oh-tech-row ${i % 2 !== 0 ? 'oh-tech-row--rev' : ''}`}
                data-reveal
              >
                <div className="oh-tech-img">
                  <Image
                    src={mat.image}
                    alt={mat.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 55vw"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 mb-3">
                    {`0${i + 1}.`}
                  </p>
                  <div className="oh-gold-line" />
                  <h3
                    className="text-xl lg:text-2xl font-bold uppercase tracking-tight mb-3"
                    style={{ fontFamily: "'Oswald', sans-serif" }}
                  >
                    {mat.name}
                  </h3>
                  <p className="text-sm text-white/35 leading-[1.8] font-light">
                    {mat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA — Ride With Champions ═══════ */}
      <section className="oh-cta" data-reveal>
        <Image
          src={OHLINS_HERITAGE.image}
          alt="Öhlins Heritage"
          fill
          className="object-cover opacity-[0.06]"
        />
        <div className="relative z-10 space-y-5">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/25">
            {T(isUa, 'Born in Sweden, Proven Worldwide', 'Народжено у Швеції, Доведено у Світі')}
          </p>
          <h2 className="oh-cta__title">
            <span className="text-white/90">{T(isUa, 'Ride With', 'Їдь З')}</span>{' '}
            <span className="oh-gradient-text">{T(isUa, 'Champions', 'Чемпіонами')}</span>
          </h2>
          <p className="text-sm text-white/30 max-w-xl mx-auto leading-relaxed font-light">
            {T(
              isUa,
              OHLINS_HERITAGE.description,
              'Кожен продукт Öhlins розроблено та протестовано на нашому шведському заводі. Від MotoGP до Ле-Ман — золоті амортизатори є вибором чемпіонів.'
            )}
          </p>
          <div className="pt-3">
            <Link href={`/${locale}/shop/ohlins/collections`} className="oh-btn">
              {T(isUa, 'View Collections', 'Переглянути Колекції')}
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
