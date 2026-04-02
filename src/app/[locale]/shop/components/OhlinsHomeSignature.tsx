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

function L(isUa: boolean, en: string, ua: string = en) {
  return isUa ? ua : en;
}

export default function OhlinsHomeSignature({ locale }: Props) {
  const isUa = locale === 'ua';

  /* ── Scroll reveal ── */
  useEffect(() => {
    const els = document.querySelectorAll('[data-ohlins-reveal],[data-ohlins-reveal-stagger]');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('ohlins-vis');
            io.unobserve(e.target);
          }
        });
      },
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
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = el.dataset.ohlinsCount || '0';
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
          }, 18);
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
      <div className="fixed top-8 left-8 z-50 mix-blend-difference">
        <Link
          href={`/${locale}/shop`}
          className="text-xs font-medium tracking-[0.2em] text-white/60 hover:text-white uppercase transition-colors duration-300"
        >
          ← {L(isUa, 'All stores', 'Усі магазини')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — EDITORIAL HERO (full viewport)
      ════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-end pb-20 overflow-hidden">
        {/* Background image */}
        <Image
          src="/images/shop/ohlins/hero-fallback.jpg"
          alt="Öhlins Racing"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 ohlins-hero-gradient" />

        {/* Gold shimmer line at hero bottom */}
        <div className="absolute bottom-0 left-0 right-0 ohlins-shimmer-line" />

        {/* Hero content — bottom-aligned, editorial layout */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-[1fr_auto] items-end gap-12" data-ohlins-reveal>
            {/* Left — Typography */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 font-medium mb-6 flex items-center gap-4">
                <span className="w-10 h-[1px] bg-gradient-to-r from-white/30 to-transparent" />
                One Company × Öhlins
              </p>

              <h1 className="ohlins-display text-6xl md:text-8xl lg:text-[9rem] text-white/90 mb-4">
                {L(isUa, 'Feel', 'Відчуй')}{' '}
                <span className="ohlins-gradient-text">
                  {L(isUa, 'The', 'Цей')}
                </span>
                <br />
                <span className="ohlins-gradient-text">
                  {L(isUa, 'Road', 'Драйв')}
                </span>
              </h1>

              <p className="max-w-xl text-sm md:text-base text-white/50 leading-relaxed font-light mb-10">
                {L(
                  isUa,
                  OHLINS_HERO.description,
                  'Öhlins Racing — передові підвіски для найвимогливіших водіїв та гонщиків. Чемпіонська технологія з 1976 року.'
                )}
              </p>

              <Link href={`/${locale}/shop/ohlins/collections`} className="ohlins-btn">
                {L(isUa, 'Explore catalog', 'Відкрити каталог')}
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>

            {/* Right — Stats (vertical, editorial) */}
            <div className="hidden lg:flex flex-col gap-8 pb-4">
              {OHLINS_STATS.map((s, i) => (
                <div key={i} className="text-right">
                  <span
                    className="block text-3xl font-extralight ohlins-text-gold tracking-tight"
                    data-ohlins-count={s.value}
                  >
                    0
                  </span>
                  <span className="block text-[10px] text-white/35 uppercase tracking-[0.25em] mt-1">
                    {L(isUa, s.label, s.label)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile Stats (visible < lg) ── */}
      <section className="lg:hidden py-8 px-6" data-ohlins-reveal>
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
          {OHLINS_STATS.map((s, i) => (
            <div key={i} className="ohlins-stat">
              <span className="block text-xl font-extralight ohlins-text-gold" data-ohlins-count={s.value}>
                0
              </span>
              <span className="block text-[9px] text-white/35 uppercase tracking-[0.2em] mt-1">
                {L(isUa, s.label, s.label)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — PRODUCT LINES (2×2 Bento Grid)
      ════════════════════════════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 px-6 lg:px-12 relative z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-16" data-ohlins-reveal>
            <div>
              <div className="ohlins-divider mb-6" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3">
                {L(isUa, 'Product Selection', 'Вибір Продукції')}
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl ohlins-heading text-white/90">
                {L(isUa, 'Engineered', 'Інженерна')}
                <br />
                <span className="ohlins-gradient-text">
                  {L(isUa, 'Details', 'Досконалість')}
                </span>
              </h2>
            </div>
            <Link
              href={`/${locale}/shop/ohlins/collections`}
              className="hidden md:inline-flex items-center gap-2 text-xs text-white/40 uppercase tracking-[0.2em] hover:text-white/70 transition-colors"
            >
              {L(isUa, 'View All', 'Дивитись Все')}
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6" data-ohlins-reveal-stagger>
            {OHLINS_PRODUCT_LINES.map((line) => (
              <Link
                key={line.id}
                href={`/${locale}${line.link}`}
                className="ohlins-card group relative h-[340px] lg:h-[420px] flex flex-col justify-end"
              >
                <Image
                  src={line.image}
                  alt={line.name}
                  fill
                  className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04] opacity-40 group-hover:opacity-60"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                <div className="relative z-10 p-6 lg:p-8">
                  <div className="w-6 h-[1px] bg-[var(--ohlins-gold)] mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <h3 className="text-lg lg:text-xl ohlins-heading text-white mb-2">
                    {L(isUa, line.name, line.name)}
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed max-w-sm group-hover:text-white/60 transition-colors duration-500">
                    {L(isUa, line.description, line.description)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — THE GOLDEN STANDARD (Technology)
      ════════════════════════════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 px-6 lg:px-12 relative z-10">
        {/* Full-width shimmer divider */}
        <div className="ohlins-shimmer-line mb-24" />

        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-20" data-ohlins-reveal>
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-4">
              {L(isUa, 'Technology', 'Технології')}
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl ohlins-display text-white/90">
              {L(isUa, 'The', 'Золотий')}{' '}
              <span className="ohlins-gradient-text">
                {L(isUa, 'Golden Standard', 'Стандарт')}
              </span>
            </h2>
          </div>

          <div className="space-y-20 lg:space-y-32">
            {OHLINS_MATERIALS.map((mat, i) => (
              <div
                key={i}
                className={`flex flex-col lg:flex-row gap-10 lg:gap-20 items-center ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
                data-ohlins-reveal
              >
                <div className="w-full lg:w-[55%] ohlins-material-img">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={mat.image}
                      alt={mat.name}
                      fill
                      className="object-cover transition-transform duration-[1.4s] ease-out hover:scale-[1.03]"
                      sizes="(max-width: 1024px) 100vw, 55vw"
                    />
                  </div>
                </div>

                <div className="w-full lg:w-[45%] space-y-6 lg:space-y-8">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/25">
                    {`0${i + 1}.`}
                  </p>
                  <div className="ohlins-divider" />
                  <h3 className="text-2xl lg:text-3xl ohlins-heading text-white/90">
                    {L(isUa, mat.name, mat.name)}
                  </h3>
                  <p className="text-sm lg:text-base text-white/45 leading-[1.8] font-light max-w-lg">
                    {L(isUa, mat.description, mat.description)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — HERITAGE CTA
      ════════════════════════════════════════════════════════════════ */}
      <section className="relative py-32 lg:py-44 px-6 overflow-hidden" data-ohlins-reveal>
        <Image
          src={OHLINS_HERITAGE.image}
          alt="Öhlins Heritage"
          fill
          className="object-cover opacity-[0.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ohlins-black)] via-transparent to-[var(--ohlins-black)]" />

        {/* Top shimmer */}
        <div className="absolute top-0 left-0 right-0 ohlins-shimmer-line" />

        <div className="relative z-10 max-w-[1400px] mx-auto text-center space-y-8">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
            {L(isUa, OHLINS_HERITAGE.title, 'Народжено у Швеції')}
          </p>

          <h2 className="text-5xl md:text-7xl lg:text-8xl ohlins-display">
            <span className="text-white/90">{L(isUa, 'Ride', 'З')}</span>{' '}
            <span className="ohlins-gradient-text">
              {L(isUa, 'With', 'Чемпіонами')}
            </span>
            <br />
            <span className="text-white/90">{L(isUa, 'Champions', '')}</span>
          </h2>

          <p className="text-sm lg:text-base text-white/40 max-w-2xl mx-auto leading-relaxed font-light">
            {L(
              isUa,
              OHLINS_HERITAGE.description,
              'Кожен продукт Öhlins розроблено та протестовано на нашому шведському заводі. Від MotoGP до Ле-Ман — золоті амортизатори є вибором чемпіонів.'
            )}
          </p>

          <div className="pt-6">
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
